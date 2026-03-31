import type { Fiber } from './ReactInternalTypes'
import { Placement } from './ReactFiberFlags'
import {
  createFiberFromElement,
  createFiberFromText,
  createWorkInProgress,
} from './ReactFiber'
import { REACT_ELEMENT_TYPE } from '@my-mini-react/shared/ReactSymbols'
import { isArray } from '@my-mini-react/shared/utils'

type ChildReconciler = (
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild: any
) => Fiber | null

export const mountChildFibers: ChildReconciler = createChildReconciler(false)
export const reconcileChildFibers: ChildReconciler = createChildReconciler(true)

function createChildReconciler(
  shouldTrackSideEffects: boolean
): ChildReconciler {
  function placeSingleChild(newFiber: Fiber): Fiber {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement
    }
    return newFiber
  }
  function useFiber(fiber: Fiber, pendingProps: any): Fiber {
    const clone = createWorkInProgress(fiber, pendingProps)
    clone.index = 0
    clone.sibling = null
    return clone
  }
  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any
  ): Fiber {
    // 节点复用的条件：1. 新旧节点的层级相同 2. 新旧节点 key 相同 3. 新旧节点类型相同。
    let child = currentFirstChild
    while (child !== null) {
      if (child.key === newChild.key) {
        if (child.type === newChild.type) {
          // TODO 删除 child 后面的节点。
          const existing = useFiber(child, newChild.props)
          existing.return = returnFiber
          return existing
        }
        break
      } else {
        // TODO 删除单个节点。
      }
      child = child.sibling
    }
    let createdFiber = createFiberFromElement(newChild)
    createdFiber.return = returnFiber
    return createdFiber
  }
  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string
  ): Fiber {
    const createdFiber = createFiberFromText(textContent)
    createdFiber.return = returnFiber
    return createdFiber
  }
  function createChild(returnFiber: Fiber, newChild: any): Fiber | null {
    if (isText(newChild)) {
      const created = createFiberFromText(newChild + '')
      created.return = returnFiber
      return created
    }
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          const created = createFiberFromElement(newChild)
          created.return = returnFiber
          return created
      }
    }
    return null
  }
  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<any>
  ): Fiber | null {
    let resultFirstChild: Fiber | null = null
    let previousNewFiber: Fiber | null = null
    let oldFiber = currentFirstChild
    let newIdx = 0
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx])
        if (newFiber === null) {
          continue
        }
        if (shouldTrackSideEffects) {
          newFiber.flags |= Placement
        }
        newFiber.index = newIdx
        if (previousNewFiber === null) {
          resultFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
      return resultFirstChild
    }
    return resultFirstChild
  }
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any
  ): Fiber | null {
    if (isText(newChild)) {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, newChild + '')
      )
    }
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstChild, newChild)
          )
      }
    }
    if (isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild)
    }
    // TODO
    return null
  }
  return reconcileChildFibers
}

function isText(newChild: any): boolean {
  return (
    (typeof newChild === 'string' && newChild !== '') ||
    typeof newChild === 'number'
  )
}
