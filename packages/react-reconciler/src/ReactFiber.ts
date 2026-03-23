import { type ReactElement } from '@my-mini-react/shared/ReactTypes'
import { type Fiber } from './ReactInternalTypes'
import { NoFlags } from './ReactFiberFlags'
import {
  Fragment,
  HostComponent,
  HostText,
  IndeterminateComponent,
  type WorkTag,
} from './ReactWorkTags'
import { isStr } from '@my-mini-react/shared/utils'
import { REACT_ELEMENT_TYPE } from '@my-mini-react/shared/ReactSymbols'

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
  if (isStr(type)) {
    fiberTag = HostComponent
  } else if (type === REACT_ELEMENT_TYPE) {
    fiberTag = Fragment
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
  const { type, key, pendingProps } = element
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
  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  return workInProgress
}

export function createFiberFromText(content: string): Fiber {
  const fiber = createFiber(HostText, content, null)
  return fiber
}
