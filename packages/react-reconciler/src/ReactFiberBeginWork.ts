import type { Fiber, FiberRoot } from './ReactInternalTypes'
import {
  HostRoot,
  HostComponent,
  HostText,
  Fragment,
  ClassComponent,
  IndeterminateComponent,
  FunctionComponent,
  ContextProvider,
  ContextConsumer,
  MemoComponent,
  SimpleMemoComponent,
} from './ReactWorkTags'
import {
  mountChildFibers,
  reconcileChildFibers,
  cloneChildFibers,
} from './ReactChildFiber'
import { renderWithHooks, bailoutHooks } from './ReactFiberHooks'
import shallowEqual from '@my-mini-react/shared/shallowEqual'
import {
  createFiberFromTypeAndProps,
  createWorkInProgress,
  isSimpleFunctionComponent,
} from './ReactFiber'
import {
  processUpdateQueue,
  cloneUpdateQueue,
} from './ReactFiberClassUpdateQueue'
import { NoLanes, type Lanes, includesSomeLane } from './ReactFiberLane'
import { resolveDefaultProps } from './ReactFiberLazyComponent'
import type { RootState } from './ReactFiberRoot'
import {
  constructClassInstance,
  mountClassInstance,
  updateClassInstance,
} from './ReactFiberClassComponent'
import type {
  ReactProviderType,
  ReactContext,
  ReactNodeList,
} from '@my-mini-react/shared/ReactTypes'
import is from '@my-mini-react/shared/objectIs'
import ReactSharedInternals from '@my-mini-react/shared/ReactSharedInternals'
import { markSkippedUpdateLanes } from './ReactFiberWorkLoop'
import { shouldSetTextContent } from 'ReactFiberHostConfig'
import { NoFlags, ContentReset, DidCapture } from './ReactFiberFlags'
import {
  pushProvider,
  readContext,
  prepareToReadContext,
  propagateContextChange,
} from './ReactFiberNewContext'
import { pushHostContext, pushHostContainer } from './ReactFiberHostContext'

// 用于追踪当前正在渲染的组件。
const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner

/**
 * 全局更新标志
 *
 * 作用：
 * - 标记当前 Fiber 节点是否接收到更新
 * - 用于控制 Bail Out 优化
 *
 * 设置时机：
 * - false：beginWork 开始时重置
 * - true：props/state/context 变化时
 *
 * 使用场景：
 * - 类组件：updateClassInstance 中检查是否 Bail Out
 * - 函数组件：updateFunctionComponent 中检查是否跳过 Hooks
 *
 * 影响：
 * - false → 可能跳过渲染（Bail Out）
 * - true → 必须重新渲染
 */
let didReceiveUpdate: boolean = false

/**
 * React Fiber 核心协调逻辑的主入口函数
 *
 * 【功能概述】
 * `beginWork` 是 React 协调器（Reconciler）在“开始阶段”调用的核心函数。
 * 它负责根据 Fiber 节点的 `tag` 类型，分发到具体的更新逻辑（如函数组件、类组件、原生 DOM 节点等）。
 * 它的主要任务是：基于最新的 props 和 state，计算出当前节点的最新状态，并构建子节点的 Fiber 树结构。
 *
 * 【执行上下文】
 * 该函数在 `renderRoot` 阶段被递归调用。它不处理副作用（如 DOM 操作），
 * 这些操作会被推迟到随后的 `completeWork` 和 `commit` 阶段。
 *
 * @param current - 当前树中的 Fiber 节点（即上一次渲染的 Fiber）。如果是首次渲染（mount），则为 null。
 * @param workInProgress - 正在构建的工作进度树节点。这是 current 节点的克隆或新创建的节点。
 * @param renderLanes - 当前渲染批次的优先级通道（Lanes），用于决定哪些更新需要被处理。
 * @returns
 *   - 返回下一个需要处理的子节点 Fiber（用于深度优先遍历）。
 *   - 如果没有子节点或处理完毕，返回 null，表示该分支已完成，应回溯到父节点。
 */
