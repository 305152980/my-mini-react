import {
  type Lane,
  type Lanes,
  NoLane,
  NoLanes,
  mergeLanes,
  isSubsetOfLanes,
} from './ReactFiberLane'
import {
  isUnsafeClassRenderPhaseUpdate,
  markSkippedUpdateLanes,
} from './ReactFiberWorkLoop'
import type { Fiber, FiberRoot } from './ReactInternalTypes'
import {
  unsafe_markUpdateLaneFromFiberToRoot,
  enqueueConcurrentClassUpdate,
} from './ReactFiberConcurrentUpdates'
import { Callback } from './ReactFiberFlags'
import assign from '@my-mini-react/shared/assign'

/**
 * React 状态更新的四种类型（Tag）。
 * 在创建 Update 对象时，用来指示 React 在处理更新队列时应采取的策略。
 */
/** 常规状态更新 (默认)。会将本次的新状态与前一次的状态进行合并。*/
export const UpdateState = 0
/** 替换状态。直接丢弃前一次的状态，完全使用新提供的状态。*/
export const ReplaceState = 1
/** 强制更新。保留前一次的原始状态不变，但强制当前组件及其子树重新渲染。*/
export const ForceUpdate = 2
/** 捕获更新。用于错误边界或 Suspense 流程中捕获异常，并标记对应的副作用标签。*/
export const CaptureUpdate = 3

type UpdateTag = 0 | 1 | 2 | 3
export type Update<State> = {
  // 更新触发的时间戳
  eventTime: number
  // 优先级通道
  lane: Lane
  // 更新的类型（如 UpdateState, ReplaceState 等）
  tag: UpdateTag
  // 更新的内容（如 setState 传入的值或函数）
  payload: any
  // 更新完成后的回调函数
  callback: (() => any) | null
  // 指向下一个 Update 对象，形成单向链表
  next: Update<State> | null
}

export type SharedQueue<State> = {
  // 【待处理的更新队列（环形链表的尾节点）】
  // pending 指向当前最新的一个 Update 对象。
  // 由于 Update 之间通过 next 指针构成了一个单向环形链表，
  // 通过 pending.next 就可以轻松获取到链表的第一个 Update 对象。
  pending: Update<State> | null

  // 【更新任务的优先级集合】
  // 使用位运算（Lanes 模型）来记录当前队列中所有待处理 Update 的优先级。
  // React 在调度时，会根据这个字段快速判断当前是否有高优先级的任务需要插队处理。
  lanes: Lanes
}

export type UpdateQueue<State> = {
  // 【基础状态】
  // 表示当前队列的基础 state。在处理更新时，React 会基于这个 baseState
  // 依次应用后续的 Update 对象，从而计算出最新的 state。
  baseState: State

  // 【基础更新队列的队首】
  // 指向基础队列中的第一个 Update 对象。
  // 基础队列中存放的是上一轮渲染遗留下来的、或者需要跨帧处理的低优先级更新。
  firstBaseUpdate: Update<State> | null

  // 【基础更新队列的队尾】
  // 指向基础队列中的最后一个 Update 对象。
  lastBaseUpdate: Update<State> | null

  // 【共享队列】
  // 这是一个在多个副本（current 和 workInProgress Fiber）之间共享的队列。
  // 当我们调用 setState 或 dispatch 时，新创建的 Update 对象会被推入这个 shared 队列中。
  shared: SharedQueue<State>

  // 【副作用回调队列】
  // 用于保存带有 callback 回调函数的 Update 对象。
  // 在 commit 阶段完成后，React 会遍历这个数组，依次执行里面存储的回调函数。
  effects: Array<Update<State>> | null
}

/**
 * 创建一个新的更新对象
 */
export function createUpdate<State = any>(
  eventTime: number,
  lane: Lane
): Update<State> {
  const update: Update<State> = {
    eventTime,
    lane,

    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
  }
  return update
}

/**
 * 为 Fiber 节点初始化更新队列
 */
export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      lanes: NoLanes,
    },
    effects: null,
  }
  fiber.updateQueue = queue
}

// pending = a -> a
// pending = b -> a -> b
// pending = c -> a -> b -> c
/**
 * 将更新对象加入更新队列（以环形链表的形式存储）
 */
