import { createFiber } from './ReactFiber'
import type { Container, Fiber, FiberRoot } from './ReactInternalTypes'
import { HostRoot } from './ReactWorkTags'
import { NoLanes } from './ReactFiberLane'
import { initializeUpdateQueue } from './ReactFiberClassUpdateQueue'

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
  const uninitializedFiber: Fiber = createFiber(HostRoot, null, null, NoLanes)
  root.current = uninitializedFiber
  uninitializedFiber.stateNode = root
  initializeUpdateQueue(uninitializedFiber)
  return root
}