export function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  // 检查组件是否需要重新渲染。
  // 这是 bailout 优化的核心逻辑。
  // 通过检查 props、context、更新队列等，决定是否需要重新渲染组件。
  if (current !== null) {
    // 更新（Update）。
    // 条件：current !== null（有旧 Fiber）。
    // 说明：这是组件的更新阶段，需要检查是否需要重新渲染。

    // 获取旧的 props 和新的 props。
    const oldProps = current.memoizedProps
    const newProps = workInProgress.pendingProps

    if (oldProps !== newProps) {
      // props 改变了，需要重新渲染。

      // 标记当前 Fiber 节点"接收到更新"，决定不执行 bailout（跳过渲染）！
      didReceiveUpdate = true
    } else {
      // props 没有改变，检查是否有其他需要更新的因素。

      // 检查是否有待处理的更新或 Context 变化。
      // 这个函数会检查：
      //   1. 是否有待处理的更新。
      //   2. 是否有 Context 变化。
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLanes
      )
      // 检查是否需要 bailout（跳过渲染）。
      //   条件 1：没有待处理的更新或 Context 变化。
      //   条件 2：没有捕获错误（Error Boundary 相关）。
      if (
        !hasScheduledUpdateOrContext &&
        (workInProgress.flags & DidCapture) === NoFlags
      ) {
        // 没有需要更新的因素，执行 bailout！

        // 标记当前 Fiber 节点没有"接收到更新"，决定执行 bailout（跳过渲染）！
        didReceiveUpdate = false
        // 执行 bailout。
        // 这个函数会：
        //   1. 检查子树是否有待处理的更新。
        //   2. 如果没有，返回 null（完全跳过）。
        //   3. 如果有，克隆子 Fiber，继续处理。
        return attemptEarlyBailoutIfNoScheduledUpdate(
          current,
          workInProgress,
          renderLanes
        )
      }

      // 此状态下，先标记当前 Fiber 节点没有"接收到更新"。
      // 让 update queue 或 context consumer 决定是否更新。
      didReceiveUpdate = false
    }
  } else {
    // 挂载（Mount）。
    // 条件：current === null（没有旧 Fiber）。
    // 说明：这是组件的首次渲染，需要渲染。

    // 在首次渲染中：didReceiveUpdate 没有作用，不会检查 didReceiveUpdate，不会 bailout，一定会渲染。
    // 首次渲染，标记为"没有接收到更新"。
    didReceiveUpdate = false
  }

  // 在进入开始阶段之前，清除待处理的更新优先级。
  // workInProgress.lanes 只代表当前两次渲染期间该节点新触发的 Lanes。它不包含上一轮或更早之前遗留下来的 Lanes。
  workInProgress.lanes = NoLanes

  let Component
  let type
  let unresolvedProps
  let resolvedProps
  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      return mountIndeterminateComponent(
        current,
        workInProgress,
        workInProgress.type,
        renderLanes
      )
    }
    // TODO: 暂不实现。
    // case LazyComponent:
    case FunctionComponent:
      // 获取当前 Fiber 节点对应的组件类型（即函数组件本身）。
      Component = workInProgress.type
      // workInProgress.pendingProps：待处理的 Props（也就是父组件传过来、并在 createElement 阶段经过默认值合并处理的 Props）。
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        workInProgress.pendingProps,
        renderLanes
      )
    case ClassComponent:
      // 注释如 case FunctionComponent:
      Component = workInProgress.type
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        workInProgress.pendingProps,
        renderLanes
      )
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes)
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes)
    case HostText:
      return updateHostText(current, workInProgress)
    // TODO: 暂不实现。
    // case SuspenseComponent:
    // case HostPortal:
    // case ForwardRef:
    case Fragment:
      return updateFragment(current, workInProgress, renderLanes)
    // TODO: 暂不实现。
    // case Mode:
    // case Profiler:
    case ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes)
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress, renderLanes)
    // 在使用 memo() 时，尽量不要定义 defaultProps 或自定义 compare 函数。
    // 因为一旦定义了这些，React 就无法将其降级为 SimpleMemoComponent，就必须白白承受那一层额外 Fiber 节点带来的内存开销！
    // 在 TSX/JSX 解析阶段，只会生成 MemoComponent，不会直接生成 SimpleMemoComponent。

    // 在 React 源码中，workInProgress.tag 究竟是 MemoComponent 还是 SimpleMemoComponent，完全取决于首次挂载（Mount）时该组件是否满足“极简优化”的严苛条件。
    // 1. 什么时候是 SimpleMemoComponent？
    //   只有当被 memo() 包裹的组件同时满足以下所有苛刻条件时，React 才会将其 tag 改写为 SimpleMemoComponent：
    //   是简单函数组件：它是一个纯粹的函数组件（没有原型链上的 isReactComponent 属性，通常是箭头函数）。
    //   无默认属性：组件没有定义 defaultProps。
    //   无自定义比较函数：在使用 memo(Component, compare) 时，没有传入第二个参数 compare（即使用的是默认的浅比较 shallowEqual）。
    // 2. 什么时候是 MemoComponent？
    //   只要不满足上述任何一个条件，该节点的 tag 就会保持为 MemoComponent。具体包括以下几种常见场景：
    //   传入了自定义的比较函数（例如 memo(Component, (prev, next) => prev.id === next.id)）。
    //   组件配置了 defaultProps。
    //   被包裹的不是一个简单的函数组件（例如是一个 Class 组件，或者被其他高阶组件嵌套过）。
    case MemoComponent:
      // 获取当前 workInProgress 节点的 type。
      // 对于 MemoComponent 来说，这个 type 并不是真正的业务函数，而是 React.memo() 返回的那个包装对象（内部包含 $$typeof, compare, type 等属性）。
      type = workInProgress.type
      // 为什么普通函数/类组件不需要调用 resolveDefaultProps()？
      //   普通函数/类组件在 createElement 阶段已经合并了 defaultProps，
      //   到达 reconciler 时，pendingProps 已经包含了 defaultProps，所以不需要调用 resolveDefaultProps()。
      // 为什么包装组件需要调用 resolveDefaultProps()？
      //   包装组件在 createElement 阶段没有做默认属性值的合并操作，所以包装组件，需要调用 resolveDefaultProps()。
      //   而且包装组件不仅要合并一次默认属性值，还要连续合并内两层外层的默认属性值，一共要合并两次。

      // 获取待处理的原始 Props（即父组件传递过来的、尚未合并默认值的 Props）。
      unresolvedProps = workInProgress.pendingProps
      // 【第一层解析】解析【外层 memo 包装器】的默认属性。
      // 虽然在日常开发中极少给 memo 本身设置 defaultProps，但为了兼容复杂的嵌套场景，React 会先检查外层包装器是否有 defaultProps 并进行合并。
      resolvedProps = resolveDefaultProps(type, unresolvedProps)
      // 【第二层解析】解析【内层真实业务组件】的默认属性。
      // type.type 是真正的业务组件本体。
      // 如果真实的业务组件定义了 defaultProps，就需要在这里进行二次合并，确保最终传给函数的 props 包含了所有层级的默认值。
      resolvedProps = resolveDefaultProps(type.type, resolvedProps)
      return updateMemoComponent(
        current,
        workInProgress,
        type,
        resolvedProps,
        renderLanes
      )
    case SimpleMemoComponent:
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes
      )
    // TODO: 暂不实现。
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

