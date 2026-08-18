import { type Fiber } from './ReactInternalTypes'
import {
  HostRoot,
  HostComponent,
  HostText,
  Fragment,
  ClassComponent,
  FunctionComponent,
  ContextProvider,
  ContextConsumer,
  SimpleMemoComponent,
  MemoComponent,
  IndeterminateComponent,
} from './ReactWorkTags'
import { popProvider } from './ReactFiberNewContext'
import { mergeLanes, NoLanes, type Lanes } from './ReactFiberLane'
import type { ReactContext } from '@my-mini-react/shared/ReactTypes'
import { StaticMask, Snapshot, Update, NoFlags } from './ReactFiberFlags'
import {
  popHostContainer,
  popHostContext,
  getRootHostContainer,
  getHostContext,
} from './ReactFiberHostContext'
import {
  createInstance,
  createTextInstance,
  finalizeInitialChildren,
  type Container,
  type Instance,
  type Props,
  type Type,
  appendInitialChild,
  prepareUpdate,
} from 'ReactFiberHostConfig'

/**
 * 判断 Fiber 是否是宿主节点（Host Node）
 *
 * 宿主节点是指直接映射到平台原生元素的节点，例如：
 * - DOM 元素（如 <div>、<span>）
 * - 文本节点
 *
 * 与之相对的是组合节点（Composite Node），例如：
 * - 函数组件
 * - Class 组件
 * - Context Provider/Consumer
 *
 * @param fiber Fiber 节点
 * @returns 是否是宿主节点
 */
export function isHost(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostText
}

function markUpdate(workInProgress: Fiber): void {
  workInProgress.flags |= Update
}

/**
 * 处理 HostComponent（如 <div>、<span> 等原生 DOM 元素）的更新逻辑。
 *
 * 调用时机：completeWork 阶段，当 workInProgress 有 alternate（即非首次挂载）时调用，
 * 负责比较新旧 props，计算差异，并标记副作用。
 *
 * 核心流程：
 *   1. 比较新旧 props → 相同则直接 bailout
 *   2. 不同则调用 prepareUpdate 计算差异负载（DOM diff）
 *   3. 将差异负载挂到 updateQueue，标记 Update 副作用
 *
 * 注意：此函数只负责"标记"，真正的 DOM 更新在 commitWork 阶段执行。
 *
 * @param current - 当前屏幕上显示的 Fiber 节点（旧）
 * @param workInProgress - 正在构建的 Fiber 节点（新）
 * @param type - 元素类型，如 'div'、'span'
 * @param newProps - 新的 props
 * @param rootContainerInstance - 根容器实例（如 document.getElementById('root')）
 */
function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  type: Type,
  newProps: Props,
  rootContainerInstance: Container
): void {
  // 取出旧 props。
  const oldProps = current.memoizedProps
  // props 引用相同 → 无需更新，直接 bailout。
  if (oldProps === newProps) {
    return
  }

  // 获取当前 DOM 实例和 HostContext（用于判断命名空间，如 SVG / HTML）。
  const instance: Instance = workInProgress.stateNode
  const currentHostContext = getHostContext()

  // 调用 prepareUpdate → diffProperties，对比新旧 props。
  // 返回差异数组 [key1, val1, key2, val2, ...]，全程不操作 DOM。
  // 返回 null 表示没有实际差异。
  const updatePayload = prepareUpdate(
    instance,
    type,
    oldProps,
    newProps,
    rootContainerInstance,
    currentHostContext
  )

  // 将差异负载挂到 updateQueue，供 commit 阶段消费。
  workInProgress.updateQueue = updatePayload as any
  // 如果确实存在差异，标记 Update 副作用。
  // commit 阶段会检查 flags & Update，然后调用 commitUpdate 执行真实 DOM 更新。
  if (updatePayload) {
    markUpdate(workInProgress)
  }
}

/**
 * 递归遍历 workInProgress 的子 Fiber 树，将所有终端节点（HostComponent / HostText）
 * 的 DOM 实例 append 到 parent DOM 节点上。
 *
 * 调用时机：在 completeWork 阶段，当一个新的 HostComponent 被创建后，
 * 需要把它所有子级 DOM 节点组装起来。
 *
 * 遍历策略：采用"先序深度优先"遍历，利用 Fiber 树的 child / sibling / return 指针，
 * 跳过非 Host 类型的中间节点（如 FunctionComponent、ClassComponent 等），
 * 只把最终的 Host 节点挂载到 parent 上。
 *
 * @param parent - 父级 DOM 实例，所有子节点将被 append 到它下面
 * @param workInProgress - 当前正在 complete 的 Fiber 节点，作为遍历的边界
 * @param needsVisibilityToggle - 是否需要处理可见性切换（Persistence 模式用）
 * @param isHidden - 当前是否处于隐藏状态
 */
