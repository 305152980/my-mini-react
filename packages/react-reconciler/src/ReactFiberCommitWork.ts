import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { Placement, ChildDeletion } from './ReactFiberFlags'
import { HostComponent, HostRoot, HostText } from './ReactWorkTags'
import { isHost } from './ReactFiberCompleteWork'

export function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber
): void {
  recurSivelyTraverseMutationEffects(root, finishedWork)
  commitReconciliationEffects(finishedWork)
}

function recurSivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber
): void {
  let child = parentFiber.child
  while (child !== null) {
    commitMutationEffects(root, child)
    child = child.sibling
  }
}

function commitReconciliationEffects(finishedWork: Fiber): void {
  const flags = finishedWork.flags
  if (flags & Placement) {
    commitPlacement(finishedWork)
    finishedWork.flags &= ~Placement
  }
  if (flags & ChildDeletion) {
    // 获取父 DOM 节点对应的 Fiber 节点。
    const parentFiber = isHostParent(finishedWork)
      ? finishedWork
      : getHostParentFiber(finishedWork)
    // 获取父 DOM 节点。
    const parentDom =
      parentFiber.stateNode.containerInfo || parentFiber.stateNode
    commitDeletions(finishedWork.deletions!, parentDom)
    finishedWork.flags &= ~ChildDeletion
    finishedWork.deletions = null
  }
}

function commitPlacement(finishedWork: Fiber): void {
  if (finishedWork.stateNode && isHost(finishedWork)) {
    const domNode = finishedWork.stateNode
    const parentFiber = getHostParentFiber(finishedWork)
    let parentDom = parentFiber.stateNode
    if (parentDom.containerInfo) {
      parentDom = parentDom.containerInfo
    }
    parentDom.appendChild(domNode)
  } else {
    let kid = finishedWork.child
    while (kid !== null) {
      commitPlacement(kid)
      kid = kid.sibling
    }
  }
}

function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent
    }
    parent = parent.return
  }
  throw new Error(
    'Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.'
  )
}

function isHostParent(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostRoot
}

function commitDeletions(
  deletions: Array<Fiber>,
  parentDom: Element | Document | DocumentFragment
): void {
  deletions.forEach(deletion => {
    parentDom.removeChild(getStateNode(deletion)!)
  })
}

function getStateNode(fiber: Fiber): Element | Text | void {
  let node = fiber
  while (1) {
    if (isHost(node) && node.stateNode) {
      return node.stateNode
    }
    node = node.child as Fiber
  }
}