/**
 * 更新根节点（HostRoot）的核心逻辑。
 *
 * @description
 * HostRootFiber 是整棵 React Fiber 树的入口。它的主要职责是：
 * 1. 消费挂载在根节点上的更新队列，计算出最新的子元素（通常是 <App />）。
 * 2. 将新旧子元素进行 Diff 比对（协调），生成下一轮的 workInProgress 子树。
 */
function updateHostRoot(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  // 将根容器的上下文压入栈中。
  pushHostRootContext(workInProgress)

  // 【防御性校验】HostRootFiber 必定有对应的 current 节点。如果没有，说明内部状态出现了严重异常。
  if (current === null) {
    throw new Error('Should have a current fiber. This is a bug in React.')
  }

  // ===================== 提取历史状态与准备数据 =====================
  // 待处理的 props（对于 HostRoot 通常为 null）。
  const nextProps = workInProgress.pendingProps
  // 上一次渲染完成后的最终状态（包含旧的 element 等）。
  const prevState = workInProgress.memoizedState
  // 提取出上一轮渲染留下的 React Element 对象（即旧的 <App />）。
  //   React Element 对象：JSX 元素被解析之后的对象。
  const prevChildren = prevState.element

  // ===================== 安全地计算最新状态 =====================
  // 克隆更新队列，确保本轮 render 不会污染当前页面上的 current tree。
  cloneUpdateQueue(current, workInProgress)
  // 遍历刚刚克隆过来的 workInProgress.updateQueue，根据里面排队的更新对象（Update）和优先级（renderLanes），一步步计算出最终的最新状态（newState）。
  //   当在入口文件调用 root.render(<App />) 时，这个 <App /> 其实就是一个特殊的更新对象，它正藏在 updateQueue 里（update.payload = { element }）。
  //   processUpdateQueue 会把它取出来，赋值给 workInProgress.memoizedState.element。
  processUpdateQueue(workInProgress, nextProps, null, renderLanes)

  // ===================== 提取最新状态 =====================
  // 获取刚刚计算出的最新状态。
  const nextState: RootState = workInProgress.memoizedState
  // 获取真实的根容器实例。
  const root: FiberRoot = workInProgress.stateNode

  // 从新状态中提取出本次需要渲染的最新子元素（React Element）。
  const nextChildren = nextState.element

  // ===================== 性能优化（Bailout）=====================
  // 如果新旧子元素的引用完全相同，说明没有任何更新发生，可以直接跳过后续的 Diff 流程。
  if (nextChildren === prevChildren) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
  }

  // ===================== 核心协调（Reconcile）=====================
  // 拿着最新的 React Element（nextChildren）和旧的 Fiber 节点进行 Diff 对比，从而复用、创建或标记删除对应的 Fiber 节点。
  reconcileChildren(current, workInProgress, nextChildren, renderLanes)

  // 返回新生成的子树头节点，以便 React 继续向下深度优先遍历（beginWork）。
  return workInProgress.child
}

function updateHostComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  // 在 beginWork 阶段，压入当前宿主元素的上下文信息。
  pushHostContext(workInProgress)

  const type = workInProgress.type
  const nextProps = workInProgress.pendingProps
  const prevProps = current !== null ? current.memoizedProps : null

  let nextChildren = nextProps.children
  const isDirectTextChild = shouldSetTextContent(type, nextProps)
  if (isDirectTextChild) {
    // 如果原生标签的子节点只有一个文本节点，这个时候文本节点不会再生成对应的 Fiber 节点，而是直接作为属性保存在父 Fiber 的 memoizedProps 中。
    // completeWork 阶段：在 finalizeInitialChildren 中，直接将文本设置为 DOM 元素的 textContent。
    nextChildren = null
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    // 标记这个 Fiber 需要重置 textContent，在 commit 阶段，会把之前的文本清空，再插入新的子节点。
    workInProgress.flags |= ContentReset
  }

  reconcileChildren(current, workInProgress, nextChildren, renderLanes)
  return workInProgress.child
}

function updateHostText(current: Fiber | null, workInProgress: Fiber): null {
  return null
}

export function markWorkInProgressReceivedUpdate(): void {
  didReceiveUpdate = true
}

function finishClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  shouldUpdate: boolean,
  hasContext: boolean,
  renderLanes: Lanes
): Fiber | null {
  // 检查组件是否捕获了错误（用于错误边界 Error Boundary）。
  const didCaptureError = (workInProgress.flags & DidCapture) !== NoFlags

  if (!shouldUpdate && !didCaptureError) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
  }

  const instance = workInProgress.stateNode

  ReactCurrentOwner.current = workInProgress

  let nextChildren
  if (
    didCaptureError &&
    typeof Component.getDerivedStateFromError !== 'function'
  ) {
    // 强制卸载所有子组件。
    nextChildren = null
  } else {
    // 正常渲染。
    nextChildren = instance.render()
  }

  // 这里的 current 一定不为 null。
  if (current !== null && didCaptureError) {
    // 实现，略。
    // // 强制卸载旧的子节点，然后重新协调新的子节点（用于错误恢复场景）。
    // forceUnmountCurrentAndReconcile(
    //   current,
    //   workInProgress,
    //   nextChildren,
    //   renderLanes
    // )
  } else {
    reconcileChildren(current, workInProgress, nextChildren, renderLanes)
  }

  // Memoize state using the values we just used to render.
  // TODO: Restructure so we never read values from the instance.
  workInProgress.memoizedState = instance.state

  return workInProgress.child
}
function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): Fiber | null {
  // 为当前组件读取 Context 做准备，设置好上下文环境，让组件可以访问父级提供的 Context 值。
  prepareToReadContext(workInProgress, renderLanes)

  const instance = workInProgress.stateNode

  // 处理 Class Component 的实例，根据组件的不同状态（首次挂载、恢复挂载、正常更新）执行不同的逻辑。
  // 记录 Class Component 是否需要更新（重新渲染）。
  let shouldUpdate: boolean
  if (instance === null) {
    // 首次挂载。还没有实例。

    // 创建类实例。
    //   调用构造函数：new Component(props, context)。设置 state、props 等。
    constructClassInstance(workInProgress, Component, nextProps)

    // 挂载实例。
    //   处理初始 state。设置 refs。
    mountClassInstance(workInProgress, Component, nextProps, renderLanes)

    shouldUpdate = true
  } else if (current === null) {
    // 并发渲染中“首次挂载”被中断后恢复。实例已经存在，但需要重新挂载。
    //
    // // 恢复挂载：并发渲染被中断后恢复，实例已存在但首次渲染未完成。
    // // 检查 props/state/context 是否变化，决定是否需要重新渲染。
    // shouldUpdate = resumeMountClassInstance(
    //   workInProgress,
    //   Component,
    //   nextProps,
    //   renderLanes
    // )
  } else {
    // 正常更新（state 变化、props 变化、forceUpdate）。current 和 instance 都存在。

    // 处理 Class Component 的正常更新，当组件已经有实例且不是首次渲染时调用。
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      Component,
      nextProps,
      renderLanes
    )
  }

  // 完成 Class Component 的渲染工作，调用组件的 render 方法并协调子元素。
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate!,
    false,
    renderLanes
  )
  return nextUnitOfWork
}