function appendAllChildren(
  parent: Instance,
  workInProgress: Fiber,
  needsVisibilityToggle: boolean,
  isHidden: boolean
): void {
  // 从 workInProgress 的第一个子 Fiber 开始遍历。
  let node = workInProgress.child

  while (node !== null) {
    if (isHost(node)) {
      // 当前节点是终端 Host 节点（HostComponent 或 HostText），直接将其 DOM 实例 append 到 parent 下。
      appendInitialChild(parent, node.stateNode)
    } else if (node.child !== null) {
      // 当前节点不是 Host 节点（如 FunctionComponent / ClassComponent），继续向下递归，进入其子 Fiber。
      node.child.return = node
      node = node.child
      continue
    }

    // 如果已经遍历回到了 workInProgress 自身，说明整棵子树遍历完毕。
    if (node === workInProgress) {
      return
    }

    // 当前节点没有兄弟节点，需要沿 return 指针向上回溯。
    while (node.sibling === null) {
      // 回溯到根边界或 workInProgress 的父级，遍历结束。
      if (node.return === null || node.return === workInProgress) {
        return
      }
      node = node.return
    }

    node.sibling.return = node.return
    // 移动到下一个兄弟节点继续遍历。
    node = node.sibling
  }
}

/**
 * 处理 HostText（文本节点）的更新逻辑（Mutation Mode）。
 *
 * 调用时机：completeWork 阶段，当 workInProgress.alternate !== null（即非首次挂载）时调用。
 *
 * 核心职责：
 *   比较新旧文本内容，不同则标记 Update 副作用。
 *   真正的 DOM 文本替换推迟到 commit 阶段执行。
 *
 * 为什么如此简单？
 *   文本节点没有 props / children / 嵌套结构，只需比较字符串。
 *   与 HostComponent 不同，文本节点不需要 prepareUpdate 计算差异负载，
 *   commit 阶段直接用 newText 创建新的 TextNode 替换即可。
 *
 * @param current - 当前屏幕上显示的 Fiber 节点（旧）
 * @param workInProgress - 正在构建的 Fiber 节点（新）
 * @param oldText - 旧文本内容
 * @param newText - 新文本内容
 */
function updateHostText(
  current: Fiber,
  workInProgress: Fiber,
  oldText: string,
  newText: string
): void {
  // 文本内容不同 → 标记 Update 副作用。
  // commit 阶段会检查 flags & Update，用 newText 创建新文本节点替换旧节点。
  if (oldText !== newText) {
    markUpdate(workInProgress)
  }
}

/**
 * 冒泡子节点的属性
 *
 * 作用：
 * - 收集子节点的 lanes 和 flags
 * - 合并到当前节点
 * - 用于在 completeWork 中更新 Fiber 节点
 *
 * 参数：
 * - completedWork：当前 Fiber 节点
 *
 * 返回值：
 * - 是否发生了 Bailout
 *
 * 两种模式：
 * 1. 正常模式：合并所有属性
 * 2. Bailout 模式：只合并静态 flags
 */
