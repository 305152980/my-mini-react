import { createHostRootFiber } from './ReactFiber'
import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { NoLane, NoLanes } from './ReactFiberLane'
import { initializeUpdateQueue } from './ReactFiberClassUpdateQueue'
import type { Container } from 'ReactFiberHostConfig'

export type RootState = {
  element: any
  // TODO: 暂时用这种写法代替下面四个属性。
  //   isDehydrated: boolean
  //   cache: Cache
  //   pendingSuspenseBoundaries: PendingSuspenseBoundaries | null
  //   transitions: Set<Transition> | null
  [key: string]: any
}

type FiberRootNodeCtor = new (containerInfo: Container) => FiberRoot
export const FiberRootNode: FiberRootNodeCtor = function (
  this: FiberRoot,
  containerInfo: Container
): void {
  this.containerInfo = containerInfo
  this.current = null as unknown as Fiber
  this.finishedWork = null
  this.pendingLanes = NoLanes
  this.finishedLanes = NoLanes
  this.callbackNode = null
  this.callbackPriority = NoLane
} as unknown as FiberRootNodeCtor

export function createFiberRoot(containerInfo: Container): FiberRoot {
  const root = new FiberRootNode(containerInfo)
  const uninitializedFiber = createHostRootFiber()
  root.current = uninitializedFiber
  uninitializedFiber.stateNode = root
  const initialState: RootState = {
    element: null,
  }
  uninitializedFiber.memoizedState = initialState
  initializeUpdateQueue(uninitializedFiber)
  return root
}
