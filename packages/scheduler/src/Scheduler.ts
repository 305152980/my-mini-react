import { push, pop, peek } from './SchedulerMinHeap'
import { getCurrentTime, isFn } from 'shared/utils'
import {
  type PriorityLevel,
  NoPriority,
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
  IMMEDIATE_PRIORITY_TIMEOUT,
  USER_BLOCKING_PRIORITY_TIMEOUT,
  NORMAL_PRIORITY_TIMEOUT,
  LOW_PRIORITY_TIMEOUT,
  IDLE_PRIORITY_TIMEOUT,
} from './SchedulerPriorities'

let taskIdCounter: number = 1
interface Task {
  id: number
  callback: Callback | null
  priorityLevel: PriorityLevel
  startTime: number
  expirationTime: number
  sortIndex: number
}
type Callback = (args: boolean) => Callback | any | undefined
const taskQueue: Array<Task> = []

let currentTask: Task | null = null
let currentPriorityLevel: PriorityLevel = NoPriority

// 记录当前任务批次（work loop）开始执行的时间戳，用于计算已用时间或判断是否需要让出主线程。
let startTime: number = -1

// 用于：防止重复向浏览器（主机环境）注册任务执行回调（例如 requestIdleCallback 或 MessageChannel 的回调），确保同一时间只有一个“工作调度请求”处于待处理状态。
let isHostCallbackScheduled: boolean = false
// 核心作用：确保只启动一个持续的任务执行循环（通常基于 MessageChannel），避免重复创建或竞争。
let isMessageLoopRunning: boolean = false
// 防止重入（reentrancy）的保护标志。确保调度器的工作循环（work loop）不会在执行过程中被意外地递归调用或嵌套触发。
let isPerformingWork: boolean = false

function scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback
): void {
  const startTime: number = getCurrentTime()
  let timeout: number
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT
      break
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT
      break
    case NormalPriority:
      timeout = NORMAL_PRIORITY_TIMEOUT
      break
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT
      break
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT
      break
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT
      break
  }
  const expirationTime: number = startTime + timeout
  const newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  }
  newTask.sortIndex = expirationTime
  push(taskQueue, newTask)
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true
    requestHostCallback()
  }
}

function requestHostCallback(): void {
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true
    schedulePerformWorkUntilDeadline()
  }
}

const channel: MessageChannel = new MessageChannel()
channel.port1.onmessage = performWorkUntilDeadline
const port: MessagePort = channel.port2
function schedulePerformWorkUntilDeadline(): void {
  port.postMessage(null)
}
function performWorkUntilDeadline(): void {
  if (isMessageLoopRunning) {
    const currentTime: number = getCurrentTime()
    startTime = currentTime
    let hasMoreWork: boolean = true
    try {
      hasMoreWork = flushWork(currentTime)
    } finally {
      if (hasMoreWork) {
        performWorkUntilDeadline()
      } else {
        isMessageLoopRunning = false
        startTime = -1
      }
    }
  }
}

function flushWork(initialTime: number): boolean {
  isHostCallbackScheduled = false
  isPerformingWork = true
  let previousPriorityLevel: PriorityLevel = currentPriorityLevel
  try {
    return workLoop(initialTime)
  } finally {
    currentTask = null
    currentPriorityLevel = previousPriorityLevel
    isPerformingWork = false
  }
}

function workLoop(initialTime: number): boolean {
  let currentTime: number = initialTime
  currentTask = peek(taskQueue)
  while (currentTask !== null) {
    // 如果当前任务还没到过期时间，但是已经到了时间片结束的时间，则 break while。
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break
    }
    const callback: Callback | null = currentTask.callback
    if (isFn(callback)) {
      // 先将 currentTask.callback = null 的主要目的是：防止当前任务在执行过程中被重复调用。
      currentTask.callback = null
      // 如果为 true，则表示：当前任务被执行，是因为已经过期了。
      const didUserCallbackTimeout: boolean =
        currentTask.expirationTime <= currentTime
      const continuationCallback: Callback | any | undefined = callback!(
        didUserCallbackTimeout
      )
      // 执行完一个 task 后需要更新 currentTime。
      currentTime = getCurrentTime()
      if (isFn(continuationCallback)) {
        currentTask.callback = continuationCallback as Callback
        // 这种情况表示：当前时间片已经消耗完毕，并且还有剩下的任务需要在下一个时间片中继续执行。
        return true
      } else {
        // 只有当前任务还在堆顶的时候，才执行 pop(taskQueue)。
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue)
        }
      }
    } else {
      pop(taskQueue)
    }
    currentTask = peek(taskQueue)
  }
  if (currentTask !== null) {
    // 当前时间片已经消耗完毕，还有剩下的任务需要在下一个时间片中继续执行。
    return true
  } else {
    // 当前时间片还没有消耗完毕，但是 taskQueue 中的任务已经执行完毕。
    return false
  }
}

function cancelCallback(): void {
  currentTask!.callback = null
}

function getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel
}

let frameInterval: number = 5
// 差值小于 frameInterval 的时候表示不超时，大于或等于的时候表示超时。
function shouldYieldToHost(): boolean {
  const timeElapsed: number = getCurrentTime() - startTime
  if (timeElapsed < frameInterval) {
    return false
  }
  return true
}

export {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
  scheduleCallback,
  cancelCallback,
  getCurrentPriorityLevel,
  shouldYieldToHost,
}