export function enqueueUpdate<State>(
  fiber: Fiber,
  update: Update<State>,
  lane: Lane
): FiberRoot | null {
  const updateQueue = fiber.updateQueue
  if (updateQueue === null) {
    return null
  }

  const sharedQueue: SharedQueue<State> = updateQueue.shared

  if (isUnsafeClassRenderPhaseUpdate(fiber)) {
    const pending = sharedQueue.pending
    if (pending === null) {
      // 如果是首个更新，让 next 指向自己形成自环
      update.next = update
    } else {
      // 如果不是首个更新，将其插入到环形链表的末尾
      update.next = pending.next
      pending.next = update
    }
    // 更新 pending 指针，使其始终指向链表的最后一个节点
    sharedQueue.pending = update

    return unsafe_markUpdateLaneFromFiberToRoot(fiber, lane)
  } else {
    return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane)
  }
}

/**
 * 克隆更新队列（确保 workInProgress 拥有独立于 current 的更新队列）
 *
 * @description
 * React 采用双缓存机制，render 阶段不能直接修改 current tree 上的数据。
 * 由于初始创建时 workInProgress.updateQueue 直接指向 current.updateQueue，
 * 此函数用于在必要时将其深拷贝一份，从而保证本轮 render 可以安全计算更新，
 * 避免污染当前已经生效并提交到页面的 Fiber tree。
 *
 * @param {Fiber} current - 当前屏幕上正在显示的旧节点
 * @param {Fiber} workInProgress - 正在内存中构建的新节点
 */
export function cloneUpdateQueue<State>(
  current: Fiber,
  workInProgress: Fiber
): void {
  // 获取新节点的更新队列并断言为泛型类型。
  const queue = workInProgress.updateQueue as UpdateQueue<State>
  // 获取旧节点的更新队列并断言为泛型类型。
  const currentQueue = current.updateQueue as UpdateQueue<State>
  // 核心防御逻辑：判断两个节点是否共用了同一个 updateQueue 引用。
  if (queue === currentQueue) {
    // 如果引用相同，说明尚未克隆。此时需要基于 currentQueue 创建一个全新的对象，将基础状态、基础更新链表、共享队列以及副作用列表等关键属性一并复制过来。
    // 这样后续 processUpdateQueue 对队列的任何修改，都只会影响 workInProgress，而不会破坏 current 树的数据完整性。
    const clone: UpdateQueue<State> = {
      baseState: currentQueue.baseState, // 克隆基础状态
      firstBaseUpdate: currentQueue.firstBaseUpdate, // 克隆基础更新链表的头指针
      lastBaseUpdate: currentQueue.lastBaseUpdate, // 克隆基础更新链表的尾指针
      shared: currentQueue.shared, // 共享的更新队列（结构共享）
      effects: currentQueue.effects, // 克隆副作用列表
    }
    // 将克隆出的新队列赋值给 workInProgress，完成隔离。
    workInProgress.updateQueue = clone
  }
}

// // TODO: 这个函数与源码的差别有点大，目前只是简化版实现。
// /**
//  * @description 纯函数：处理状态更新队列，根据优先级计算最新状态，并整理遗留更新。
//  *
//  * **核心逻辑说明：**
//  * 1.  **输入**：基于上一轮渲染完成后的基准状态 (baseState)，遍历待处理的更新链表。
//  * 2.  **筛选**：根据当前渲染优先级 (renderLane) 决定是否跳过某些低优先级更新。
//  * 3.  **输出**：
//  *     - `memoizedState`: 本次渲染最终要展示的状态（已应用高优先级更新）。
//  *     - `baseState`: 下一次渲染的计算起点。如果存在被跳过的更新，它将停留在被跳过更新之前的状态；如果没有跳过，它等于本次计算出的最新状态。
//  *     - `baseQueue`: 下一次渲染时仍需处理的更新链表（环形链表的尾节点引用）。
//  *
//  * @param baseState State - 上一次渲染完成后的基准状态，也是本次计算的初始状态。
//  * @param pendingUpdate Update<State> | null - 待处理的环形更新链表（传入的是尾节点）。
//  * @param renderLane Lane - 当前渲染任务的优先级通道。
//  * @returns {{
//  *   memoizedState: State,
//  *   baseState: State,
//  *   baseQueue: Update<State> | null
//  * }}
//  */
// export function processUpdateQueue<State>(
//   baseState: State,
//   pendingUpdate: Update<State> | null,
//   renderLane: Lane
// ): {
//   memoizedState: State
//   baseState: State
//   baseQueue: Update<State> | null
// } {
//   // 初始化返回值，默认情况下结果等于传入的初始状态，并且没有剩余的更新。
//   const result: ReturnType<typeof processUpdateQueue<State>> = {
//     memoizedState: baseState,
//     baseState: baseState,
//     baseQueue: null,
//   }
//   // 如果有待处理的更新队列，开始遍历计算。
//   if (pendingUpdate !== null) {
//     // 获取环形链表的头节点。（在此记录，用于结束循环。）
//     const first = pendingUpdate.next
//     // 初始化遍历指针，从头节点开始。
//     let pending = pendingUpdate.next as Update<State>

