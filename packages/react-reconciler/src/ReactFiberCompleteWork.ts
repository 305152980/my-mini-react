import { type Fiber } from './ReactInternalTypes'
import { HostRoot, HostComponent } from './ReactWorkTags'
import { isNum, isStr } from '@my-mini-react/shared/utils'

export function completeWork(
  current: Fiber | null,
  workInProgress: Fiber
): Fiber | null {
  switch (workInProgress.tag) {
    case HostRoot:
      return null
    case HostComponent:
      // 1、创建真实 DOM 节点。
      const { type } = workInProgress
      const instance = document.createElement(type)
      // 2、初始化 DOM 节点的属性。
      finalizeInitialChildren(instance, workInProgress.pendingProps)
      // 3、把子 DOM 节点挂载到父 DOM 节点上。
      appendAllChildren(instance, workInProgress)
      // 4、把 DOM 节点保存在 Fiber 的 stateNode 上。
      workInProgress.stateNode = instance
      return null
  }
  // TODO
  throw new Error(
    `Unknown unit of work tag: ${workInProgress.tag}. This error is likely caused by a bug in React. Please file an issue.`
  )
}

function finalizeInitialChildren(domElement: HTMLElement, props: any): void {
  for (const propKey in props) {
    const nextProp = props[propKey]
    if (propKey === 'children') {
      if (isStr(nextProp) || isNum(nextProp)) {
        domElement.textContent = nextProp + ''
      }
    } else {
      ;(domElement as any)[propKey] = nextProp
    }
  }
}

function appendAllChildren(parent: HTMLElement, workInProgress: Fiber): void {
  let nodeFiber = workInProgress.child
  if (nodeFiber) {
    parent.appendChild(nodeFiber.stateNode)
  }
}
