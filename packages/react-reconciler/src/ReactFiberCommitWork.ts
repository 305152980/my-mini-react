import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { Placement } from './ReactFiberFlags'
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