//     // 定义下一轮渲染的 baseState（初始为传入的 baseState）
//     let newBaseState = baseState

//     // 定义当前正在计算的最新状态（初始为传入的 baseState）。
//     let newState = baseState

//     // 定义下一轮 baseQueue 的首尾节点（用于存放被跳过的低优先级更新）。
//     let newBaseQueueFirst: Update<State> | null = null
//     let newBaseQueueLast: Update<State> | null = null

//     // 遍历环形链表。
//     do {
//       // 获取当前遍历到的更新任务的优先级。
//       const updateLane = pending.lane
//       if (!isSubsetOfLanes(renderLane, updateLane)) {
//         // 情况一：当前更新的优先级不够（未被当前渲染的 renderLane 包含），克隆这个被跳过的更新，准备放入下一次的 baseQueue 中。
//         const clone: Update<State> = {
//           eventTime: pending.eventTime,
//           lane: pending.lane,

//           tag: pending.tag,
//           payload: pending.payload,
//           callback: pending.callback,

//           next: null,
//         }
//         if (newBaseQueueFirst === null) {
//           // 如果是遇到的第一个被跳过的更新。
//           newBaseQueueFirst = clone
//           newBaseQueueLast = clone
//           // 【关键】将“下次计算的起点”定格在遇到这个低优先级更新之前的状态。
//           newBaseState = newState
//         } else {
//           // 如果 baseQueue 中已经有被跳过的更新，将其追加到链表尾部。
//           ;(newBaseQueueLast as Update<State>).next = clone
//           newBaseQueueLast = clone
//         }
//       } else {
//         // 情况二：优先级匹配，可以执行此更新。
//         if (newBaseQueueLast !== null) {
//           // 如果前面有被跳过的低优先级更新（baseQueue 不为空），
//           // 为了保证下次计算连贯，需要把当前这个高优先级更新也“降级”复制一份，追加到 baseQueue 中。
//           // 设置为 NoLane，表示这是一个被降级的更新，保证其在下次计算中不会被跳过。
//           const clone: Update<State> = {
//             eventTime: pending.eventTime,
//             lane: NoLane,

//             tag: pending.tag,
//             payload: pending.payload,
//             callback: pending.callback,

//             next: null,
//           }
//           newBaseQueueLast.next = clone
//           newBaseQueueLast = clone
//         }
//         // 执行状态更新逻辑（支持函数式和直接赋值）。
//         if (pending.payload instanceof Function) {
//           newState = pending.payload(newState)
//         } else {
//           newState = pending.payload
//         }
//       }
//       // 指针后移，继续遍历下一个更新。
//       pending = pending.next as Update<State>
//     } while (pending !== first) // 当指针重新指回头节点时，说明环形链表遍历完毕。

//     // 遍历结束后的收尾工作。
//     if (newBaseQueueLast === null) {
//       // 如果 newBaseQueueLast 依然是 null，说明没有任何更新被跳过。
//       // 此时下次的计算起点（baseState）就等于当前计算出的最新状态（newState）。
//       newBaseState = newState
//     } else {
//       // 如果有更新被跳过，需要将 baseQueue 重新连成环形链表。
//       newBaseQueueLast.next = newBaseQueueFirst
//     }
//     // 将计算出的结果赋值给返回值。
//     // 记录下一轮渲染的计算起点。
//     result.baseState = newBaseState
//     // 记录本次渲染最终要展示的最新状态。
//     result.memoizedState = newState
//     // 记录遗留的任务清单（环形链表尾节点）。
//     result.baseQueue = newBaseQueueLast
//   }

//   return result
// }

/**
 * 根据单个更新对象（Update）的具体类型，结合当前状态计算出新的状态。
 *
 * @description
 * 这是 React 更新队列处理（processUpdateQueue）中的核心计算函数。
 * 在遍历更新链表时，每遇到一个需要执行的更新，都会调用此方法来获取应用该更新后的最新状态。
 *
 * @param workInProgress - 当前正在构建的 Fiber 节点。
 * @param queue - 当前组件的更新队列。作为上下文传入，便于追踪更新来源。
 * @param update - 当前正在处理的更新对象。包含了更新的类型（tag）、携带的数据（payload）等关键信息。
 * @param prevState - 当前组件的最新状态。作为计算新状态的基准。
 * @param nextProps - 组件即将接收到的新 props。作为计算新状态时的上下文。
 * @param instance - 当前组件的实例（仅针对 Class 组件）。用于在执行 payload 函数时，正确绑定 this 指向。
 * @returns 经过当前更新计算后的新状态（newState）。如果更新是无效操作，则原样返回 prevState。
 */
