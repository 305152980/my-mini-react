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

function getHostSibling(fiber: Fiber): Element | Text | null {
  let node = fiber
  sibling: while (1) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null
      }
      node = node.return
    }
    node = node.sibling
    while (!isHost(node)) {
      if (node.flags & Placement) {
        continue sibling
      }
      if (node.child === null) {
        continue sibling
      } else {
        node = node.child
      }
    }
    if (!(node.flags & Placement)) {
      return node.stateNode
    }
  }
  // 这行代码在运行时永远不会被执行（因为是死循环），但它是为了满足 TypeScript 的类型检查。
  return null
}
function insertOrAppendPlacementNode(
  node: Fiber,
  before: Element | Text | null,
  parent: Element | Document | DocumentFragment
): void {
  if (before) {
    parent.insertBefore(getStateNode(node)!, before)
  } else {
    parent.appendChild(getStateNode(node)!)
  }
}
function commitPlacement(finishedWork: Fiber): void {
  if (finishedWork.stateNode && isHost(finishedWork)) {
    const parentFiber = getHostParentFiber(finishedWork)
    let parentDom = parentFiber.stateNode
    if (parentDom.containerInfo) {
      parentDom = parentDom.containerInfo
    }
    // 1. 寻找“插入参考点”
    // 这一步是为了找到在当前 Fiber 之后、下一个即将被渲染的“真实 DOM 兄弟节点”。
    //
    // 核心逻辑：
    // - 如果当前节点后面紧跟着一个已经存在的 DOM 节点（比如复用过来的旧节点），
    //   那么新节点必须插在这个旧节点的前面，才能保证视觉顺序正确。
    // - 如果后面没有兄弟节点了（它是最后一个），getHostSibling 会返回 null。
    const before = getHostSibling(finishedWork)
    // 2. 执行 DOM 插入
    // 这是一个“二合一”的操作：
    // - 情况 A (before 存在): 调用 parentDom.insertBefore(newNode, beforeNode)
    //   即：把新节点插在“新节点”和“旧节点”之间。
    // - 情况 B (before 为 null): 调用 parentDom.appendChild(newNode)
    //   即：后面没东西了，直接把新节点追加到父容器的末尾。
    insertOrAppendPlacementNode(finishedWork, before, parentDom)
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