function bubbleProperties(completedWork: Fiber): boolean {
  // 判断是否发生了 Bailout。
  //   如果 alternate.child === completedWork.child，说明子节点复用了，发生了 Bailout。
  const didBailout =
    completedWork.alternate !== null &&
    completedWork.alternate.child === completedWork.child

  // 用于收集子 Fiber 的 lanes。
  let newChildLanes = NoLanes
  // 用于收集子 Fiber 的 flags。
  let subtreeFlags = NoFlags

  if (!didBailout) {
    // 正常模式：合并所有属性。

    let child = completedWork.child
    while (child !== null) {
      // 合并 child 的 lanes 和 childLanes。
      newChildLanes = mergeLanes(
        newChildLanes,
        mergeLanes(child.lanes, child.childLanes)
      )
      // 合并 child 的 flags 和 subtreeFlags。
      subtreeFlags |= child.subtreeFlags
      subtreeFlags |= child.flags
      // 更新 return 指针，确保树的一致性。
      child.return = completedWork
      child = child.sibling
    }
    // 将收集到的 flags 合并到 completedWork 的 subtreeFlags 中。
    completedWork.subtreeFlags |= subtreeFlags
  } else {
    // Bailout 模式：只合并静态 flags。

    let child = completedWork.child
    while (child !== null) {
      // 合并 child 的 lanes 和 childLanes。
      newChildLanes = mergeLanes(
        newChildLanes,
        mergeLanes(child.lanes, child.childLanes)
      )
      // 从子树的 subtreeFlags 中提取静态 flags，将提取的静态 flags 合并到 subtreeFlags。
      subtreeFlags |= child.subtreeFlags & StaticMask
      // 从子树的 flags 中提取静态 flags，将提取的静态 flags 合并到 subtreeFlags。
      subtreeFlags |= child.flags & StaticMask
      // 更新 return 指针，确保树的一致性。
      child.return = completedWork
      child = child.sibling
    }
    // 将收集到的静态 flags 合并到 completedWork 的 subtreeFlags 中。
    completedWork.subtreeFlags |= subtreeFlags
  }

  // 更新 completedWork 的 childLanes，确保父节点知道子树的优先级。
  completedWork.childLanes = newChildLanes
  return didBailout
}