function getStateFromUpdate<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  update: Update<State>,
  prevState: State,
  nextProps: any,
  instance: any
): any {
  switch (update.tag) {
    // 完全替换(内部使用)。
    case ReplaceState: {
    }
    // 捕获错误。
    case CaptureUpdate: {
    }
    // 普通更新。
    case UpdateState: {
      const payload = update.payload
      let partialState
      if (typeof payload === 'function') {
        // Updater function
        partialState = payload.call(instance, prevState, nextProps)
      } else {
        // Partial state object
        partialState = payload
      }
      if (partialState === null || partialState === undefined) {
        // 如果 setState 返回 null 或 undefined，就不更新 state，保持原样。
        return prevState
      }
      // 将部分状态与先前状态进行合并。
      return assign({}, prevState, partialState)
    }
    // 强制更新。
    case ForceUpdate: {
    }
  }
  return prevState
}

/**
 * 处理组件的更新队列，计算并得出最新的状态。
 *
 * @description
 * 这是 React 状态更新机制的核心函数，在 Render 阶段自顶向下遍历 Fiber 树时被调用。
 * 它的主要职责是：
 * 1. 合并队列：将新产生的更新（shared.pending）与上一轮遗留的低优先级更新（baseUpdate）合并。
 * 2. 按优先级计算：遍历合并后的链表，高优先级更新被执行，低优先级更新被跳过并保留。
 * 3. 收集副作用：将带有回调函数的更新收集起来，等待 Commit 阶段执行。
 *
 * @param workInProgress - 当前正在构建的 Fiber 节点。
 * @param props - 组件即将接收到的新 props。
 * @param instance - 当前组件的实例（仅针对 Class 组件，用于绑定 this）。
 * @param renderLanes - 当前渲染周期允许的优先级车道（Lanes）。
 */
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: any,
  instance: any,
  renderLanes: Lanes
): void {
  // workInProgress.updateQueue 是单向非循环链表。
  // queue.shared.pending 是单向循环链表。

  // workInProgress.updateQueue 在以下两种 Fiber 类型上一定存在（不会为 null）：ClassComponent、HostRoot。
  // 因为在创建这两种 Fiber 时，都会调用 initializeUpdateQueue。
  const queue = workInProgress.updateQueue as UpdateQueue<State>

  // 提取当前 workInProgress 节点上的“基础更新队列”（Base Update Queue）的头尾指针。
  let firstBaseUpdate = queue.firstBaseUpdate
  let lastBaseUpdate = queue.lastBaseUpdate

  // 检查是否有待处理的更新。如果有，则将它们转移到基础队列。
  let pendingQueue = queue.shared.pending
  if (pendingQueue !== null) {
    // 清空 shared.pending 指针。表示当前已经没有待处理的新更新了。
    queue.shared.pending = null

    // 挂起的队列是循环的。断开第一个和最后一个之间的指针连接，使其成为非循环队列。
    const lastPendingUpdate = pendingQueue
    const firstPendingUpdate = lastPendingUpdate.next as Update<State>
    lastPendingUpdate.next = null

    // 将待处理的更新添加到基础队列中。
    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate
    } else {
      lastBaseUpdate.next = firstPendingUpdate
    }
    lastBaseUpdate = lastPendingUpdate

    // 将待处理的更新添加到 current 的基础队列中。
    // 为什么要同步 current 和 workInProgress 的队列？
    //   把新收到的更新同时保存到两棵树上，这样即使中途中断重来，更新也不会丢失。
    const current = workInProgress.alternate
    if (current !== null) {
      // current.updateQueue 在以下两种 Fiber 类型上一定存在（不会为 null）：ClassComponent、HostRoot。
      // 因为在创建这两种 Fiber 时，都会调用 initializeUpdateQueue。
      const currentQueue = current.updateQueue as UpdateQueue<State>
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate
      // 检查是否已经同步过。如果不相同，说明 current 还没有这些更新，需要同步。
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate
      }
    }
  }

  // 如果有待处理的更新队列，开始遍历计算。
  if (firstBaseUpdate !== null) {
    // 当前正在计算的最新状态（初始值为传入的 baseState）。
    let newState = queue.baseState
    let newLanes = NoLanes

    // 下一轮渲染的 baseState。
    let newBaseState: State | null = null
    // 下一轮渲染的 firstBaseUpdate。
    let newFirstBaseUpdate: Update<State> | null = null
    // 下一轮渲染的 lastBaseUpdate。
    let newLastBaseUpdate: Update<State> | null = null

    // 遍历链表。
    let update = firstBaseUpdate
    do {
      // TODO: Don't need this field anymore
      const updateEventTime = update.eventTime

      // 获取当前遍历到的更新任务的优先级。
      const updateLane = update.lane

      const shouldSkipUpdate = !isSubsetOfLanes(renderLanes, updateLane)
      if (shouldSkipUpdate) {
        // 情况一：当前更新的优先级不够（未被当前渲染的 renderLane 包含），克隆这个被跳过的更新，准备放入下一次的 baseUpdateQueue 中。
        const clone: Update<State> = {
          eventTime: updateEventTime,
          lane: updateLane,

          tag: update.tag,
          payload: update.payload,
          callback: update.callback,

          next: null,
        }
        if (newLastBaseUpdate === null) {
          // 如果是遇到的第一个被跳过的更新。
          newFirstBaseUpdate = newLastBaseUpdate = clone
          // 【关键】将“下次计算的起点”定格在遇到这个低优先级更新之前的状态。
          newBaseState = newState
        } else {
          // 如果 baseUpdateQueue 中已经有被跳过的更新，将其追加到链表尾部。
          newLastBaseUpdate.next = clone
          newLastBaseUpdate = clone
        }
        // 更新队列中剩余的优先级。
        newLanes = mergeLanes(newLanes, updateLane)
      } else {
        // 情况二：优先级匹配，可以执行此更新。
        if (newLastBaseUpdate !== null) {
          // 如果前面有被跳过的低优先级更新（baseUpdateQueue 不为空），
          // 为了保证下次计算连贯，需要把当前这个高优先级更新也“降级”复制一份，追加到 baseQueue 中。
          // 设置为 NoLane，表示这是一个被降级的更新，保证其在下次计算中不会被跳过。
          const clone: Update<State> = {
            eventTime: updateEventTime,
            lane: NoLane,

            tag: update.tag,
            payload: update.payload,
            callback: update.callback,

            next: null,
          }
          newLastBaseUpdate.next = clone
          newLastBaseUpdate = clone
        }
        // Process this update.
        newState = getStateFromUpdate(
          workInProgress,
          queue,
          update,
          newState,
          props,
          instance
        )

        // 提取当前更新对象上绑定的回调函数（通常是 setState 的第二个参数）。
        const callback = update.callback
        // 防止已经处理过的更新，重复添加回调。
        if (callback !== null && update.lane !== NoLane) {
          // 在当前 workInProgress 节点的 flags 上打上 Callback 标记。
          // 这会告诉 React 的提交阶段（Commit Phase），该组件有副作用需要处理。
          workInProgress.flags |= Callback
          const effects = queue.effects
          if (effects === null) {
            // 如果 effects 数组尚未初始化，则创建一个新数组并放入当前 update。
            queue.effects = [update]
          } else {
            // 如果 effects 数组已存在，则直接将当前 update 追加到数组尾部。
            effects.push(update)
          }
        }
      }
      // 指针后移，继续遍历下一个更新。
      update = update.next as Update<State>
      if (update === null) {
        // 为什么又要检查 pendingQueue？
        //   因为在处理更新的过程中，可能又产生了新的更新！
        pendingQueue = queue.shared.pending
        if (pendingQueue === null) {
          break
        } else {
          // 挂起的队列是循环的。断开第一个和最后一个之间的指针连接，使其成为非循环队列。
          const lastPendingUpdate = pendingQueue
          const firstPendingUpdate = lastPendingUpdate.next as Update<State>
          lastPendingUpdate.next = null

          // 将待处理的更新添加到基础队列中。
          update = firstPendingUpdate
          queue.lastBaseUpdate = lastPendingUpdate

          queue.shared.pending = null
        }
      }
    } while (true)

    if (newLastBaseUpdate === null) {
      // 如果 newLastBaseUpdate 依然是 null，说明没有任何更新被跳过。
      // 此时下次的计算起点（baseState）就等于当前计算出的最新状态（newState）。
      newBaseState = newState
    }

    queue.baseState = newBaseState as State
    queue.firstBaseUpdate = newFirstBaseUpdate
    queue.lastBaseUpdate = newLastBaseUpdate

    markSkippedUpdateLanes(newLanes)
    workInProgress.lanes = newLanes
    // 记录本次渲染最终要展示的最新状态。
    workInProgress.memoizedState = newState
  }
}
