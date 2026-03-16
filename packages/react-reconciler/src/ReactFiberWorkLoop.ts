import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { ensureRootIsScheduled } from './ReactFiberRootScheduler'

let workInProgress: Fiber | null = null
let workInProgressRoot: FiberRoot | null = null

export function scheduleUpdateOnFiber(root: FiberRoot, fiber: Fiber): void {
  workInProgressRoot = root
  workInProgress = fiber
  ensureRootIsScheduled(root)
}

export function performConcurrentWorkOnRoot(root: FiberRoot): void {
  // TODO
  // 1、render，构建 fiber 树。
  // 2、commit，提交 fiber 树到 DOM。
}
