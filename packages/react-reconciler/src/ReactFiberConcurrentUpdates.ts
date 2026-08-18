import type { FiberRoot, Fiber } from './ReactInternalTypes'
import {
  type Lane,
  type Lanes,
  NoLane,
  NoLanes,
  mergeLanes,
} from './ReactFiberLane'
import { HostRoot } from './ReactWorkTags'
import {
  type SharedQueue as ClassQueue,
  type Update as ClassUpdate,
} from './ReactFiberClassUpdateQueue'

export type ConcurrentUpdate = {
  next: ConcurrentUpdate
  lane: Lane
}

type ConcurrentQueue = {
  pending: ConcurrentUpdate | null
}

const concurrentQueues: Array<any> = []
let concurrentQueuesIndex = 0

let concurrentlyUpdatedLanes: Lanes = NoLanes

export function unsafe_markUpdateLaneFromFiberToRoot(
  sourceFiber: Fiber,
  lane: Lane
): FiberRoot | null {
  markUpdateLaneFromFiberToRoot(sourceFiber, null, lane)
  return getRootForUpdatedFiber(sourceFiber)
}

function markUpdateLaneFromFiberToRoot(
  sourceFiber: Fiber,
  update: ConcurrentUpdate | null,
  lane: Lane
): void {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane)
  let alternate = sourceFiber.alternate
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane)
  }

  let parent = sourceFiber.return
  let node = sourceFiber
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane)
    alternate = parent.alternate
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane)
    }

    node = parent
    parent = parent.return
  }
}

export function enqueueConcurrentClassUpdate<State>(
  fiber: Fiber,
  queue: ClassQueue<State>,
  update: ClassUpdate<State>,
  lane: Lane
): FiberRoot | null {
  const concurrentQueue: ConcurrentQueue = queue as ConcurrentQueue
  const concurrentUpdate: ConcurrentUpdate = update as ConcurrentUpdate
  enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane)
  return getRootForUpdatedFiber(fiber)
}

function enqueueUpdate(
  fiber: Fiber,
  queue: ConcurrentQueue | null,
  update: ConcurrentUpdate | null,
  lane: Lane
) {
  concurrentQueues[concurrentQueuesIndex++] = fiber
  concurrentQueues[concurrentQueuesIndex++] = queue
  concurrentQueues[concurrentQueuesIndex++] = update
  concurrentQueues[concurrentQueuesIndex++] = lane

  concurrentlyUpdatedLanes = mergeLanes(concurrentlyUpdatedLanes, lane)

  fiber.lanes = mergeLanes(fiber.lanes, lane)
  const alternate = fiber.alternate
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane)
  }
}

function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot | null {
  let node = sourceFiber
  let parent = node.return
  while (parent !== null) {
    node = parent
    parent = node.return
  }
  return node.tag === HostRoot ? (node.stateNode as FiberRoot) : null
}

export function finishQueueingConcurrentUpdates(): void {
  const endIndex = concurrentQueuesIndex
  concurrentQueuesIndex = 0

  concurrentlyUpdatedLanes = NoLanes

  let i = 0
  while (i < endIndex) {
    const fiber: Fiber = concurrentQueues[i]
    concurrentQueues[i++] = null
    const queue: ConcurrentQueue = concurrentQueues[i]
    concurrentQueues[i++] = null
    const update: ConcurrentUpdate = concurrentQueues[i]
    concurrentQueues[i++] = null
    const lane: Lane = concurrentQueues[i]
    concurrentQueues[i++] = null

    // 我觉得 queue !== null && update !== null 这个判断没必要，但是源码中就是这样写的。
    if (queue !== null && update !== null) {
      const pending = queue.pending
      if (pending === null) {
        update.next = update
      } else {
        update.next = pending.next
        pending.next = update
      }
      queue.pending = update
    }

    if (lane !== NoLane) {
      markUpdateLaneFromFiberToRoot(fiber, update, lane)
    }
  }
}

export function getConcurrentlyUpdatedLanes(): Lanes {
  return concurrentlyUpdatedLanes
}