export function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const newProps = workInProgress.pendingProps

  switch (workInProgress.tag) {
    case IndeterminateComponent:
    // case LazyComponent:
    case SimpleMemoComponent:
    case FunctionComponent:
    // case ForwardRef:
    case Fragment:
    // case Mode:
    // case Profiler:
    case ContextConsumer:
    case MemoComponent:
      bubbleProperties(workInProgress)
      return null
    case ClassComponent: {
      bubbleProperties(workInProgress)
      return null
    }
    case HostRoot: {
      // const fiberRoot = workInProgress.stateNode as FiberRoot

      // 弹出 HostContainer 的 Context 栈。（与 beginWork 阶段的 pushHostContainer 配对）。
      popHostContainer(workInProgress)

      // TODO: 暂不实现。
      // if (fiberRoot.pendingContext) {
      //   fiberRoot.context = fiberRoot.pendingContext
      //   fiberRoot.pendingContext = null
      // }

      if (current === null || current.child === null) {
        if (current !== null) {
          // current.child === null。
          // 标记 Snapshot，commit 阶段会先清空容器再渲染。
          // 容器里可能有非 React 插入的脏 DOM（比如第三方脚本），清空后再渲染，避免脏 DOM 残留。
          workInProgress.flags |= Snapshot
        }
      }

      // 将子树的副作用标志冒泡到当前节点。
      bubbleProperties(workInProgress)
      // completeWork 返回 null，表示不需要继续处理。
      return null
    }
    case HostComponent: {
      // 弹出宿主上下文。
      //   在 beginWork 阶段，我们压入了当前元素的宿主上下文（如命名空间）。
      //   在 completeWork 阶段，我们需要弹出（恢复）之前的上下文。
      //   这样做的目的是：保持上下文栈的正确性，确保父元素使用正确的上下文。
      popHostContext(workInProgress)

      // 获取根宿主容器。
      //   rootContainerInstance 是渲染的根节点（如 document.getElementById('root')）。
      //   它的用途：
      //     1. 获取 document 对象（用于 createElement）。
      //     2. 判断命名空间（SVG/MathML）。
      //     3. 提供渲染器配置。
      const rootContainerInstance = getRootHostContainer()
      // 获取元素类型，例如：'div'、'span'、'input' 等。
      const type = workInProgress.type

      if (current !== null && workInProgress.stateNode != null) {
        // 更新模式（Update）。
        // 条件：current !== null（有旧 Fiber）且 stateNode != null（有旧 DOM 实例）。
        //   workInProgress.stateNode 是从 current.stateNode 继承过来的，表示当前 Fiber 对应的真实 DOM 节点。
        //   如果 DOM 标签改变，workInProgress.stateNode 会为 null。

        // 更新现有的 DOM 实例。
        // 这个函数会：
        //   1. 对比新旧 props。
        //   2. 更新 DOM 属性（如 className、style 等）。
        //   3. 处理特殊属性（如 autoFocus、value 等）。
        updateHostComponent(
          current,
          workInProgress,
          type,
          newProps,
          rootContainerInstance
        )

        // TODO: 暂不实现。
        // // 检查 ref 是否变化。
        // //   如果 ref 发生变化，需要标记标记 ref 副作用。
        // //   在 commit 阶段会调用新的 ref 回调，并清理旧的 ref 回调。
        // if (current.ref !== workInProgress.ref) {
        //   markRef(workInProgress)
        // }
      } else {
        // 创建模式（Mount）。
        // 条件：current === null（首次渲染）或 stateNode === null（没有旧 DOM 实例）。

        // 获取当前宿主上下文。
        //   包含：命名空间（SVG/MathML/xhtml）、渲染器配置等。
        const currentHostContext = getHostContext()
        // 创建 DOM 实例。
        // 这个函数会：
        //   1. 从 rootContainerInstance 获取 document。
        //   2. 根据命名空间使用 createElement 或 createElementNS。
        //   3. 创建 DOM 元素（如 document.createElement('div')）。
        const instance = createInstance(
          type,
          newProps,
          rootContainerInstance,
          currentHostContext,
          workInProgress
        )
        // 添加子节点。将子 Fiber 对应的 DOM 节点添加到当前 instance 中。
        appendAllChildren(instance, workInProgress, false, false)
        // 保存 DOM 实例到 Fiber。这样在后续的更新中，可以直接访问这个 DOM 实例。
        workInProgress.stateNode = instance

        // 完成初始创建。
        //   处理一些需要在 commit 阶段执行的特殊属性。
        //   例如：autoFocus、表单元素的默认值等。如果需要特殊处理，标记更新。
        if (
          finalizeInitialChildren(
            instance,
            type,
            newProps,
            rootContainerInstance,
            currentHostContext
          )
        ) {
          // 标记需要更新，以便在 commit 阶段处理这些特殊属性。
          markUpdate(workInProgress)
        }

        // TODO: 暂不实现。
        // // 处理 ref。
        // //   如果是新挂载的节点且有 ref，需要标记 ref 副作用。
        // //   在 commit 阶段会调用 ref 回调。
        // if (workInProgress.ref !== null) {
        //   markRef(workInProgress)
        // }
      }

      bubbleProperties(workInProgress)
      return null
    }
    case HostText: {
      // 获取新的文本内容。
      const newText = newProps

      if (current && workInProgress.stateNode != null) {
        // 更新模式（Update）。
        // 条件：current !== null（有旧 Fiber）且 stateNode != null（有旧 DOM 实例）。
        //   workInProgress.stateNode 是从 current.stateNode 继承过来的，表示当前 Fiber 对应的真实 DOM 节点。
        //   如果 DOM 标签改变，workInProgress.stateNode 会为 null。

        // 获取旧的文本内容。
        const oldText = current.memoizedProps
        // 更新文本节点
        // 这个函数会：
        //   1. 对比新旧文本。
        //   2. 如果不同，更新 DOM 文本内容。
        //   3. 标记需要更新（如果有变化）。
        updateHostText(current, workInProgress, oldText, newText)
      } else {
        // 创建模式（Mount）。
        // 条件：current === null（首次渲染）或 stateNode === null（没有旧 DOM 实例）。

        // 获取根宿主容器。用于：
        //   1. 获取 document 对象（用于 createTextNode）。
        //   2. 提供渲染器配置。
        const rootContainerInstance = getRootHostContainer()
        // 获取当前宿主上下文。包含：
        //   命名空间、渲染器配置等。
        const currentHostContext = getHostContext()
        // 创建文本节点。
        // 这个函数会：
        //   1. 从 rootContainerInstance 获取 document。
        //   2. 创建文本节点（如 document.createTextNode(newText)）。
        //   3. 返回创建的文本节点。
        workInProgress.stateNode = createTextInstance(
          newText,
          rootContainerInstance,
          currentHostContext,
          workInProgress
        )
      }

      bubbleProperties(workInProgress)
      return null
    }
    // TODO: 待实现。
    // case SuspenseComponent:
    // case HostPortal:
    case ContextProvider:
      // Pop provider fiber
      const context: ReactContext<any> = workInProgress.type._context
      popProvider(context, workInProgress)
      bubbleProperties(workInProgress)
      return null
    // TODO: 待实现。
    // case IncompleteClassComponent:
    // case SuspenseListComponent:
    // case ScopeComponent:
    // case OffscreenComponent:
    // case CacheComponent:
    // case TracingMarkerComponent:
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      'React. Please file an issue.'
  )
}