/**
 * 挂载不确定的组件
 *
 * 作用：
 * - 首次渲染函数组件
 * - 确定组件类型（函数组件）
 * - 渲染组件内容
 * - 协调子节点
 *
 * @param current - 旧 Fiber（挂载时为 null）
 * @param workInProgress - 新 Fiber
 * @param Component - 组件类型
 * @param renderLanes - 渲染优先级
 * @returns 子 Fiber 或 null
 */
function mountIndeterminateComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  renderLanes: Lanes
): Fiber | null {
  // 获取 props。
  const props = workInProgress.pendingProps
  // 为当前组件读取 Context 做准备。
  prepareToReadContext(workInProgress, renderLanes)
  // 渲染函数组件。value 是组件渲染的结果（React 元素）。
  const value = renderWithHooks(
    null,
    workInProgress,
    Component,
    props,
    undefined,
    renderLanes
  )
  // 设置组件类型为函数组件。
  workInProgress.tag = FunctionComponent
  // 协调子节点。
  reconcileChildren(null, workInProgress, value, renderLanes)
  // 返回子 Fiber。
  return workInProgress.child
}

function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): Fiber | null {
  // 重置组件的 Context 依赖列表，并根据是否启用惰性传播来决定如何检查 Context 更新。
  prepareToReadContext(workInProgress, renderLanes)

  // 调用函数组件，并处理所有 Hooks（useState、useEffect、useContext 等）。
  // nextChildren：组件渲染返回的子节点（React 元素数组或 null）。
  const nextChildren: ReactNodeList = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    undefined,
    renderLanes
  )

  // 对 Hooks 进行 Bail Out 优化，当组件没有更新时跳过不必要的 Hooks 处理。
  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes)
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
  }

  reconcileChildren(current, workInProgress, nextChildren, renderLanes)
  return workInProgress.child
}

function updateFragment(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const nextChildren = workInProgress.pendingProps
  reconcileChildren(current, workInProgress, nextChildren, renderLanes)
  return workInProgress.child
}

function updateContextProvider(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const providerType: ReactProviderType<any> = workInProgress.type
  const context: ReactContext<any> = providerType._context

  const newProps = workInProgress.pendingProps
  const oldProps = workInProgress.memoizedProps

  const newValue = newProps.value

  pushProvider(workInProgress, context, newValue)

  if (oldProps !== null) {
    const oldValue = oldProps.value
    if (is(oldValue, newValue)) {
      // 无变化。若子女情况相同，则提前 bailout。
      if (oldProps.children === newProps.children) {
        return bailoutOnAlreadyFinishedWork(
          current,
          workInProgress,
          renderLanes
        )
      }
    } else {
      // 有变化。搜索匹配的消费者并安排他们进行更新。
      propagateContextChange(workInProgress, context, renderLanes)
    }
  }

  const newChildren = newProps.children
  reconcileChildren(current, workInProgress, newChildren, renderLanes)
  return workInProgress.child
}

