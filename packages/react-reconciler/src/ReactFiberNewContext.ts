import type { Fiber, ContextDependency } from './ReactInternalTypes'
import type { ReactContext } from '@my-mini-react/shared/ReactTypes'
import { type StackCursor, createCursor, pop, push } from './ReactFiberStack'
import type { Lanes } from './ReactFiberLane'
import {
  NoLanes,
  includesSomeLane,
  isSubsetOfLanes,
  mergeLanes,
} from './ReactFiberLane'
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork'
import { ContextProvider, ClassComponent } from './ReactWorkTags'

const valueCursor: StackCursor<any> = createCursor(null)

// 标记当前正在渲染的组件。
let currentlyRenderingFiber: Fiber | null = null
// Context 依赖链表的尾指针。
let lastContextDependency: ContextDependency<unknown> | null = null
// 最后完全观察到的 Context。
// lastFullyObservedContext 在当前代码中只被赋值为 null，从未被赋值为实际 Context，是一个未启用的优化占位符。
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

  if (lastFullyObservedContext === context) {
    // Nothing to do. We already observe everything in this context.
  } else {
    const contextItem = {
      context: context,
      memoizedValue: value,
      next: null,
    }
    if (lastContextDependency === null) {
      if (currentlyRenderingFiber === null) {
        // useContext 只能在渲染阶段调用，不能在非渲染阶段调用。
        // currentlyRenderingFiber 只在 prepareToReadContext 中被赋值，在渲染结束后被清空。如果它是 null，说明 readContext 在渲染阶段之外被调用了。
        throw new Error(
          'Context can only be read while React is rendering. ' +
            'In classes, you can read it in the render method or getDerivedStateFromProps. ' +
            'In function components, you can read it directly in the function body, but not ' +
            'inside Hooks like useReducer() or useMemo().'
        )
      }
      // This is the first dependency for this component. Create a new list.
      lastContextDependency = contextItem
      currentlyRenderingFiber.dependencies = {
        lanes: NoLanes,
        firstContext: contextItem,
      }
    } else {
      // Append a new context item.
      lastContextDependency = lastContextDependency.next = contextItem
    }
  }

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
 * 在开始渲染一个 Fiber 节点之前，做好读取 Context 的准备工作。
 *
 * 调用时机：renderWithHooks / updateFunctionComponent 等渲染函数开始执行时。
 *
 * 核心职责：
 *   1. 设置全局变量，为后续 useContext 调用做准备。
 *   2. 检查是否有待处理的 Context 更新，如果有则标记该 Fiber 需要重新渲染。
 *   3. 重置 Context 依赖链表，为本次渲染重新收集依赖。
 */
export function prepareToReadContext(
  workInProgress: Fiber,
  renderLanes: Lanes
): void {
  // 记录当前正在渲染的 Fiber 节点，后续 useContext 会用到。
  currentlyRenderingFiber = workInProgress
  // 重置上一个 Context 依赖节点，后续读取 Context 时会重新构建链表。
  lastContextDependency = null
  // 重置上一个被完全观察的 Context，后续会重新记录。
  lastFullyObservedContext = null

  const dependencies = workInProgress.dependencies
  if (dependencies !== null) {
    const firstContext = dependencies.firstContext
    if (firstContext !== null) {
      // 判断 dependencies.lanes（Context 依赖的更新优先级）是否与 renderLanes（本次渲染要处理的优先级）有交集。
      // 如果有，说明这个 Fiber 依赖的 Context 值在上次渲染后发生了变化，需要标记该 Fiber "接收到了更新"，确保它会重新渲染。
      if (includesSomeLane(dependencies.lanes, renderLanes)) {
        markWorkInProgressReceivedUpdate()
      }
      // 重置 Context 依赖链表头指针。
      // 本次渲染过程中，每次调用 useContext 都会重新挂载依赖节点，所以旧的链表可以清空，避免残留上一次渲染的依赖信息。
      dependencies.firstContext = null
    }
  }
}

/**
 * 将 Context 变化向上传播，标记所有祖先节点的 childLanes。
 *
 * 调用时机：propagateContextChange 中找到 Context 消费者后调用。
 *
 * 核心职责：
 *   从消费者开始，向上遍历到 propagationRoot。
 *   将 renderLanes 合并到每个祖先的 childLanes 中。
 *   确保渲染能正确传播到消费者。
 *
 * @param parent - 开始传播的父节点（消费者的 return）
 * @param renderLanes - 本次渲染的优先级
 * @param propagationRoot - 传播的根节点（到达这里就停止）
 */
