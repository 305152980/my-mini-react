import {
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_scheduleCallback as scheduleCallback,
} from '@my-mini-react/scheduler'
import type { SchedulerCallback } from './Scheduler'
import {
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
  DiscreteEventPriority,
} from './ReactEventPriorities'

// 同步任务队列。用于暂存那些需要立即同步执行的任务回调
// 初始值为 null，当有任务加入时会被初始化为数组
let syncQueue: Array<SchedulerCallback> | null = null
// 防重入标志位。防止在刷新队列的过程中，被递归或嵌套调用导致无限循环
let isFlushingSyncQueue: boolean = false

// 将同步回调函数推入队列中
export function scheduleSyncCallback(callback: SchedulerCallback): void {
  if (syncQueue === null) {
    // 如果队列还没初始化，先创建一个只包含当前回调的数组
    syncQueue = [callback]
  } else {
    // 如果队列已存在，直接将新回调追加到队尾
    syncQueue.push(callback)
  }
}

// 立即同步地刷新并执行队列中的所有回调。
export function flushSyncCallbacks(): null {
  // 核心防御机制：
  // 1. !isFlushingSyncQueue 保证同一时间只有一个线程在刷队列（防重入）。
  // 2. syncQueue !== null 保证队列里有活才干。
  if (!isFlushingSyncQueue && syncQueue !== null) {
    // 上锁，标记当前正在刷新队列。
    isFlushingSyncQueue = true
    let i = 0
    // 缓存当前的更新优先级，以便在 finally 块中恢复现场。
    const previousUpdatePriority = getCurrentUpdatePriority()
    try {
      // 标记当前处于同步执行模式。
      const isSync = true
      // 缓存当前的队列引用（防止在循环中被外部修改）。
      const queue = syncQueue
      // TODO: Is this necessary anymore? The only user code that runs in this
      // queue is in the render or commit phases.
      // 在执行同步任务期间，临时将全局优先级提升为 DiscreteEventPriority（离散事件优先级）。
      // 这通常对应点击、按键等需要立即响应的用户交互，确保不被低优先级任务打断。
      setCurrentUpdatePriority(DiscreteEventPriority)
      // 遍历队列，依次执行每一个同步回调。
      for (; i < queue.length; i++) {
        // do...while 循环是 React 处理同步任务链式返回的核心设计。
        // 如果一个回调执行后返回了新的回调函数，会立刻继续执行新的回调，直到返回 null 为止。
        let callback = queue[i]!
        do {
          callback = callback(isSync) as SchedulerCallback
        } while (callback !== null)
      }
      // 如果所有任务都顺利执行完毕，将队列清空，等待下一批任务。
      syncQueue = null
    } catch (error) {
      // If something throws, leave the remaining callbacks on the queue.
      // 异常降级处理：如果中途有任务报错，不能让整个应用崩溃，也不能丢掉剩下的任务。
      if (syncQueue !== null) {
        // 截取并保留报错任务 *之后* 的所有剩余任务。
        syncQueue = syncQueue.slice(i + 1)
      }
      // Resume flushing in the next tick.
      // 调度一个 ImmediatePriority（最高优先级）的宏任务，在下一个事件循环 tick 中立刻重试刷新剩下的任务。
      scheduleCallback(ImmediatePriority, flushSyncCallbacks)
      // 将错误继续向外抛出，让上层调用者感知到发生了异常。
      throw error
    } finally {
      // 无论成功还是失败，最后都必须执行的“收尾工作”。
      // 1. 恢复之前的更新优先级，避免污染后续任务的优先级判断。
      setCurrentUpdatePriority(previousUpdatePriority)
      // 2. 解锁，允许下一次 flushSyncCallbacks 的执行。
      isFlushingSyncQueue = false
    }
  }
  return null
}