// const ThemeContext = React.createContext('light')
// function App() {
//   return (
//     <ThemeContext.Consumer>
//       {(value) => <div>当前主题: {value}</div>}  {/* ← children 是函数 */}
//     </ThemeContext.Consumer>
//   )
// }
function updateContextConsumer(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const context: ReactContext<any> = workInProgress.type

  const newProps = workInProgress.pendingProps
  const render = newProps.children

  prepareToReadContext(workInProgress, renderLanes)
  const newValue = readContext(context)
  const newChildren = render(newValue)

  reconcileChildren(current, workInProgress, newChildren, renderLanes)
  return workInProgress.child
}

function checkScheduledUpdateOrContext(
  current: Fiber,
  renderLanes: Lanes
): boolean {
  const updateLanes = current.lanes
  if (includesSomeLane(updateLanes, renderLanes)) {
    return true
  }
  return false
}

function updateMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): Fiber | null {
  if (current === null) {
    // 首次挂载阶段。

    // Component.type 是被 memo 包装的原始组件，可以是：函数组件、Class 组件、ForwardRef 组件、其他 memo 组件。
    const type = Component.type
    // 优化路径：如果原始组件是一个没有自定义比较函数、没有 defaultProps 的简单函数组件，
    // 则将其标记为 SimpleMemoComponent，后续渲染会走更轻量的逻辑。
    if (
      isSimpleFunctionComponent(type) &&
      Component.compare === null &&
      Component.defaultProps === undefined
    ) {
      let resolvedType = type
      workInProgress.tag = SimpleMemoComponent
      workInProgress.type = resolvedType
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        resolvedType,
        nextProps,
        renderLanes
      )
    }
    // 非简单函数组件：直接从类型和属性创建一个新的子 Fiber，并建立父子关系。
    const child = createFiberFromTypeAndProps(
      Component.type,
      null,
      nextProps,
      workInProgress,
      workInProgress.mode,
      renderLanes
    )
    child.ref = workInProgress.ref
    child.return = workInProgress
    workInProgress.child = child
    return child
  }

  // 更新阶段。

  // Memo 组件在正常情况下永远只有一个子节点（即被包装的原始组件）。
  const currentChild = current.child as Fiber
  // 检查当前组件是否有被调度的更新。
  const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
    current,
    renderLanes
  )
  // 如果没有待处理的更新，则进行 props 比较。
  if (!hasScheduledUpdateOrContext) {
    const prevProps = currentChild.memoizedProps
    let compare = Component.compare
    // 获取比较函数，如果没有自定义 compare，则默认使用浅比较（shallowEqual）。
    compare = compare !== null ? compare : shallowEqual
    // 如果 props 相等且 ref 没有改变，说明组件不需要重新渲染，直接跳过（Bailout）。
    if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
    }
  }

  // 需要重新渲染：复用旧的子 Fiber 节点并更新其 props，建立新的父子关系。
  const newChild = createWorkInProgress(currentChild, nextProps)
  newChild.ref = workInProgress.ref
  newChild.return = workInProgress
  workInProgress.child = newChild
  return newChild
}

// SimpleMemoComponent 的 Fiber 结构。
//   {
//     tag: SimpleMemoComponent,
//     type: () => <div>函数组件</div>,  // ← 原始函数组件。
//     // ...
//   }
// SimpleMemoComponent 本质上就是函数组件。SimpleMemoComponent 只是一个优化标记，实际渲染逻辑和函数组件完全一样。
function updateSimpleMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
): null | Fiber {
  if (current !== null) {
    const prevProps = current.memoizedProps
    if (
      shallowEqual(prevProps, nextProps) &&
      current.ref === workInProgress.ref
    ) {
      didReceiveUpdate = false

      // props 内容没变（浅比较相等），就复用之前的对象，而不是用新的。
      workInProgress.pendingProps = nextProps = prevProps

      if (!checkScheduledUpdateOrContext(current, renderLanes)) {
        // TODO: 为什么会存在这行代码，还没搞懂。
        workInProgress.lanes = current.lanes
        return bailoutOnAlreadyFinishedWork(
          current,
          workInProgress,
          renderLanes
        )
      }
    }
  }
  return updateFunctionComponent(
    current,
    workInProgress,
    Component,
    nextProps,
    renderLanes
  )
}

