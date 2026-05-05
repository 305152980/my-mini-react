import { createFiber } from './ReactFiber'
import type { Container, Fiber, FiberRoot } from './ReactInternalTypes'
import { HostRoot } from './ReactWorkTags'
import { NoLanes } from './ReactFiberLane'

type FiberRootNodeCtor = new (containerInfo: Container) => FiberRoot
export const FiberRootNode: FiberRootNodeCtor = function (
  this: FiberRoot,
  containerInfo: Container
): void {
  this.containerInfo = containerInfo
  this.current = null as unknown as Fiber
  this.finishedWork = null
  this.pendingLanes = NoLanes
} as unknown as FiberRootNodeCtor

export function createFiberRoot(containerInfo: Container): FiberRoot {
  const root: FiberRoot = new FiberRootNode(containerInfo)
  const uninitializedFiber: Fiber = createFiber(HostRoot, null, null)
  root.current = uninitializedFiber
  uninitializedFiber.stateNode = root
  return root
}
