import { type ReactElement } from '@my-mini-react/shared/ReactTypes'
import { type Fiber } from './ReactInternalTypes'
import { NoFlags } from './ReactFiberFlags'
import {
  ClassComponent,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostText,
  IndeterminateComponent,
  ContextProvider,
  ContextConsumer,
  type WorkTag,
  MemoComponent,
} from './ReactWorkTags'
import { isStr, isFn } from '@my-mini-react/shared/utils'
import {
  REACT_FRAGMENT_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_MEMO_TYPE,
} from '@my-mini-react/shared/ReactSymbols'
import { NoLanes } from './ReactFiberLane'

/**
 * 创建 Fiber 节点的核心方法
 * @param tag - Fiber 节点类型（WorkTag）
 * @param pendingProps - 待处理的属性
 * @param key - 列表 diff 用的 key
 * @returns 新的 Fiber 实例
 */
export function createFiber(
  tag: WorkTag,
  pendingProps: any,
  key: null | string
): Fiber {
  return new FiberNode(tag, pendingProps, key)
}

type FiberCtor = new (
  tag: WorkTag,
  pendingProps: unknown,
  key: string | null
) => Fiber
const FiberNode: FiberCtor = function (
  this: Fiber,
  tag: WorkTag,
  pendingProps: unknown,
  key: null | string
): void {
  this.tag = tag
  this.key = key
  this.elementType = null
  this.type = null
  this.stateNode = null
  this.return = null
  this.child = null
  this.sibling = null
  this.index = 0
  this.pendingProps = pendingProps
  this.memoizedProps = null
  this.memoizedState = null
  this.flags = NoFlags
  this.alternate = null
  this.deletions = null
  this.updateQueue = null
  this.lanes = NoLanes
  this.childLanes = NoLanes
} as unknown as FiberCtor

/**
 * 根据 type 和 props 创建 Fiber 节点
 * 自动判断是原生 DOM 组件还是自定义组件
 * @param type - 元素类型（div / 函数组件）
 * @param key - key
 * @param pendingProps - 属性
 * @returns 构建好的 Fiber
 */
export function createFiberFromTypeAndProps(
  type: any,
  key: null | string,
  pendingProps: any
): Fiber {
  let fiberTag: WorkTag = IndeterminateComponent
  if (isFn(type)) {
    if (type.prototype.isReactComponent) {
      fiberTag = ClassComponent
    } else {
      fiberTag = FunctionComponent
    }
  } else if (isStr(type)) {
    fiberTag = HostComponent
  } else {
    if (typeof type === 'object' || type !== null) {
      switch (type.$$typeof) {
        case REACT_PROVIDER_TYPE:
          fiberTag = ContextProvider
          break
        case REACT_CONTEXT_TYPE:
          fiberTag = ContextConsumer
          break
        case REACT_MEMO_TYPE:
          fiberTag = MemoComponent
          break
        // TODO: REACT_FORWARD_REF_TYPE、REACT_LAZY_TYPE。
      }
    } else {
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          fiberTag = Fragment
          break
        // TODO: 其他内置组件类型（如 Suspense、Profiler 等）可以在这里继续添加 case 分支。
      }
    }
  }
  const fiber = createFiber(fiberTag, pendingProps, key)
  fiber.elementType = type
  fiber.type = type
  return fiber
}

/**
 * 从 ReactElement 创建 Fiber 节点
 * 协调阶段的核心入口方法
 * @param element - JSX 转换后的虚拟 DOM 对象
 * @returns 可用于渲染的 Fiber 节点
 */
export function createFiberFromElement(element: ReactElement): Fiber {
  const { type, key, props: pendingProps } = element
  const fiber = createFiberFromTypeAndProps(type, key, pendingProps)
  return fiber
}

export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate
  if (workInProgress === null) {
    workInProgress = createFiber(current.tag, pendingProps, current.key)
    workInProgress.elementType = current.elementType
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode
    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    workInProgress.pendingProps = pendingProps
    workInProgress.type = current.type
    workInProgress.flags = NoFlags
  }
  workInProgress.flags = current.flags
  workInProgress.childLanes = current.childLanes
  workInProgress.lanes = current.lanes
  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.updateQueue = current.updateQueue
  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  return workInProgress
}

export function createFiberFromText(content: string): Fiber {
  const fiber = createFiber(HostText, content, null)
  return fiber
}

function shouldConstruct(Component: Function): boolean {
  const prototype = Component.prototype
  return !!prototype && prototype.isReactComponent
}

export function isSimpleFunctionComponent(type: any): boolean {
  // 在 React 中，defaultProps 是组件的一个属性（通常是一个对象），用来定义 props 的默认值。
  //   如果组件定义了默认参数，type.defaultProps 会是一个对象（例如 { name: 'Guest' }）。
  //   如果组件没有定义默认参数，type.defaultProps 的值就是 undefined。
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  )
}
