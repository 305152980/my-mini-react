import type { Fiber } from './ReactInternalTypes'
import { Placement, ChildDeletion } from './ReactFiberFlags'
import {
  createFiberFromElement,
  createFiberFromText,
  createWorkInProgress,
} from './ReactFiber'
import { REACT_ELEMENT_TYPE } from '@my-mini-react/shared/ReactSymbols'
import { isArray } from '@my-mini-react/shared/utils'
import { HostText } from './ReactWorkTags'

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
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      return
    }
    const deletions = returnFiber.deletions
    if (deletions === null) {
      returnFiber.deletions = [childToDelete]
      returnFiber.flags |= ChildDeletion
    } else {
      deletions.push(childToDelete)
    }
  }
  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber
  ): void {
    if (!shouldTrackSideEffects) {
      return
    }
    let childToDelete: Fiber | null = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
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
          // 删除 child 后面的节点。
          if (child.sibling !== null) {
            deleteRemainingChildren(returnFiber, child.sibling)
          }
          const existing = useFiber(child, newChild.props)
          existing.return = returnFiber
          return existing
        }
        // 删除 child 及其后面的节点。
        deleteRemainingChildren(returnFiber, child)
        break
      } else {
        // 删除单个节点。
        deleteChild(returnFiber, child)
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
  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string
  ): Fiber {
    if (current === null || current.tag !== HostText) {
      // 新节点是文本，但是老节点不是文本或者说老节点不存在。
      const created = createFiberFromText(textContent)
      created.return = returnFiber
      return created
    } else {
      // 新节点是文本，但是老节点存在且是文本。
      const existing = useFiber(current, textContent)
      existing.return = returnFiber
      return existing
    }
  }
  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any
  ): Fiber | null {
    // 判断节点是否可以复用。
    const key = oldFiber !== null ? oldFiber.key : null
    if (isText(newChild)) {
      if (key !== null) {
        // 新节点是文本，但是老节点存在且不是文本。因为老节点的 key 存在，文本节点的 key 不存在。
        return null
      }
      // 新节点是文本，老节点可能是文本。有可能可以复用。
      return updateTextNode(returnFiber, oldFiber, newChild + '')
    }
    // TODO 20260401
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
    // 1、从左往右遍历，按位置比较，如果可以复用，就复用；如果不可以复用，就退出本轮。
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx])
    }
    // TODO 20260401
    // Vue 1.2、从右往左遍历，按位置比较，如果可以复用，就复用；如果不可以复用，就退出本轮。
    // 2.1、如果老节点还在，新节点没了，就删除老节点。
    // 2.2、如果新节点还在，老节点没了，就新增新节点。
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
    // 3、如果新老节点都在......
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
