import type { Fiber, ContextDependency } from './ReactInternalTypes'
import type { ReactContext } from '@my-mini-react/shared/ReactTypes'
import { type StackCursor, createCursor, pop, push } from './ReactFiberStack'
import type { Lanes } from './ReactFiberLane'
import { includesSomeLane } from './ReactFiberLane'
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork'

const valueCursor: StackCursor<any> = createCursor(null)

// 标记当前正在渲染的组件。
let currentlyRenderingFiber: Fiber | null = null
// Context 依赖链表的尾指针。
let lastContextDependency: ContextDependency<unknown> | null = null
// 最后完全观察到的 Context。
let lastFullyObservedContext: ReactContext<any> | null = null

export function pushProvider<T>(
  providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T
): void {
  push(valueCursor, context._currentValue, providerFiber)
  context._currentValue = nextValue
}

export function readContext<T>(context: ReactContext<T>): T {
  const value = context._currentValue
  return value
}

export function popProvider<T>(
  context: ReactContext<T>,
  providerFiber: Fiber
): void {
  const currentValue = valueCursor.current
  pop(valueCursor, providerFiber)
  context._currentValue = currentValue
}

/**
 * 核心作用：
 *   在组件渲染前设置 Context 读取的环境，并检查是否有待处理的 Context 更新。
 *
 * 执行步骤：
 *   1. 设置当前正在渲染的 Fiber（供后续 readContext 使用）。
 *   2. 重置 Context 依赖收集器（lastContextDependency 和 lastFullyObservedContext）。
 *   3. 检查该组件是否有待处理的 Context 更新。
 *      - 如果有，标记该 Fiber 收到了更新（markWorkInProgressReceivedUpdate）。
 *      - 这会阻止 bailout 优化，确保组件重新渲染。
 *   4. 重置 dependencies.firstContext 为 null（准备重新收集依赖）。
 *
 * 重要：
 *   - 必须在组件 render 前调用（Class 组件在 updateClassInstance 中调用）。
 *   - 如果不调用，readContext 会因为 currentlyRenderingFiber 为 null 而抛错。
 *   - 重置 firstContext 是为了避免复用上一次渲染的依赖链表。
 */
export function prepareToReadContext(
  workInProgress: Fiber,
  renderLanes: Lanes
): void {
  currentlyRenderingFiber = workInProgress
  lastContextDependency = null
  lastFullyObservedContext = null

  const dependencies = workInProgress.dependencies
  if (dependencies !== null) {
    const firstContext = dependencies.firstContext
    if (firstContext !== null) {
      if (includesSomeLane(dependencies.lanes, renderLanes)) {
        // Context list has a pending update. Mark that this fiber performed work.
        markWorkInProgressReceivedUpdate()
      }
      // Reset the work-in-progress list
      dependencies.firstContext = null
    }
  }
}

/**
 * 传播 Context 变化到所有依赖的 Consumer（Eager 模式）
 *
 * 当 Context.Provider 的值变化时，这个函数会：
 * 1. 遍历 Provider 的整个子树
 * 2. 找到所有依赖这个 Context 的 Fiber 节点
 * 3. 标记这些节点需要重新渲染（设置 lanes）
 * 4. 向上传播标记到根节点
 *
 * 注意：
 * - 遇到同类型 Provider 会停止向下遍历（值被覆盖）
 *
 * @param workInProgress Context.Provider 的 Fiber 节点
 * @param context 发生变化的 Context 对象
 * @param renderLanes 本次渲染的优先级
 */
function propagateContextChange_eager<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): void {
  // TODO: 待实现。
}
export function propagateContextChange<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): void {
  propagateContextChange_eager(workInProgress, context, renderLanes)
}
