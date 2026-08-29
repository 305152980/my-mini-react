import {
  type ReactElement,
  type ReactFragment,
} from '@my-mini-react/shared/ReactTypes'
import { type Fiber } from './ReactInternalTypes'
import { NoFlags, StaticMask } from './ReactFiberFlags'
import {
  ClassComponent,
  Fragment,
  HostComponent,
  HostText,
  IndeterminateComponent,
  ContextProvider,
  ContextConsumer,
  type WorkTag,
  MemoComponent,
  HostRoot,
} from './ReactWorkTags'
import {
  REACT_FRAGMENT_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_MEMO_TYPE,
} from '@my-mini-react/shared/ReactSymbols'
import { NoLanes, type Lanes } from './ReactFiberLane'
import { type TypeOfMode, ConcurrentMode } from './ReactTypeOfMode'
import { type RootTag, ConcurrentRoot } from './ReactRootTags'

type FiberCtor = new (
  tag: WorkTag,
  pendingProps: unknown,
  key: string | null,
  mode: TypeOfMode
) => Fiber
const FiberNode: FiberCtor = function (
  this: Fiber,
  tag: WorkTag,
  pendingProps: unknown,
  key: null | string,
  mode: TypeOfMode
): void {
  // Instance
  this.tag = tag
  this.key = key
  this.elementType = null
  this.type = null
  this.stateNode = null

  // Fiber
  this.return = null
  this.child = null
  this.sibling = null
  this.index = 0

  this.ref = null

  this.pendingProps = pendingProps
  this.memoizedProps = null
  this.updateQueue = null
  this.memoizedState = null
  this.dependencies = null

  this.mode = mode

  // Effects
  this.flags = NoFlags
  this.subtreeFlags = NoFlags
  this.deletions = null

  this.lanes = NoLanes
  this.childLanes = NoLanes

  this.alternate = null
} as unknown as FiberCtor

function createFiber(
  tag: WorkTag,
  pendingProps: unknown,
  key: null | string,
  mode: TypeOfMode
): Fiber {
  return new FiberNode(tag, pendingProps, key, mode)
}

// TODO: 源码中是没给这个方法设置入参默认值的。
export function createHostRootFiber(
  tag: RootTag = ConcurrentRoot,
  isStrictMode: boolean = false,
  concurrentUpdatesByDefaultOverride: null | boolean = null
): Fiber {
  let mode
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode
  }
  return createFiber(HostRoot, null, null, mode!)
}

/**
 * 创建或复用 workInProgress Fiber 节点
 *
 * 核心功能：
 * - 实现 Fiber 的双缓冲机制（Double Buffering）
 * - Mount 阶段：创建新的 workInProgress Fiber
 * - Update 阶段：复用已有的 workInProgress Fiber
 *
 * 双缓冲机制：
 * - current 树：当前显示在屏幕上的 Fiber 树
 * - workInProgress 树：正在构建的新 Fiber 树
 * - 通过 alternate 指针连接两棵树
 *
 * 处理流程：
 * 1. 检查 current.alternate 是否存在
 *    - 不存在 → Mount 阶段，创建新 Fiber
 *    - 存在 → Update 阶段，复用已有 Fiber
 *
 * 2. 拷贝/重置属性
 *    - 基础属性（tag、key、mode 等）
 *    - 副作用标志（flags、subtreeFlags）
 *    - 状态属性（memoizedProps、memoizedState 等）
 *
 * 3. 建立双缓冲链接
 *    - workInProgress.alternate = current
 *    - current.alternate = workInProgress
 *
 * @param current 当前 Fiber 节点
 * @param pendingProps 待处理的 props
 * @returns workInProgress Fiber 节点
 */
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate

  if (workInProgress === null) {
    // 【Mount 阶段】首次渲染，需要创建全新的 workInProgress 节点。

    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    )
    // 拷贝不可变的基础属性。
    workInProgress.elementType = current.elementType
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode

    // 建立双缓冲（Double Buffering）的双向链接。
    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    // 【Update 阶段】复用已有的 workInProgress 节点。

    workInProgress.pendingProps = pendingProps
    // Needed because Blocks store data on type.
    workInProgress.type = current.type

    // 必须重置上一轮遗留的副作用标记，防止污染本轮渲染。
    workInProgress.flags = NoFlags
    workInProgress.subtreeFlags = NoFlags
    workInProgress.deletions = null
  }
  // Reset all effects except static ones. Static effects are not specific to a render.
  workInProgress.flags = current.flags & StaticMask
  // 继承 current 的 lanes（历史积累的更新优先级）。
  workInProgress.childLanes = current.childLanes
  workInProgress.lanes = current.lanes

  // 【公共属性拷贝】无论创建还是复用，以下属性都需要从 current 继承过来。
  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.updateQueue = current.updateQueue

  // Clone the dependencies object. This is mutated during the render phase, so
  // it cannot be shared with the current fiber.
  // 在 render 阶段，当组件调用 useContext 读取 Context 值时，React 会修改 workInProgress.dependencies（追加新的依赖、更新 lanes 等）。
  // 如果不拷贝，workInProgress.dependencies 和 current.dependencies 指向同一个对象，render 阶段的修改会污染 current 树（当前屏幕上正在显示的旧树）。
  const currentDependencies = current.dependencies
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          lanes: currentDependencies.lanes,
          firstContext: currentDependencies.firstContext,
        }

  // These will be overridden during the parent's reconciliation
  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  workInProgress.ref = current.ref

  return workInProgress
}