export function scheduleContextWorkOnParentPath(
  parent: Fiber | null,
  renderLanes: Lanes,
  propagationRoot: Fiber
): void {
  let node = parent
  while (node !== null) {
    const alternate = node.alternate
    if (!isSubsetOfLanes(node.childLanes, renderLanes)) {
      node.childLanes = mergeLanes(node.childLanes, renderLanes)
      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes)
      }
    } else if (
      alternate !== null &&
      !isSubsetOfLanes(alternate.childLanes, renderLanes)
    ) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes)
    } else {
      // node.childLanes 和 alternate.childLanes 都包含 renderLanes → 理论上这里可以 break。
      // 但 Offscreen 或 fallback 树中 childLanes 可能不一致。所以继续循环，确保传播完整。
    }
    if (node === propagationRoot) {
      break
    }
    node = node.return
  }
}
/**
 * 传播 Context 变化到子树中的所有消费者。
 *
 * 调用时机：Context Provider 的值变化时调用。
 *
 * 核心职责：
 *   1. 遍历 Provider 的子树。
 *   2. 找到消费了该 Context 的组件。
 *   3. 标记这些组件需要重新渲染。
 *   4. 向上传播更新，标记祖先节点的 childLanes。
 *
 * @param workInProgress - Context Provider 的 Fiber 节点
 * @param context - 值发生变化的 Context
 * @param renderLanes - 本次渲染的优先级
 */
function propagateContextChange_eager<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): void {
  let fiber = workInProgress.child
  if (fiber !== null) {
    // Set the return pointer of the child to the work-in-progress fiber.
    fiber.return = workInProgress
  }
  while (fiber !== null) {
    let nextFiber

    // Visit this fiber.
    const list = fiber.dependencies
    if (list !== null) {
      nextFiber = fiber.child

      let dependency = list.firstContext
      while (dependency !== null) {
        // Check if the context matches.
        if (dependency.context === context) {
          // Match! Schedule an update on this fiber.
          if (fiber.tag === ClassComponent) {
            // 类组件需要 ForceUpdate 来跳过 shouldComponentUpdate，确保 Context 变化一定触发更新；函数组件没有 shouldComponentUpdate，只需标记 lanes 即可。
            // Schedule a force update on the work-in-progress.
            // TODO: 待实现。
          }

          fiber.lanes = mergeLanes(fiber.lanes, renderLanes)
          const alternate = fiber.alternate
          if (alternate !== null) {
            alternate.lanes = mergeLanes(alternate.lanes, renderLanes)
          }
          // 将 Context 变化向上传播，标记所有祖先节点的 childLanes。
          scheduleContextWorkOnParentPath(
            fiber.return,
            renderLanes,
            workInProgress
          )

          // list.lanes 在 prepareToReadContext 中被使用，用于判断是否有待处理的 Context 更新。
          // Mark the updated lanes on the list, too.
          list.lanes = mergeLanes(list.lanes, renderLanes)

          // Since we already found a match, we can stop traversing the
          // dependency list.
          break
        }
        dependency = dependency.next
      }
    } else if (fiber.tag === ContextProvider) {
      // 是同一个 Context 的 Provider → 停止向下遍历；是不同 Context 的 Provider → 继续向下遍历。
      nextFiber = fiber.type === workInProgress.type ? null : fiber.child
    } else {
      // Traverse down.
      nextFiber = fiber.child
    }

    if (nextFiber !== null) {
      // Set the return pointer of the child to the work-in-progress fiber.
      nextFiber.return = fiber
    } else {
      // No child. Traverse to next sibling.
      nextFiber = fiber
      while (nextFiber !== null) {
        if (nextFiber === workInProgress) {
          // We're back to the root of this subtree. Exit.
          nextFiber = null
          break
        }
        const sibling = nextFiber.sibling
        if (sibling !== null) {
          // Set the return pointer of the sibling to the work-in-progress fiber.
          sibling.return = nextFiber.return
          nextFiber = sibling
          break
        }
        // No more siblings. Traverse up.
        nextFiber = nextFiber.return
      }
    }
    fiber = nextFiber
  }
}
export function propagateContextChange<T>(
  workInProgress: Fiber,
  context: ReactContext<T>,
  renderLanes: Lanes
): void {
  propagateContextChange_eager(workInProgress, context, renderLanes)
}

/**
 * 重置 Context 依赖追踪的模块级变量。
 *
 * 调用时机：渲染完成后调用，清理 Context 相关状态。
 *
 * 重置的变量：
 *   - currentlyRenderingFiber：当前正在渲染的 Fiber。
 *   - lastContextDependency：最后一个 Context 依赖。
 *   - lastFullyObservedContext：最后完全观察的 Context（未启用）。
 */
export function resetContextDependencies(): void {
  currentlyRenderingFiber = null
  lastContextDependency = null
  lastFullyObservedContext = null
}
