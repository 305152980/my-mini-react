import type { Fiber } from './ReactInternalTypes'
import { Placement } from './ReactFiberFlags'
import { createFiberFromElement } from './ReactFiber'
import { REACT_ELEMENT_TYPE } from '@my-mini-react/shared/ReactSymbols'

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
    // TODO
    return null
  }
  return reconcileChildFibers
}
