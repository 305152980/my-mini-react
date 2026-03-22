import type { Fiber } from './ReactInternalTypes'
import { Placement } from './ReactFiberFlags'
import { createFiberFromElement } from './ReactFiber'
import { REACT_ELEMENT_TYPE } from '@my-mini-react/shared/ReactSymbols'
import { isArray } from '@my-mini-react/shared/utils'

type ChildReconciler = (
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild: any
) => Fiber | null

export const mountChildFibers: ChildReconciler = createChildReconciler(true)
export const reconcileChildFibers: ChildReconciler =
  createChildReconciler(false)

function createChildReconciler(
  shouldTrackSideEffects: boolean
): ChildReconciler {
  function placeSingleChild(newFiber: Fiber): Fiber {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement
    }
    return newFiber
  }
  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any
  ): Fiber {
    let createdFiber = createFiberFromElement(newChild)
    createdFiber.return = returnFiber
    return createdFiber
  }
  function createChild(returnFiber: Fiber, newChild: any): Fiber | null {
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
