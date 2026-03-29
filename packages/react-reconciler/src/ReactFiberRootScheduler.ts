import { Scheduler, NormalPriority } from '@my-mini-react/scheduler'
import { type FiberRoot } from './ReactInternalTypes'
import { performConcurrentWorkOnRoot } from './ReactFiberWorkLoop'

export function ensureRootIsScheduled(root: FiberRoot): void {
  queueMicrotask(() => {
    schheduleTaskForRootDuringMicrotask(root)
  })
}

function schheduleTaskForRootDuringMicrotask(root: FiberRoot): void {
  Scheduler.scheduleCallback(
    NormalPriority,
    performConcurrentWorkOnRoot.bind(null, root)
  )
}
