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
} from './ReactWorkTags'
import { mountChildFibers, reconcileChildFibers } from './ReactChildFiber'
import { isStr, isNum } from '@my-mini-react/shared/utils'
import { renderWithHooks } from './ReactFiberHook'
import { pushProvider, readContext } from './ReactFiberNewContext'

// 1、处理当前 Fiber 节点。
// 2、返回子 Fiber 节点。
export function beginWork(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress)
    case HostComponent:
      return updateHostComponent(current, workInProgress)
    case HostText:
      return updateHostText(current, workInProgress)
    case Fragment:
      return updateFragment(current, workInProgress)
    case ClassComponent:
      return updateClassComponent(current, workInProgress)
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress)
    case ContextProvider:
      return updateContextProvider(current, workInProgress)
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress)
    // TODO
  }
  throw new Error(
    `Unknown unit of work tag: ${workInProgress.tag}. This error is likely caused by a bug in React. Please file an issue.`
  )
}

function updateHostRoot(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const nextChildren = workInProgress.memoizedState.element
  reconcileChildren(current, workInProgress, nextChildren)
  return workInProgress.child
}

function updateHostComponent(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const { type, pendingProps } = workInProgress
  const isDirectTextChild = shouldSetTextContent(type, pendingProps)
  if (isDirectTextChild) {
    // 如果原生标签的子节点只有一个文本节点，这个时候文本节点不会再生成对应的 Fiber 节点，而是直接作为属性保存在父 Fiber 的 memoizedProps 中。
    return null
  }
  const nextChildren = workInProgress.pendingProps.children
  reconcileChildren(current, workInProgress, nextChildren)
  return workInProgress.child
}

function updateHostText(current: Fiber | null, workInProgress: Fiber): null {
  return null
}

function updateFragment(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const nextChildren = workInProgress.pendingProps.children
  reconcileChildren(current, workInProgress, nextChildren)
  return workInProgress.child
}

function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const { type, pendingProps } = workInProgress
  let instance = workInProgress.stateNode
  // 如果类组件是初次挂载，则创建类组件实例。
  if (current === null) {
    instance = new type(pendingProps)
    workInProgress.stateNode = instance
  }
  // 如果类组件设置了 contextType 属性，则需要读取对应的上下文值。
  const contextType = type.contextType
  if (contextType) {
    const newValue = readContext(contextType)
    instance.context = newValue
  }
  const children = instance.render()
  reconcileChildren(current, workInProgress, children)
  return workInProgress.child
}

function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const { type, pendingProps } = workInProgress
  const children = renderWithHooks(current, workInProgress, type, pendingProps)
  reconcileChildren(current, workInProgress, children)
  return workInProgress.child
}

function updateContextProvider(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  // workInProgress.type = {
  //   $$typeof: Symbol.for('react.provider'), // 标识：这是一个 Provider
  //   _context: { ... }                       // 关键：指向对应的 Context 对象
  // }
  const conext = workInProgress.type._context
  const value = workInProgress.pendingProps.value
  pushProvider(conext, value)
  reconcileChildren(
    current,
    workInProgress,
    workInProgress.pendingProps.children
  )
  return workInProgress.child
}

function updateContextConsumer(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const conext = workInProgress.type
  const newValue = readContext(conext)
  const render = workInProgress.pendingProps.children
  const newChildren = render(newValue)
  reconcileChildren(current, workInProgress, newChildren)
  return workInProgress.child
}

function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any
): void {
  if (current === null) {
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren)
  } else {
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren
    )
  }
}

function shouldSetTextContent(type: any, props: any): boolean {
  return (
    type === 'textarea' ||
    type === 'noscript' ||
    isStr(props.children) ||
    isNum(props.children) ||
    (typeof props.dengerouslySetInnerHTML === 'object' &&
      props.dengerouslySetInnerHTML !== null &&
      props.dengerouslySetInnerHTML.__html != null)
  )
}
