import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import type { FiberRoot } from './ReactInternalTypes'
import {
  requestUpdateLane,
  requestEventTime,
  scheduleUpdateOnFiber,
} from './ReactFiberWorkLoop'
import { createUpdate, enqueueUpdate } from './ReactFiberClassUpdateQueue'
import { createFiberRoot } from './ReactFiberRoot'
import type { Lane } from './ReactFiberLane'
import type { Container } from 'ReactFiberHostConfig'

export function createContainer(containerInfo: Container): FiberRoot {
  return createFiberRoot(containerInfo)
}

export function updateContainer(
  element: ReactNodeList,
  container: FiberRoot
): Lane {
  const current = container.current
  const eventTime = requestEventTime()
  const lane = requestUpdateLane(current)

  const update = createUpdate(eventTime, lane)
  update.payload = { element }

  const root = enqueueUpdate(current, update, lane)
  if (root !== null) {
    scheduleUpdateOnFiber(root, current, lane, eventTime)
  }

  return lane
}