/**
 * 根据类型和 props 创建 Fiber 节点
 *
 * 核心功能：
 * - 根据 type 确定 Fiber 的 tag（类型）
 * - 创建对应的 Fiber 节点
 *
 * 处理逻辑：
 * 1. 函数类型：
 *    - Class 组件（有 new.target）→ ClassComponent
 *    - 函数组件（无 new.target）→ IndeterminateComponent（延迟确定）
 *
 * 2. 字符串类型：
 *    - DOM 元素（如 "div"、"span"）→ HostComponent
 *
 * 3. 特殊类型（switch）：
 *    - Fragment → 直接创建 Fragment Fiber
 *    - Provider → ContextProvider
 *    - Consumer → ContextConsumer
 *    - Memo → MemoComponent
 *
 * 4. 无效类型：
 *    - 抛出错误
 *
 * @param type 组件类型（函数、字符串、对象等）
 * @param key React 元素的 key
 * @param pendingProps 待处理的 props
 * @param owner 拥有者 Fiber
 * @param mode Fiber 模式（ConcurrentMode、StrictMode 等）
 * @param lanes 优先级车道
 * @returns 新创建的 Fiber 节点
 */
export function createFiberFromTypeAndProps(
  type: any,
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  // 默认是 IndeterminateComponent（未确定类型）。
  // 函数组件在创建时使用的是 IndeterminateComponent，而不是 FunctionComponent！
  let fiberTag: WorkTag = IndeterminateComponent
  // 解析后的类型。
  let resolvedType = type

  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent
    } else {
      // 函数组件：保持 IndeterminateComponent。
      // fiberTag = IndeterminateComponent
    }
  } else if (typeof type === 'string') {
    fiberTag = HostComponent
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(pendingProps.children, mode, lanes, key)
      // TODO: 待实现。
      // case REACT_STRICT_MODE_TYPE:
      // case REACT_PROFILER_TYPE:
      // case REACT_SUSPENSE_TYPE:
      // case REACT_SUSPENSE_LIST_TYPE:
      // case REACT_OFFSCREEN_TYPE:
      default: {
        if (typeof type === 'object' && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = ContextProvider
              break getTag
            case REACT_CONTEXT_TYPE:
              fiberTag = ContextConsumer
              break getTag
            // TODO: 待实现。
            // case REACT_FORWARD_REF_TYPE:
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent
              break getTag
            // TODO: 待实现。
            // case REACT_LAZY_TYPE:
          }
        }

        // 无效类型，抛出错误。
        let info = ''
        throw new Error(
          'Element type is invalid: expected a string (for built-in ' +
            'components) or a class/function (for composite components) ' +
            `but got: ${type == null ? type : typeof type}.${info}`
        )
      }
    }
  }

  // 创建 Fiber 节点。
  const fiber = createFiber(fiberTag, pendingProps, key, mode)
  fiber.elementType = type
  fiber.type = resolvedType
  fiber.lanes = lanes

  return fiber
}

/**
 * 从 React 元素创建 Fiber 节点
 *
 * 核心功能：
 * - 从 React 元素（ReactElement）创建对应的 Fiber 节点
 * - 提取元素的关键属性（type、key、props）
 * - 调用 createFiberFromTypeAndProps 创建 Fiber
 *
 * 处理流程：
 * 1. 提取 React 元素的关键属性：
 *    - type：组件类型（函数、字符串、对象等）
 *    - key：React 元素的 key
 *    - props：元素的 props
 *
 * 2. 调用 createFiberFromTypeAndProps：
 *    - 根据 type 确定 Fiber 的 tag
 *    - 创建对应的 Fiber 节点
 *
 * @param element React 元素（如 <div />、<MyComponent />）
 * @param mode Fiber 模式（ConcurrentMode、StrictMode 等）
 * @param lanes 优先级车道
 * @returns 新创建的 Fiber 节点
 */
export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  let owner = null
  const type = element.type
  const key = element.key
  const pendingProps = element.props
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    owner,
    mode,
    lanes
  )
  return fiber
}

export function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  const fiber = createFiber(HostText, content, null, mode)
  fiber.lanes = lanes
  return fiber
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode)
  fiber.lanes = lanes
  return fiber
}

function shouldConstruct(Component: Function): boolean {
  const prototype = Component.prototype
  return !!(prototype && prototype.isReactComponent)
}

export function isSimpleFunctionComponent(type: any): boolean {
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  )
}
