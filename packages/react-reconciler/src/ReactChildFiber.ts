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
import { type ReactElement } from '@my-mini-react/shared/ReactTypes'

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
        // TODO: 如果 newChild 是其他对象（如 Portal），需要额外处理。
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
  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement
  ): Fiber {
    const elementType = element.type
    if (current !== null) {
      if (current.elementType === elementType) {
        const existing = useFiber(current, element.props)
        existing.return = returnFiber
        return existing
      }
    }
    const created = createFiberFromElement(element)
    created.return = returnFiber
    return created
  }
  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any
  ): Fiber | null {
    const key = oldFiber !== null ? oldFiber.key : null
    if (isText(newChild)) {
      if (key !== null) {
        // 新节点是文本，但是老节点存在且不是文本。（因为老节点的 key 存在，文本节点的 key 不存在。）
        return null
      }
      // 新节点是文本，老节点可能是文本或者说不存在。
      return updateTextNode(returnFiber, oldFiber, newChild + '')
    }
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (newChild.key === key) {
            // 如果老节点存在：新老节点的 key 相同。
            // 如果老节点不存在：新节点的 key 为 null。
            return updateElement(returnFiber, oldFiber, newChild)
          } else {
            return null
          }
        // TODO: 如果 newChild 是其他对象（如 Portal），需要额外处理。
      }
    }
    return null
  }
  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIdx: number
  ): number {
    newFiber.index = newIdx
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex
    }
    const current = newFiber.alternate
    if (current !== null) {
      const oldIndex = current.index
      if (oldIndex < lastPlacedIndex) {
        // 移动旧 Dom 节点。
        newFiber.flags |= Placement
        return lastPlacedIndex
      } else {
        return oldIndex
      }
    } else {
      // 新增新 Dom 节点。
      newFiber.flags |= Placement
      return lastPlacedIndex
    }
  }
  function mapRemainingChildren(oldFiber: Fiber): Map<string | number, Fiber> {
    const existingChildren = new Map<string | number, Fiber>()
    let existingChild: Fiber | null = oldFiber
    while (existingChild !== null) {
      const key =
        existingChild.key !== null ? existingChild.key : existingChild.index
      existingChildren.set(key, existingChild)
      existingChild = existingChild.sibling
    }
    return existingChildren
  }
  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any
  ): Fiber | null {
    // const key = newChild.key !== null ? newChild.key : newIdx
    // 如果 newChild 是 null, undefined, boolean, 则直接使用索引作为 key。
    const key =
      typeof newChild === 'object' && newChild !== null
        ? newChild.key !== null
          ? newChild.key
          : newIdx
        : newIdx
    const matchedFiber = existingChildren.get(key) || null
    if (isText(newChild)) {
      return updateTextNode(returnFiber, matchedFiber, newChild + '')
    }
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return updateElement(returnFiber, matchedFiber, newChild)
        // TODO: 如果 newChild 是其他对象（如 Portal），需要额外处理。
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
    // 在第一轮 for 循环中，oldFiber 可能会被置为 null。这个时候用 nextOldFiber 来暂存 oldFiber 的值，以便后续恢复 oldFiber 的值。
    let nextOldFiber: Fiber | null = null // oldFiber.sibling
    let newIdx = 0
    // 上一次复用节点在旧列表中的最大位置索引。
    let lastPlacedIndex = 0
    // 1、从左往右遍历，按位置比较，如果可以复用，就复用；如果不可以复用，就退出本轮。
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      // 分支 1：如果旧节点的索引大于当前新节点的索引，说明旧的节点“跑太快了”，当前索引位置没有对应的旧节点可以复用。
      // 分支 2：这是正常情况，索引对齐。
      // oldFiber.index > newIdx 这种情况的出现，本质上是因为“旧链表”和“新数组”在结构上出现了错位。
      // 最核心的原因只有一个：旧链表中存在“空槽”（即由 null 或 false 占位但未生成 Fiber 的位置）。
      if (oldFiber.index > newIdx) {
        // oldFiber 跑太快了，先将 oldFiber 缓存起来，并设置 nextOldFiber 为 null。
        nextOldFiber = oldFiber
        // 将 oldFiber 设为 null。这意味着在接下来的 updateSlot 调用中，React 会认为这里没有旧节点。
        oldFiber = null
      } else {
        nextOldFiber = oldFiber.sibling
      }
      // 当 oldFiber 为 null 时，updateSlot 通常会返回一个【新建的 Fiber 节点】（除非遇到非法的节点类型）。
      // 这在 React 的 Diff 算法中对应的是 “新增节点” 的逻辑。
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx])
      if (newFiber === null) {
        if (oldFiber === null) {
          // 将 nextOldFiber 赋值给 oldFiber，以便在下一轮循环中继续尝试匹配后续的新节点。
          oldFiber = nextOldFiber
        }
        break
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          deleteChild(returnFiber, oldFiber)
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
      if (previousNewFiber === null) {
        resultFirstChild = newFiber
      } else {
        previousNewFiber.sibling = newFiber
      }
      previousNewFiber = newFiber
      oldFiber = nextOldFiber
    }
    // Vue 1.2、从右往左遍历，按位置比较，如果可以复用，就复用；如果不可以复用，就退出本轮。
    // 2.1、如果老节点还在，新节点没了，就删除老节点。
    if (newIdx === newChildren.length) {
      deleteRemainingChildren(returnFiber, oldFiber!)
      return resultFirstChild
    }
    // 2.2、如果新节点还在，老节点没了，就新增新节点。
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx])
        // 如果遇到无效的 React 元素（比如 null、false、undefined），就跳过它，继续处理下一个，而不是让整个渲染崩溃。
        if (newFiber === null) {
          continue
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          resultFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
      return resultFirstChild
    }
    // 2.3、如果新老节点都在。
    const existingChildren = mapRemainingChildren(oldFiber)
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx]
      )
      // if (newFiber !== null) { 是为了跳过新节点中不合法的节点。
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          existingChildren.delete(newFiber.key !== null ? newFiber.key : newIdx)
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          resultFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
    }
    // 如果新节点已经构建完了，但是 existingChildren 中还有老节点没有被复用，那么就删除它们。
    if (shouldTrackSideEffects) {
      existingChildren.forEach(child => {
        deleteChild(returnFiber, child)
      })
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
