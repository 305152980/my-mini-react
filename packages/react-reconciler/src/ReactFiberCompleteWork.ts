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
import { isNum, isStr } from '@my-mini-react/shared/utils'
import { popProvider } from './ReactFiberNewContext'
import {
  precacheFiberNode,
  updateFiberProps,
} from '@my-mini-react/react-dom-bindings'

export function completeWork(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  const newProps = workInProgress.pendingProps
  switch (workInProgress.tag) {
    case HostRoot:
    case Fragment:
    case ClassComponent:
    case FunctionComponent:
    case ContextConsumer:
      return null
    case ContextProvider:
      popProvider(workInProgress.type._context)
      return null
    case HostComponent:
      if (current !== null) {
        updateHostComponent(current, workInProgress, newProps)
      } else {
        // 1、创建真实 DOM 节点。
        const { type } = workInProgress
        const instance = document.createElement(type)
        // 2、初始化 DOM 节点的属性。
        finalizeInitialChildren(instance, null, newProps)
        // 3、把子 DOM 节点挂载到父 DOM 节点上。
        appendAllChildren(instance, workInProgress)
        // 4、把 DOM 节点保存在 Fiber 的 stateNode 上。
        workInProgress.stateNode = instance
      }
      precacheFiberNode(workInProgress, workInProgress.stateNode as Element)
      updateFiberProps(workInProgress.stateNode as Element, newProps)
      return null
    case HostText:
      if (current !== null) {
        // 分支一：更新时，复用已有的文本节点，只更新文本内容。
        // 把“旧树”（Current Tree）里的真实文本节点，直接赋值给“新树”（WorkInProgress Tree）。
        workInProgress.stateNode = current.stateNode
        // 对比“旧的文本内容”（memoizedProps）和“新的文本内容”（pendingProps，代码里赋值给了 newProps）。
        if (current.memoizedProps !== newProps) {
          // 直接修改真实 DOM 对象的 nodeValue 属性。
          workInProgress.stateNode.nodeValue = newProps
        }
      } else {
        // 分支二：初次挂载时，创建新的文本节点。
        workInProgress.stateNode = document.createTextNode(newProps)
      }
      precacheFiberNode(workInProgress, workInProgress.stateNode as Text)
      updateFiberProps(workInProgress.stateNode as Text, newProps)
      return null
    // TODO
  }
  throw new Error(
    `Unknown unit of work tag: ${workInProgress.tag}. This error is likely caused by a bug in React. Please file an issue.`
  )
}

function finalizeInitialChildren(
  domElement: Element,
  prevProps: any,
  nextProps: any
): void {
  // 事件处理器前缀，这些不应该通过 DOM 属性设置。
  const isEventProp = (key: string) => key.startsWith('on')
  for (const propKey in prevProps) {
    const prevProp = prevProps[propKey]
    if (propKey === 'children') {
      if (
        (isStr(prevProp) || isNum(prevProp)) &&
        !(isStr(nextProps.children) || isNum(nextProps.children))
      ) {
        domElement.textContent = ''
      }
    } else if (!isEventProp(propKey)) {
      if (!(propKey in nextProps)) {
        ;(domElement as any)[propKey] = ''
      }
    }
  }
  for (const propKey in nextProps) {
    const nextProp = nextProps[propKey]
    if (propKey === 'children') {
      if (isStr(nextProp) || isNum(nextProp)) {
        domElement.textContent = nextProp + ''
      }
    } else if (!isEventProp(propKey)) {
      ;(domElement as any)[propKey] = nextProp
    }
  }
}

function appendAllChildren(parent: Element, workInProgress: Fiber): void {
  let nodeFiber = workInProgress.child
  while (nodeFiber !== null) {
    if (isHost(nodeFiber)) {
      parent.appendChild(nodeFiber.stateNode)
    } else if (nodeFiber.child !== null) {
      nodeFiber = nodeFiber.child
      continue
    }
    while (nodeFiber!.sibling === null) {
      if (nodeFiber!.return === workInProgress) {
        return
      }
      nodeFiber = nodeFiber!.return
    }
    nodeFiber = nodeFiber!.sibling
  }
}

export function isHost(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostText
}

function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  newProps: any
): void {
  if (current.memoizedProps === newProps) {
    return
  }
  finalizeInitialChildren(
    workInProgress.stateNode,
    current.memoizedProps,
    newProps
  )
}
