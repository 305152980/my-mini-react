import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { type FiberRoot } from './ReactInternalTypes'
import { requestUpdateLane, scheduleUpdateOnFiber } from './ReactFiberWorkLoop'
import {
  createUpdate,
  enqueueUpdate,
  type UpdateQueue,
} from './ReactFiberClassUpdateQueue'

export function updateContainer(
  element: ReactNodeList,
  container: FiberRoot
): void {
  const hostRootFiber = container.current
  const lane = requestUpdateLane()
  const update = createUpdate<ReactNodeList>(element, lane)
  enqueueUpdate(hostRootFiber.updateQueue as UpdateQueue<ReactNodeList>, update)
  scheduleUpdateOnFiber(hostRootFiber, lane)
}