export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
): void {
  if (current === null) {
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderLanes
    )
  } else {
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes
    )
  }
}

/**
 * 将根容器的上下文压入栈中
 *
 * 作用：
 * - 将根容器信息压入 HostContainer 栈
 * - 确保后续渲染可以知道当前渲染到哪个容器
 *
 * @param workInProgress - 新 Fiber
 */
function pushHostRootContext(workInProgress: Fiber): void {
  // 获取根 Fiber 的 stateNode（即 FiberRoot）。
  const root = workInProgress.stateNode as FiberRoot
  // 将根容器压入 HostContainer 栈。
  // root.containerInfo 是实际的 DOM 容器。
  // 例如：document.getElementById('root')。
  //
  // 这样在后续的渲染过程中：
  //   可以知道当前渲染到哪个容器。
  //   创建的 DOM 元素会挂载到这个容器中。
  pushHostContainer(workInProgress, root.containerInfo)
}

/**
 * 尝试提前 bailout（跳过渲染）
 *
 * 作用：
 * - 当 Fiber 没有待处理的更新时，提前 bailout
 * - 不进入 beginWork 阶段
 * - 但仍需要做簿记工作（如上下文压栈）
 *
 * 主要流程：
 * 1. 根据 Fiber 类型，将上下文压入栈中
 * 2. 调用 bailoutOnAlreadyFinishedWork
 *
 * 为什么需要压栈？
 * - 即使 bailout，子组件可能还需要这些上下文
 * - 必须在 completeWork 中正确 pop 栈
 *
 * @param current - 当前 Fiber 节点（旧的）
 * @param workInProgress - 新 Fiber 节点
 * @param renderLanes - 渲染车道
 * @returns bailout 后的子节点
 */
function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  // 当前 Fiber 没有待处理的工作。
  // 直接 bailout，不进入 begin 阶段。
  // 但仍需要做一些簿记工作。
  // 主要是将上下文压入栈中（如 pushHostContext、pushHostRootContext 等）。

  switch (workInProgress.tag) {
    case HostRoot:
      pushHostRootContext(workInProgress)
      break
    case HostComponent:
      pushHostContext(workInProgress)
      break
    case ClassComponent:
      break
    // TODO: 暂不实现。
    // case HostPortal:
    case ContextProvider: {
      const newValue = workInProgress.memoizedProps.value
      const context: ReactContext<any> = workInProgress.type._context
      pushProvider(workInProgress, context, newValue)
      break
    }
    // TODO: 暂不实现。
    // case Profiler:
    // case SuspenseComponent:
    // case SuspenseListComponent:
    // case OffscreenComponent:
    // case CacheComponent:
  }
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
}

/**
 * Bailout 优化：跳过已经完成的工作
 *
 * 核心作用：
 * 当发现当前 Fiber 节点及其子树都不需要更新时，跳过整个渲染工作，提升性能。
 *
 * 执行逻辑：
 * 1. 复用 current 的 Context 依赖（不需要重新收集）
 * 2. 标记被跳过的更新优先级
 * 3. 检查子节点是否有待处理的工作：
 *    - 子节点没有工作 → 返回 null（跳过整棵子树）
 *    - 子节点有工作 → 克隆子 Fiber，返回第一个子节点（继续协调）
 *
 * 使用场景：
 * - props、state、context 都没变化
 * - shouldComponentUpdate 返回 false
 * - PureComponent 的浅比较通过
 *
 * @param current - 上一次的 Fiber 节点（双缓冲的旧节点）
 * @param workInProgress - 当前正在构建的 Fiber 节点
 * @param renderLanes - 当前渲染的优先级车道
 * @returns
 *   - null: 当前节点和子树都不需要更新，跳过
 *   - workInProgress.child: 当前节点不需要更新，但子节点需要，继续处理子节点
 */
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  // 复用之前的依赖。
  if (current !== null) {
    workInProgress.dependencies = current.dependencies
  }

  markSkippedUpdateLanes(workInProgress.lanes)

  // 检查孩子们是否有任何待完成的工作。
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // 孩子们也没有任何工作要做。我们可以跳过他们。
    return null
  }

  // 这个 fiber 没有任务，但它的子树有。克隆子 fiber 并继续。
  cloneChildFibers(current, workInProgress)
  return workInProgress.child
}
