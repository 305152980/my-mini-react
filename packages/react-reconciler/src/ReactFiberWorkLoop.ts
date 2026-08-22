import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { createWorkInProgress } from './ReactFiber'
import { beginWork } from './ReactFiberBeginWork'
import { completeWork } from './ReactFiberCompleteWork'
import {
  commitPassiveUnmountEffects,
  commitPassiveMountEffects,
  commitLayoutEffects,
  commitMutationEffects,
} from './ReactFiberCommitWork'
import {
  unstable_scheduleCallback as Scheduler_scheduleCallback,
  unstable_cancelCallback as Scheduler_cancelCallback,
  unstable_shouldYield as shouldYield,
  unstable_ImmediatePriority as ImmediateSchedulerPriority,
  unstable_UserBlockingPriority as UserBlockingSchedulerPriority,
  unstable_NormalPriority as NormalSchedulerPriority,
  unstable_IdlePriority as IdleSchedulerPriority,
  type PriorityLevel,
} from '@my-mini-react/scheduler'
import {
  type Lane,
  type Lanes,
  NoLane,
  NoLanes,
  SyncLane,
  getNextLanes,
  mergeLanes,
  markRootUpdated,
  getHighestPriorityLane,
  NoTimestamp,
  markRootFinished,
  includesSomeLane,
  pickArbitraryLane,
} from './ReactFiberLane'
import {
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
  lanesToEventPriority,
  lowerEventPriority,
} from './ReactEventPriorities'
import {
  MutationMask,
  NoFlags,
  Incomplete,
  PassiveMask,
} from './ReactFiberFlags'
import {
  scheduleSyncCallback,
  flushSyncCallbacks,
} from './ReactFiberSyncTaskQueue'
import type { SchedulerCallback } from './Scheduler'
import { getCurrentTime as now } from '@my-mini-react/shared/utils'
import {
  finishQueueingConcurrentUpdates,
  getConcurrentlyUpdatedLanes,
} from './ReactFiberConcurrentUpdates'
import {
  push as pushToStack,
  pop as popFromStack,
  createCursor,
  type StackCursor,
} from './ReactFiberStack'
import {
  getCurrentEventPriority,
  supportsMicrotasks,
  scheduleMicrotask,
} from 'ReactFiberHostConfig'

type ExecutionContext = number

export const NoContext = /*             */ 0b000
export const BatchedContext = /*        */ 0b001
export const RenderContext = /*         */ 0b010
export const CommitContext = /*         */ 0b100

let executionContext: ExecutionContext = NoContext

// 正在处理中的当前 Fiber 节点指针
// 类似于遍历 Fiber 树时的游标，始终指向当前执行工作单元（performUnitOfWork）的节点。
// 随着 workLoop 的执行，它会不断向子节点或兄弟节点移动，直到整棵树遍历完毕变为 null。
let workInProgress: Fiber | null = null
// 当前正在进行渲染工作的根节点（FiberRoot）
// 记录本次更新是在哪个根节点上发起的，确保全局只有一个在跑的任务。
// 结合 workInProgress，React 可以在渲染被中断后重启时恢复现场，知道该继续处理哪棵树的哪个节点。
let workInProgressRoot: FiberRoot | null = null

// 用来记录当前正在渲染的 Lanes（作为 wipLanes 传给 getNextLanes）
let workInProgressRootRenderLanes: Lanes = NoLanes
// 子树渲染时需要处理的 Lanes
let subtreeRenderLanes: Lanes = NoLanes
// 在当前渲染阶段中更新的 Lanes
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes
// 记录在当前渲染周期中被跳过（未处理）的更新车道（Lanes）。
let workInProgressRootSkippedLanes: Lanes = NoLanes

// 不知道怎么注释更贴切。
let rootDoesHavePassiveEffects: boolean = false
// 不知道怎么注释更贴切。root.finishedLanes。
let pendingPassiveEffectsLanes: Lanes = NoLanes
// 不知道怎么注释更贴切。
let rootWithPendingPassiveEffects: FiberRoot | null = null

// Render 阶段（具体来说是 renderRootSync 或 renderRootConcurrent 工作循环）的退出状态码
type RootExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6
// 正在渲染中
// 这通常发生在并发模式下，React 处理完一个时间片后主动让出主线程，此时 Fiber 树只构建了一半，需要等待下一次调度继续执行。
const RootInProgress = 0
// 致命错误
// 表示渲染过程中出现了无法恢复的严重异常。
// 遇到此状态时，React 会重置全局的工作栈（prepareFreshStack），标记根节点为挂起状态，并直接抛出该致命错误终止程序。
const RootFatalErrored = 1
// 普通错误
// 表示渲染过程中抛出了错误，但属于可尝试恢复的类型。
// React 通常会尝试降级为同步模式重新渲染一次；如果第二次仍然失败，则会放弃重试，直接提交当前已经生成的带有错误的 Fiber 树。
const RootErrored = 2
// 正常挂起
// 表示渲染遇到了 Suspense 组件且异步数据尚未准备好。
// 这是一种正常的挂起状态，React 会根据具体情况决定是立即提交降级视图（Fallback），还是延迟一段时间再提交。
const RootSuspended = 3
// 延迟挂起
// 同样表示遇到了 Suspense 挂起，但 React 认为不应该立刻展示 Loading 状态。
// 为了避免页面频繁闪烁，React 会故意延迟一小段时间（例如使用 JND 算法计算出的极短延迟），给数据加载一点缓冲时间，看看能否在用户察觉前完成加载。
const RootSuspendedWithDelay = 4
// 渲染完成
// 表示整棵 Fiber 树已经顺利、完整地构建完毕。
// 这是最理想的状态，接下来 React 会将这棵树赋值给 root.finishedWork，并正式进入 Commit 阶段将其应用到真实 DOM 上。
const RootCompleted = 5
// 未完成（被中断）
// 这种情况仅会发生在并发渲染模式中。表示渲染过程因为某些特殊原因（如高优先级任务插队）被中途打断，未能产出一棵完整且一致的 Fiber 树。
// 此时 React 不会提交任何 DOM 变更，而是标记当前根节点为挂起状态，让出主线程，等待后续合适的时机重新调度。
const RootDidNotComplete = 6
// 用于记录当前正在进行的 Render 阶段的最终退出状态（Exit Status）。系统的初始预期是“正在渲染中”。
let workInProgressRootExitStatus: RootExitStatus = RootInProgress

/**
 * 从任意 Fiber 节点出发，找到其所属的 FiberRoot，并触发整棵树的渲染。
 * 这是 React 更新调度的入口点之一。
 * @param fiber - 触发更新的起始 Fiber 节点。
 */
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane,
  eventTime: number
): void {
  // // 首先调用 checkForNestedUpdates()，检查是否存在无限嵌套的更新（例如在组件的 render 方法中直接调用 setState），如果超过 50 层就会抛出异常。
  // checkForNestedUpdates()

  // 在应用根节点 (FiberRoot) 的 pendingLanes 属性上标记此次更新的优先级。
  markRootUpdated(root, lane)

  // 这里的源码是 (executionContext & RenderContext) !== NoLanes，是错的。
  // RenderContext 阶段如果触发了任务调度，在这里会被拦截，进而无法立刻实现任务调度。（该任务的调度被延后。）
  if (
    (executionContext & RenderContext) !== NoContext &&
    root === workInProgressRoot
  ) {
    // 记录渲染期间的更新
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane
    )
  } else {
    // 外部更新正常调度
    ensureRootIsScheduled(root)
  }
}

export function ensureRootIsScheduled(root: FiberRoot): void {
  // 获取当前根节点上已存在的调度任务
  const existingCallbackNode = root.callbackNode

  // 在常规的、正常的更新流程中，这个条件 root === workInProgressRoot 几乎永远为 false。
  // root === workInProgressRoot 为 true 的场景：render 阶段，触发的某些页面更新。
  // （这种情况几乎不可能出现，原因：scheduleUpdateOnFiber 中的 (executionContext & RenderContext) !== NoContext && root === workInProgressRoot 拦截。）
  // 综合计算当前需要处理的 Lanes 集合
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  )

  // 情况一：没有任何待处理的更新（nextLanes 为空）
  if (nextLanes === NoLanes) {
    // 既然没活干了，如果之前有正在排队的旧任务，直接将其取消。
    if (existingCallbackNode !== null) {
      Scheduler_cancelCallback(existingCallbackNode)
    }
    // 清空根节点上的任务引用和优先级标记，结束调度。
    root.callbackNode = null
    root.callbackPriority = NoLane
    return
  }

  // 从待处理的 Lanes 集合中，提取出最高的单一优先级。
  const newCallbackPriority = getHighestPriorityLane(nextLanes)
  const existingCallbackPriority = root.callbackPriority

  // 情况二：防抖与复用机制（优先级未变）
  // 如果新更新的优先级和当前已调度任务的优先级一致，说明之前的调度依然有效，直接复用，无需重新调度。
  if (existingCallbackPriority === newCallbackPriority) {
    return
  }

  // 在这个位置，newCallbackPriority 绝对比 existingCallbackPriority 高。
  // 情况三：优先级发生变化（需要“插队”或重新调度）
  // 取消掉之前正在排队的旧任务，准备安排新的调度任务。
  if (existingCallbackNode !== null) {
    Scheduler_cancelCallback(existingCallbackNode)
  }

  let newCallbackNode = null

  // 根据提取出的最高优先级，决定具体的调度策略。
  if (newCallbackPriority === SyncLane) {
    // 策略一：同步调度
    // 将同步渲染任务放入内部的同步队列（syncQueue）中暂存。
    scheduleSyncCallback(
      performSyncWorkOnRoot.bind(null, root) as unknown as SchedulerCallback
    )
    if (supportsMicrotasks) {
      // 预约一个微任务（MicroTask）：在当前宏任务结束、浏览器渲染前执行 flushSyncCallbacks 会去遍历并执行 syncQueue 里的所有任务。
      // 利用微任务特性，即使连续触发多次同步（SyncLane） setState，也只会触发一次批量渲染，避免重复计算。
      //   连续触发多次同步（SyncLane） setState 时，因为 if (curPriority === prevPriority) { return } 这个判断，
      //   会让后续的同步（SyncLane） setState 根本执行不到 scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root) as unknown as SchedulerCallback) 这一行代码。
      scheduleMicrotask!(() => {
        // 微任务加了判断：必须通过检查 executionContext 来确认当前是否处于非 Render/Commit 阶段。
        if (
          (executionContext & (RenderContext | CommitContext)) ===
          NoContext
        ) {
          flushSyncCallbacks()
        }
      })
    } else {
      // Flush the queue in an Immediate task.
      Scheduler_scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks)
    }
    // 同步任务不用像并发任务那样，调度后在 root 上存储 callbackNode 值。
    newCallbackNode = null
  } else {
    // 策略二：并发调度（React 18 的默认并发模式）
    // 将 React 内部的 Lane 优先级转换为 Scheduler 调度器能识别的优先级。
    let schedulerPriorityLevel: PriorityLevel
    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority
        break
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority
        break
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority
        break
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority
        break
      default:
        schedulerPriorityLevel = NormalSchedulerPriority
        break
    }
    // 调用 Scheduler 的 scheduleCallback 安排一个异步可中断的任务。
    // performConcurrentWorkOnRoot 会在时间切片（Time Slicing）机制下执行渲染工作。
    newCallbackNode = Scheduler_scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    )
  }

  // 更新根节点上的任务引用和当前优先级，用于下一次更新时的“防抖与复用”判断。
  root.callbackNode = newCallbackNode
  root.callbackPriority = newCallbackPriority
}

/**
 * 冲刷并执行所有待处理的被动副作用（Passive Effects，即 useEffect）。
 * 该函数会临时降低当前的更新优先级，以确保副作用中产生的新更新不会意外阻塞高优先级的用户交互。
 * @returns {boolean} 是否成功执行了副作用处理。
 */
export function flushPassiveEffects(): boolean {
  // 检查是否存在待处理的被动副作用（Passive Effects）。如果没有需要执行的副作用，直接返回 false。
  if (rootWithPendingPassiveEffects !== null) {
    // 获取这批待处理副作用对应的渲染优先级（Lanes），并将其转换为事件优先级。
    const renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes)
    // 取当前渲染优先级与默认事件优先级（DefaultEventPriority）中的较低者。
    // 这确保了执行 useEffect 时的优先级不会高于正常的用户交互更新。
    const priority = lowerEventPriority(DefaultEventPriority, renderPriority)
    // 暂存当前系统的全局更新优先级，以便稍后恢复。
    const previousPriority = getCurrentUpdatePriority()

    try {
      // 将全局更新优先级设置为刚才计算出的较低优先级。
      setCurrentUpdatePriority(priority)
      // 调用核心实现函数，真正开始遍历并执行所有的卸载和挂载副作用。
      return flushPassiveEffectsImpl()
    } finally {
      // 无论执行过程中是否发生异常，都必须将全局更新优先级恢复到之前的状态。
      // 防止当前的低优先级污染后续其他高优先级的更新任务。
      setCurrentUpdatePriority(previousPriority)
    }
  }
  // 如果没有待处理的副作用，返回 false。
  return false
}

/**
 * flushPassiveEffectsImpl：冲刷被动副作用的核心实现函数。
 * 负责安全地遍历 Fiber 树，依次执行所有旧组件的清理函数（cleanup）和新组件的创建函数（setup）。
 * @returns {boolean} 是否成功执行了本批次的副作用处理。
 */
function flushPassiveEffectsImpl(): boolean {
  // 再次检查：如果没有待处理的被动副作用（Passive Effects），直接返回 false。
  if (rootWithPendingPassiveEffects === null) {
    return false
  }

  // 提取当前需要处理副作用的根节点和优先级（Lanes）。
  const root = rootWithPendingPassiveEffects
  const lanes = pendingPassiveEffectsLanes
  // 必须在执行副作用之前清空，防止在执行过程中产生的新副作用被错误地归入当前批次。
  rootWithPendingPassiveEffects = null
  pendingPassiveEffectsLanes = NoLanes

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // executionContext 里已经包含了 RenderContext 或 CommitContext 中的至少一个，
    // 说明当前正在执行 Render 或 Commit 阶段了，不能再进行 flushPassiveEffects 了，这种情况不应该发生。
    throw new Error('Cannot flush passive effects while already rendering.')
  }

  // 核心机制：保存旧的执行上下文，并打上 CommitContext 标志位。
  // 相当于给当前线程穿上“提交模式”的工作服，告诉整个 React 调度器：“我现在正在处理提交阶段的副作用”。
  // 这样做可以改变内部 API 的行为（例如在 useEffect 中触发 setState 时，强制使用实时时间戳计算优先级）。
  const prevExecutionContext = executionContext
  executionContext |= CommitContext

  // 第一步遍历：执行所有旧组件的卸载销毁函数（destroy / cleanup）。
  // 必须先清理旧的副作用，才能安全地挂载新的副作用。
  commitPassiveUnmountEffects(root.current)
  // 第二步遍历：执行所有新组件的挂载创建函数（create / setup）。
  // 这里会真正调用你在代码中编写的 useEffect 回调。
  commitPassiveMountEffects(root, root.current, lanes, null)

  // 恢复之前的执行上下文，确保后续的浏览器事件或渲染流程不再受此批次的干扰。
  executionContext = prevExecutionContext
  // 刚才的 useEffect 中可能触发了新的同步更新。在这里将同步回调队列冲刷一次，确保这些同步任务被立即执行并处理干净。
  flushSyncCallbacks()
  // 成功完成本批次副作用的处理，返回 true。
  return true
}

/**
 * 同步模式下的根节点工作入口
 */
function performSyncWorkOnRoot(root: FiberRoot): void {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // executionContext 里已经包含了 RenderContext 或 CommitContext 中的至少一个，
    // 说明当前正在执行 Render 或 Commit 阶段了，不能再进入另一个 Render 或 Commit 阶段了，这种情况不应该发生。
    throw new Error('Should not already be working.')
  }

  // 保证状态最新（防止使用过期 State）
  // 刷新上一轮遗留的被动副作用（Passive Effects）。
  flushPassiveEffects()

  // 获取当前需要处理的所有 Lanes 集合（会筛选出当前最高优先级的所有任务）
  // 并发模式因为要处理“随时可能被打断并恢复”的复杂场景，所以必须带上 workInProgressRootRenderLanes 作为上下文；
  // 而同步模式因为“永不中断”，所以可以毫无顾忌地抛弃历史状态，直接用 NoLanes 开启全新的渲染周期。
  const lanes = getNextLanes(root, NoLanes)

  // 如果拿到的 Lanes 集合里不包含同步优先级（SyncLane），说明当前没有同步任务需要处理了。
  if ((lanes & SyncLane) === NoLanes) {
    ensureRootIsScheduled(root)
    return
  }

  // 进入 Render 阶段：同步地构建/更新 Fiber 树
  // 参数 false 代表不可中断，sync 模式下必须一口气执行完，不会像并发模式那样让出主线程。
  const exitStatus = renderRoot(root, lanes, false)

  if (
    exitStatus === RootErrored ||
    exitStatus === RootFatalErrored ||
    exitStatus === RootDidNotComplete
  ) {
    // 对于 RootErrored、RootFatalErrored、RootDidNotComplete 这三种状态的处理，略。
  }

  // 准备进入 Commit 阶段
  // 获取刚刚构建好的、带有最新变化的 Fiber 树（current.alternate 指向的就是 workInProgress 树）。
  const finishedWork = root.current.alternate as Fiber
  // 将构建好的树挂载到 root.finishedWork 上，准备提交。
  root.finishedWork = finishedWork
  // 记录这次完成渲染所对应的 Lanes 集合。
  root.finishedLanes = lanes
  // 正式进入 Commit 阶段，将变化提交到真实 DOM。
  commitRoot(root)

  // 在函数退出前，重新调度一次，确保 Commit 阶段（如 useLayoutEffect）中触发的新更新能被正常安排到下一轮。
  // 如果没有调用 ensureRootIsScheduled(root)，最直接的后果是：如果在 Commit 阶段（特别是执行 useLayoutEffect 时）触发了新的更新，这些新更新将会被“卡死”，永远不会被渲染到页面上。
  ensureRootIsScheduled(root)
}

/**
 * 并发模式下的根节点工作入口
 * 由 Scheduler 调度触发，支持时间切片（可中断）
 */
function performConcurrentWorkOnRoot(
  root: FiberRoot,
  didTimeout: boolean
): any {
  currentEventTime = NoTimestamp

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // executionContext 里已经包含了 RenderContext 或 CommitContext 中的至少一个，
    // 说明当前正在执行 Render 或 Commit 阶段了，不能再进入另一个 Render 或 Commit 阶段了，这种情况不应该发生。
    throw new Error('Should not already be working.')
  }

  // 记录当前任务的回调节点，作为“任务身份证”，用于后续判断任务是否过期或被插队。
  const originalCallbackNode = root.callbackNode

  // 保证状态最新（防止使用过期 State）
  // 刷新上一轮遗留的被动副作用（Passive Effects）。
  const didFlushPassiveEffect = flushPassiveEffects()
  if (didFlushPassiveEffect) {
    // 如果刷新副作用的过程中触发了新的更新，导致当前的 callbackNode 被替换，
    // 说明当前任务已经过期或被更高优先级的任务打断，直接退出，等待下一次调度。
    if (root.callbackNode !== originalCallbackNode) {
      return null
    }
  }

  // 获取当前根节点上待处理的最高优先级更新（Lanes）
  // 并发模式因为要处理“随时可能被打断并恢复”的复杂场景，所以必须带上 workInProgressRootRenderLanes 作为上下文；
  // 而同步模式因为“永不中断”，所以可以毫无顾忌地抛弃历史状态，直接用 NoLanes 开启全新的渲染周期。
  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  )
  // 如果没有待处理的更新，直接退出。
  if (lanes === NoLanes) {
    return null
  }

  // 判断渲染模式。
  const shouldTimeSlice = !didTimeout
  // 执行 Render 阶段，构建 Fiber 树（第三个参数代表是否可中断）。
  const exitStatus = renderRoot(root, lanes, shouldTimeSlice)

  if (exitStatus !== RootInProgress) {
    if (
      exitStatus === RootErrored ||
      exitStatus === RootFatalErrored ||
      exitStatus === RootDidNotComplete
    ) {
      // 对于 RootErrored、RootFatalErrored、RootDidNotComplete 这三种状态的处理，略。
    }

    if (exitStatus === RootCompleted) {
      // TODO: 这里的实现和源码中的实现有点不一样。
      // 【渲染完成】如果状态为 RootCompleted，说明 Fiber 树构建完毕，准备进入 Commit 阶段。
      // 在函数退出前，重新调度一次，确保 Commit 阶段（如 useLayoutEffect）中触发的新更新能被正常安排到下一轮。
      // 如果没有调用 ensureRootIsScheduled(root)，最直接的后果是：如果在 Commit 阶段（特别是执行 useLayoutEffect 时）触发了新的更新，这些新更新将会被“卡死”，永远不会被渲染到页面上。
      ensureRootIsScheduled(root)
      // 获取刚刚构建好的、带有最新变化的 Fiber 树（current.alternate 指向的就是 workInProgress 树）。
      const finishedWork = root.current.alternate
      // 将构建好的树挂载到 root.finishedWork 上，准备提交。
      root.finishedWork = finishedWork
      // 记录这次完成渲染所对应的 Lanes 集合。
      root.finishedLanes = lanes
      // 正式进入 Commit 阶段，将变化提交到真实 DOM。
      commitRoot(root)
      return null
    } else {
      // 其它两种挂起的状态也暂不考虑，略。
    }
  }

  // 在函数退出前，重新调度一次，确保 Commit 阶段（如 useLayoutEffect）中触发的新更新能被正常安排到下一轮。
  // 如果没有调用 ensureRootIsScheduled(root)，最直接的后果是：如果在 Commit 阶段（特别是执行 useLayoutEffect 时）触发了新的更新，这些新更新将会被“卡死”，永远不会被渲染到页面上。
  ensureRootIsScheduled(root)
  // 如果在 scheduleCallback 注册的任务中，callback 函数执行后返回了一个新的函数，调度器会将其视为“当前任务还没做完，需要继续执行”。
  // 这种继续执行，是在下一个宏任务中执行，绝对不是直接继续执行的。
  // 当前任务返回新函数 ➡️ 当前宏任务结束 ➡️ 浏览器有机会去处理其他事情（比如渲染 UI、响应用户点击） ➡️ 浏览器在下一个宏任务队列中取出 Scheduler 通过 MessageChannel 投递的任务 ➡️ 继续执行剩下的工作。
  return performConcurrentWorkOnRoot.bind(null, root)
}

// TODO: 暂不实现。
interface Dispatcher {}
// TODO: 暂不实现。
function pushDispatcher(): Dispatcher {
  return {}
}
// TODO: 暂不实现。
function popDispatcher(prevDispatcher: Dispatcher | null): void {}

/**
 * 准备全新的渲染栈（清场并初始化）
 * 当需要中断当前渲染或开启全新渲染任务时调用
 * @param root Fiber 树的根节点
 * @param lanes 本次更新需要处理的优先级车道集合
 * @returns 返回新创建的 workInProgress 根节点
 */
function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  // 重置根节点上的渲染完成标记，准备开启新一轮渲染。
  root.finishedWork = null
  root.finishedLanes = NoLanes

  // // 当 React 正在构建新的 Fiber 树时，如果突然遇到了无法继续的致命错误，或者被更高优先级的任务强行打断，
  // // React 必须把之前处理到一半、但没走完 completeWork 阶段的节点全部“回滚”并清理干净。
  // if (workInProgress !== null) {
  //   let interruptedWork = workInProgress.return
  //   while (interruptedWork !== null) {
  //     const current = interruptedWork.alternate
  //     // 调用 unwindInterruptedWork 抹去未完成节点上的临时状态和依赖。
  //     unwindInterruptedWork(
  //       current,
  //       interruptedWork,
  //       workInProgressRootRenderLanes
  //     )
  //     interruptedWork = interruptedWork.return
  //   }
  // }

  // 将当前的 FiberRoot 记录到全局变量中。
  workInProgressRoot = root
  // 从 root.current 克隆出一棵全新的 workInProgress 树（双缓冲机制）。
  const rootWorkInProgress = createWorkInProgress(root.current, null)
  // 将新克隆的根节点赋值给全局 workInProgress，作为新一轮渲染的起点。
  workInProgress = rootWorkInProgress

  // 记录本次渲染需要处理的优先级车道集合。
  workInProgressRootRenderLanes = lanes
  // 初始化当前子树的渲染优先级（在整轮渲染开始时，与全局总任务清单保持一致）。
  subtreeRenderLanes = lanes
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes
  // 重置当前渲染周期的全局状态指示牌。
  workInProgressRootExitStatus = RootInProgress
  // 重置被跳过的更新车道记录。
  workInProgressRootSkippedLanes = NoLanes

  // 将分散在并发队列（concurrentQueues）中的更新任务，组装成链表并拼接到 Hook 的 pending 队列中。
  finishQueueingConcurrentUpdates()

  return rootWorkInProgress
}

/**
 * 执行 render 阶段（协调 Fiber 树）
 * @param root Fiber 树的根节点
 * @param lanes 本次更新需要处理的优先级车道集合
 * @param shouldTimeSlice 是否启用时间切片（true为并发模式，false为同步模式）
 */
function renderRoot(
  root: FiberRoot,
  lanes: Lanes,
  shouldTimeSlice: boolean
): RootExitStatus {
  console.log(
    `[ReactFiber] ${shouldTimeSlice ? 'Concurrent' : 'Sync'} render started`,
    root
  )

  // 保存当前的执行上下文，并标记为 RenderContext（进入渲染阶段）。
  const prevExecutionContext = executionContext
  executionContext |= RenderContext
  // 推入 Hooks 的 Dispatcher，确保 useState 等 Hooks 在组件内能正常获取上下文。
  const prevDispatcher = pushDispatcher()

  // 如果本次更新的 Lanes 与当前正在渲染的不一致，说明需要开启全新的渲染栈。
  //   判断当前要处理的更新任务（lanes），和当前正在进行的渲染任务（workInProgressRootRenderLanes）是不是同一批。
  //   如果不是同一批，就必须把之前的半成品扔掉，重新开一局（prepareFreshStack）。
  if (workInProgressRootRenderLanes !== lanes) {
    prepareFreshStack(root, lanes)
  }

  // 核心工作循环：使用 do...while(true) 配合 try...catch。
  // 目的是在遇到可捕获的错误时，通过 handleError 恢复并重新进入循环，实现错误边界的降级渲染。
  do {
    try {
      // 根据是否开启时间切片，执行对应的并发或同步工作循环。
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
      // 正常执行完（或并发模式下时间片耗尽退出）后，跳出循环。
      break
    } catch (thrownValue) {
      // // 捕获 workLoop 中抛出的错误（如组件报错或 Suspense 抛出的 Promise），
      // // 调用 handleError 尝试向上寻找 Error Boundary 进行降级处理。
      // handleError(root, thrownValue)
    }
  } while (true)

  // 待实现。
  // // 正常渲染流程结束后的收尾工作：重置 Context 的相关依赖。
  // resetContextDependencies()

  // 弹出 Hooks 的 Dispatcher，恢复全局环境。
  popDispatcher(prevDispatcher)
  // 恢复之前的执行上下文。
  executionContext = prevExecutionContext

  if (!shouldTimeSlice) {
    if (workInProgress !== null) {
      // This is a sync render, so we should have finished the whole tree.
      throw new Error(
        'Cannot commit an incomplete root. This error is likely caused by a ' +
          'bug in React. Please file an issue.'
      )
    }

    // 清空正在渲染的根节点标记。
    workInProgressRoot = null
    // 清空本次渲染的 Lanes 标记。
    workInProgressRootRenderLanes = NoLanes

    // Return the final exit status.
    return workInProgressRootExitStatus
  } else {
    if (workInProgress !== null) {
      // Still work remaining.
      return RootInProgress
    } else {
      // Completed the tree.

      // 清空正在渲染的根节点标记。
      workInProgressRoot = null
      // 清空本次渲染的 Lanes 标记。
      workInProgressRootRenderLanes = NoLanes

      // Return the final exit status.
      return workInProgressRootExitStatus
    }
  }
}

/**
 * 同步工作循环
 * 只要还有未处理完的 Fiber 节点，就一直执行下去，中间不可中断
 */
function workLoopSync(): void {
  // 只要当前待处理的 Fiber 节点（workInProgress）不为空，就持续循环。
  while (workInProgress !== null) {
    // 执行当前 Fiber 节点的工作单元（包括 beginWork 和 completeWork）。
    performUnitOfWork(workInProgress)
  }
}

// 只要还有待处理的 Fiber 节点（workInProgress 不为空），
// 并且调度器（Scheduler）没有要求让出主线程（!shouldYield），
// 就持续执行当前节点的工作单元。
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress)
  }
}

// 创建一个专门用于追踪“当前子树渲染优先级”的栈游标（StackCursor）。
// 初始值设为 NoLanes，表示在尚未进入任何子树节点时，没有正在处理的渲染车道集合。
export const subtreeRenderLanesCursor: StackCursor<Lanes> =
  createCursor(NoLanes)
/**
 * 在进入子树遍历前，将当前的渲染优先级（subtreeRenderLanes）压栈保存，
 * 并合并当前节点带来的新优先级，作为后续子树遍历的渲染基准。
 *
 * @param fiber - 当前正在处理的 Fiber 节点（用于堆栈的边界校验）
 * @param lanes - 当前节点带来的新渲染优先级（Lanes）集合
 */
export function pushRenderLanes(fiber: Fiber, lanes: Lanes): void {
  pushToStack(subtreeRenderLanesCursor, subtreeRenderLanes, fiber)
  subtreeRenderLanes = mergeLanes(subtreeRenderLanes, lanes)
}
/**
 * 在退出子树遍历时，从堆栈中恢复父级的渲染优先级（subtreeRenderLanes），
 * 确保回到上一层 Fiber 节点时，渲染基准能够正确还原。
 *
 * @param fiber - 当前正在处理的 Fiber 节点（用于堆栈的边界校验）
 * @returns void - 没有返回值，直接修改全局状态并执行出栈操作
 */
export function popRenderLanes(fiber: Fiber): void {
  subtreeRenderLanes = subtreeRenderLanesCursor.current
  popFromStack(subtreeRenderLanesCursor, fiber)
}

/**
 * 执行单个 Fiber 节点的工作单元
 * 这是 React 渲染阶段的核心驱动方法，负责在 Fiber 树上进行深度优先遍历（DFS 左→右→中）
 * 它协调了“递”（beginWork）和“归”（completeWork）两个阶段的流转
 */
function performUnitOfWork(unitOfWork: Fiber): void {
  // 获取当前 Fiber 对应的旧 Fiber（current），用于 Diff 对比或复用。
  const current = unitOfWork.alternate
  // 【递】执行 beginWork 处理当前节点，并返回下一个待处理的子节点（next）。
  // 返回第一个子 Fiber 节点（即 workInProgress.child）。
  let next = beginWork(current, unitOfWork, subtreeRenderLanes)
  // 将待处理的 props 固化为已记忆的 props，标记当前节点的 props 准备工作已完成。
  unitOfWork.memoizedProps = unitOfWork.pendingProps
  if (next === null) {
    // 【归】没有第一个子 Fiber 节点了，开启回溯流程，处理兄弟节点或向上归并。
    // 这个方法内部有一个 do...while(completedWork !== null) 循环。
    completeUnitOfWork(unitOfWork)
  } else {
    // 有第一个子 Fiber 节点，将全局指针指向该子节点，继续深度优先向下遍历。
    workInProgress = next
  }
}

/**
 * 完成当前 Fiber 节点的工作（completeWork），并决定下一个要执行的工作单元。
 * 该方法实现了 Fiber 树深度优先遍历的“归”阶段逻辑：
 *   优先处理当前节点的 completeWork，如果有兄弟节点则交给兄弟节点，
 *   如果没有兄弟节点则回溯到父节点继续处理。
 *
 * @param unitOfWork - 当前正在完成工作的 Fiber 节点（即本次遍历的起点）
 */
function completeUnitOfWork(unitOfWork: Fiber): void {
  // 初始化当前完成工作的节点，从传入的 unitOfWork 开始。
  let completedWork = unitOfWork
  do {
    // 获取当前节点对应的旧 Fiber 节点（alternate）以及它的父节点（return）。
    const current = completedWork.alternate
    const returnFiber = completedWork.return

    // 【健康检查】通过位运算检查当前 Fiber 节点是否被打上了 Incomplete（未完成/报错）标记。
    if ((completedWork.flags & Incomplete) === NoFlags) {
      // 说明当前节点及其子树在 beginWork 阶段执行顺利，没有抛出任何错误。
      // 执行当前节点的“归”阶段工作（如创建/更新 DOM、内部自动冒泡副作用 Flags 等）。
      let next = completeWork(current, completedWork, subtreeRenderLanes)
      // 检查 completeWork 是否在执行过程中产生了新的工作节点（next）。
      //   null（绝大多数情况）：表示当前节点的“归”阶段工作已经彻底完成，没有衍生新任务。
      //   一个特定的 Fiber 节点（极少数特殊场景）：表示在执行 completeWork 时触发了必须立即处理的衍生工作。
      if (next !== null) {
        // 将全局的工作游标 workInProgress 指向这个新生成的节点。
        workInProgress = next
        // 【中断当前回溯循环】直接 return 退出当前的 completeUnitOfWork 函数。
        // 此时，外层的 WorkLoop 会在下一轮循环中捕获到这个新的 workInProgress，
        // 并重新对它执行 beginWork（向下递）和后续的 completeWork（向上归）流程。
        return
      }
    } else {
      // 说明当前节点在处理过程中抛出了错误，未能成功完成工作。
      // 此时绝对不能继续执行正常的 completeWork，否则会引发更严重的崩溃。
      // 实现，略。
    }

    // 核心遍历逻辑：寻找下一个要处理的节点。
    const siblingFiber = completedWork.sibling
    if (siblingFiber !== null) {
      // 如果有兄弟节点：将 workInProgress 指向兄弟节点并返回。
      workInProgress = siblingFiber
      // 【中断当前回溯循环】直接 return 退出当前的 completeUnitOfWork 函数。
      // 此时，外层的 WorkLoop 会在下一轮循环中捕获到这个新的 workInProgress，
      // 并重新对它执行 beginWork（向下递）和后续的 completeWork（向上归）流程。
      return
    }

    // 如果没有兄弟节点：继续向上回溯，将 completedWork 指向父节点（returnFiber），
    // 并在下一轮 do...while 循环中处理父节点的 completeWork。
    completedWork = returnFiber as Fiber
    workInProgress = completedWork
  } while (completedWork !== null)

  // 如果回溯到根节点了（completedWork === null），说明整棵树的遍历已经完成了。
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted
  }
}

/**
 * React Fiber 架构中 Commit 阶段的入口函数。
 * 负责在进入真正的提交实现（commitRootImpl）前，配置最高优先级的渲染环境，执行完毕后恢复之前的优先级状态。
 *
 * @param root - Fiber 根节点对象，包含整个 Fiber 树的信息
 */
function commitRoot(root: FiberRoot): void {
  // 保存进入 Commit 阶段前的更新优先级，以便在 finally 块中恢复。
  const previousUpdateLanePriority = getCurrentUpdatePriority()

  try {
    // 强制将更新优先级设置为 DiscreteEventPriority（离散事件优先级）。
    // 在 commitRoot 期间（即进入 Commit 阶段后），如果触发了新的状态更新（例如在 useLayoutEffect、生命周期函数中调用 setState），
    // 这些新产生的调度任务确实会被强制当作最高优先级（同步）任务来执行。
    setCurrentUpdatePriority(DiscreteEventPriority)

    // 调用 Commit 阶段的核心实现函数，执行实际的副作用提交。
    commitRootImpl(root)
  } finally {
    // 无论执行成功与否，最终都要恢复之前的更新优先级，避免影响后续的调度任务。
    setCurrentUpdatePriority(previousUpdateLanePriority)
  }
}

function commitRootImpl(root: FiberRoot): void {
  // 源码注释：
  //   `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
  //   means `flushPassiveEffects` will sometimes result in additional
  //   passive effects. So we need to keep flushing in a loop until there are
  //   no more pending effects.
  //   TODO: Might be better if `flushPassiveEffects` did not automatically
  //   flush synchronous work at the end, to avoid factoring hazards like this.
  // 我的理解：
  //   由于调度阶段的存在，为保证下一次 commit 阶段执行前“本次 commit 阶段调度的 useEffect”均已执行，
  //   commit 阶段会在入口处执行 flushPassiveEffects 方法，以保证本次 commit 阶段执行时，不存在“还在调度中，未执行的 useEffect”。
  //   flushPassiveEffects 方法之所以包裹在 do...while 循环中，是因为该方法中会执行 flushSyncCallbacks 方法，遍历并执行所有“被调度的同步更新”。
  //   在更新执行过程中，“useEffect 的声明阶段”可能又会标记 HasEffect tag，所以需要循环执行 flushPassiveEffects 方法直到所有遗留的 useEffect 回调都执行完毕。
  do {
    flushPassiveEffects()
  } while (rootWithPendingPassiveEffects !== null)

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // executionContext 里已经包含了 RenderContext 或 CommitContext 中的至少一个，
    // 说明当前正在执行 Render 或 Commit 阶段了，不能再进入另一个 Commit 阶段了，这种情况不应该发生。
    throw new Error('Should not already be working.')
  }

  // 获取已完成的工作单元（Fiber树）。
  const finishedWork = root.finishedWork
  const lanes = root.finishedLanes

  // 如果没有完成的工作，直接返回。
  if (finishedWork === null) {
    return
  }

  // 重置根节点状态。
  // 清空根节点上的完成工作和已完优先级，防止重复提交。
  root.finishedWork = null
  root.finishedLanes = NoLanes

  // 严禁提交与当前渲染树相同的树（防止死循环或状态错乱）。
  if (finishedWork === root.current) {
    throw new Error(
      'Cannot commit the same tree as before. This error is likely caused by ' +
        'a bug in React. Please file an issue.'
    )
  }

  // 重置渲染相关全局状态。
  // 清空工作循环的缓存，允许调度新的回调。
  root.callbackNode = null
  root.callbackPriority = NoLane

  // 计算剩余优先级。
  //   在这个特定时刻，finishedWork.lanes 和 finishedWork.childLanes 代表了本次渲染周期结束后，依然残留在整棵树上的“未完成的更新任务”。
  //   这两者的合并，本质上是在向 React 汇报：“这次渲染虽然结束了，但树上还残留着这些没做完的工作。”
  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes)
  //   合并并发更新的优先级（防止丢失并发事件产生的更新）。
  const concurrentlyUpdatedLanes = getConcurrentlyUpdatedLanes()
  remainingLanes = mergeLanes(remainingLanes, concurrentlyUpdatedLanes)

  // 清理和重置已完成更新所对应的优先级车道（Lanes）及其相关状态。
  // 这会更新 root 的 finishedLanes。
  markRootFinished(root, remainingLanes)

  // 清空全局渲染状态。
  if (root === workInProgressRoot) {
    // We can reset these now that they are finished.
    workInProgressRoot = null
    workInProgress = null
    // 这里的这个重置为 NoLanes 值感觉有些多余。因为上面已经重置了。
    workInProgressRootRenderLanes = NoLanes
  } else {
    // 这种情况暂不考虑。
    // This indicates that the last root we worked on is not the same one that
    // we're committing now. This most commonly happens when a suspended root
    // times out.
  }

  // 调度被动副作用 (Passive Effects)。
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    // 防止重复调度。
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true
      // 使用 Scheduler 调度一个普通优先级的任务来处理 useEffect。
      // 这里的 PassiveEffects 是在下方的 commitMutationEffects 方法中被收集的。
      Scheduler_scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects()
        return null
      })
    }
  }

  // 检查是否存在 Mutation effect（如 DOM 插入/更新/删除）。
  const subtreeHasEffects =
    (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags
  const rootHasEffect =
    (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags
  // 源码中是这样写的。
  // const subtreeHasEffects =
  //   (finishedWork.subtreeFlags &
  //     (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
  //   NoFlags
  // const rootHasEffect =
  //   (finishedWork.flags &
  //     (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
  //   NoFlags
  if (subtreeHasEffects || rootHasEffect) {
    // 切换执行上下文和全局当前更新的优先级，标记进入提交阶段。
    const previousPriority = getCurrentUpdatePriority()
    setCurrentUpdatePriority(DiscreteEventPriority)

    const prevExecutionContext = executionContext
    executionContext |= CommitContext

    // TODO: 暂不实现。
    // // 前置突变阶段（getSnapshotBeforeUpdate）。
    // const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
    //   root,
    //   finishedWork
    // )

    // lanes（车道）代表的是更新的优先级级别。
    // 突变阶段 (DOM 操作)：执行 DOM 插入、删除、更新。
    commitMutationEffects(root, finishedWork, lanes)

    // 暂不考虑实现。
    // // 通知宿主环境：React 的渲染工作已经完成，请重置相关的状态或上下文。
    // resetAfterCommit(root.containerInfo)

    // 切换 Fiber 树：WIP Tree 正式成为 Current Tree。
    root.current = finishedWork

    // lanes（车道）代表的是更新的优先级级别。
    // 布局阶段 (useLayoutEffect, componentDidMount等)：执行布局副作用。
    commitLayoutEffects(finishedWork, root, lanes)

    // 暂不实现。这个即使不实现，影响也不大。
    //   如果不加这个逻辑，React 会严格遵循默认的时间切片周期（通常是 5ms）。
    //   这意味着只要时间没到，React 就可能会一直霸占主线程执行任务，浏览器只能干等着，直到 React 主动让出控制权后，才能进行 UI 渲染。
    // 什么时候影响不大？
    //   如果页面上没有频繁的动画、不需要极致的视觉流畅度，或者用户的更新频率不高，那么依靠 React 默认的 5ms 自动让出机制就足够了。
    //   此时省略 requestPaint() 确实不会带来明显的感知差异。
    // 什么时候必须实现？
    //   如果页面包含高频的交互（比如拖拽、实时滚动），或者某些状态更新需要立刻反映在视觉上，就需要通过 requestPaint() 告诉 React：“别干活了，赶紧把主线程还给我，我要画图了！”
    //   这样才能避免画面掉帧或卡顿。
    // // 通知调度器在当前帧结束时让出主线程，以便浏览器有机会执行绘制操作。
    // // Tell Scheduler to yield at the end of the frame, so the browser has an opportunity to paint.
    // requestPaint()

    // 恢复执行上下文。
    executionContext = prevExecutionContext

    // 恢复全局当前更新的优先级。
    setCurrentUpdatePriority(previousPriority)
  } else {
    // 没有任何副作用的极端情况（极少见）。
    root.current = finishedWork
  }

  if (rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = false
    rootWithPendingPassiveEffects = root
    pendingPassiveEffectsLanes = lanes
  }

  // performSyncWorkOnRoot 方法中的 ensureRootIsScheduled(root) 都在 commitRoot(root) 之前被执行，所以这里要再调用一次 ensureRootIsScheduled(root)。
  // Always call this before exiting `commitRoot`, to ensure that any additional work on this root is scheduled.
  ensureRootIsScheduled(root)

  // 这里的 pendingPassiveEffectsLanes 是 root.finishedLanes。
  // 如果触发这次更新的优先级是同步的（SyncLane），那么对应的 useEffect 必须在 Commit 阶段后，立刻、同步地执行，不能拖到浏览器绘制之后。
  // If the passive effects are the result of a discrete render, flush them
  // synchronously at the end of the current task so that the result is
  // immediately observable. Otherwise, we assume that they are not
  // order-dependent and do not need to be observed by external systems, so we
  // can wait until after paint.
  if (includesSomeLane(pendingPassiveEffectsLanes, SyncLane)) {
    flushPassiveEffects()
  }

  // 检测并防止在 Commit 阶段触发无限循环更新（死循环）。略。

  // 处理在 Layout 阶段（即 useLayoutEffect 或 componentDidMount 等生命周期）中通其他高优级手段调度的同步更新。
  // 保证这些同步更新在下次页面渲染之前被调度执行。
  // 如果没这个 flushSyncCallbacks()：
  //    那些在 Layout 阶段刚刚产生的新任务就会被“晾”在队列里，直到浏览器下一次空闲或者下一次事件循环才会执行。
  //    这会导致 UI 状态更新滞后，甚至可能因为状态不一致导致渲染错误。
  flushSyncCallbacks()
}

// TODO: currentEventTime 重置为 NoTimestamp 的时机没搞懂。
// 全局变量：用于缓存当前事件的时间戳，初始值为 NoTimestamp (-1)，表示“未初始化”或“无事件”。
// 如果在同一事件中安排了两个更新，即使第一次和第二次调用之间的实际时钟时间有所推移，我们也应将它们的事件时间视为同时发生。
let currentEventTime: number = NoTimestamp
/**
 * 获取当前事件的时间戳
 *
 * 设计目的：
 * 1. 在一次事件循环（如一次点击触发的渲染）中，所有任务应具有相同的时间优先级基准。
 * 2. 避免在同一个事件处理过程中频繁调用高开销的 performance.now()。
 * 3. 确保在渲染(Render)或提交(Commit)阶段，时间基准保持一致。
 */
export function requestEventTime(): number {
  // 如果当前正处于 Render（渲染）或 Commit（提交）阶段，直接返回实时时间，不使用缓存。
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    return now()
  }

  // 如果缓存中已有有效的事件时间戳（说明正在处理同一个用户交互事件），直接复用，避免重复调用 performance.now()。
  // 这保证了一次点击等事件中触发的多个 setState 都拥有相同的时间基准和优先级。
  if (currentEventTime !== NoTimestamp) {
    return currentEventTime
  }

  // 全新事件的起点：获取当前时间并写入缓存，供后续同一事件循环内的调用复用。
  currentEventTime = now()
  return currentEventTime
}

/**
 * 判断当前是否处于“不安全的类组件渲染阶段更新（Unsafe Class Render Phase Update）”中。
 *
 * @param {Fiber} fiber - 触发更新的 Fiber 节点。
 * @returns {boolean} - 如果当前处于 Render 阶段则返回 true，否则返回 false。
 */
export function isUnsafeClassRenderPhaseUpdate(fiber: Fiber): boolean {
  // 核心逻辑：检查当前的执行上下文（executionContext）是否包含 RenderContext 标志位。
  return (executionContext & RenderContext) !== NoContext
}

// 什么时候 updateLane 不为 NoLane？
//   通常是在执行 flushSync(() => setState()) 或者 React 内部处理某些特定回调时。
//   此时 React 已经通过全局变量强行设定了优先级（比如 SyncLane）。既然有了明确的指令，就不需要再去问浏览器了。
// 什么时候 updateLane 为 NoLane？
//   绝大多数普通的用户交互都是这种情况。比如你在一个普通的按钮点击事件里写了一个 setState()。
//   React 并没有给你开任何“特权通道”，所以内部的更新优先级是空的（NoLane）。
//   这时，React 就会顺理成章地走到第 3 步，去问浏览器：“刚才发生的是什么事件？”
//   浏览器回答：“是一次点击（click）”，于是 React 就根据这个事件分配对应的车道。
/**
 * 请求当前更新任务的优先级车道 (Lane)
 *
 * 核心逻辑：优先复用当前环境上下文，若无则回退至原生事件类型。
 */
export function requestUpdateLane(fiber: Fiber): Lane {
  if (
    (executionContext & RenderContext) !== NoContext &&
    workInProgressRootRenderLanes !== NoLanes
  ) {
    return pickArbitraryLane(workInProgressRootRenderLanes)
  }

  // TODO
  // // 检查是否在 Transition（过渡）中（例如 useTransition 或 startTransition）。
  // const isTransition = requestCurrentTransition() !== NoTransition
  // // 如果在 transition 中，分配一个过渡优先级。
  // if (isTransition) {
  //   if (currentEventTransitionLane === NoLane) {
  //     currentEventTransitionLane = claimNextTransitionLane()
  //   }
  //   return currentEventTransitionLane
  // }

  // 获取当前的更新优先级（比如在 React 内部某些特定方法中手动设置的优先级）。
  const updateLane = getCurrentUpdatePriority()
  if (updateLane !== NoLane) {
    return updateLane
  }

  // 根据当前触发的事件类型来获取对应的优先级（最常见的情况）。
  //   比如：点击事件通常是高优先级，setTimeout 或普通数据请求是默认优先级。
  //   这一行是兜底逻辑。如果 React 不知道你是谁（没有上下文），它就会看看浏览器现在发生了什么（window.event），
  //   如果浏览器也没发生啥（比如定时器），它就给你个默认优先级（DefaultLane），让你慢慢排队去。
  const eventLane = getCurrentEventPriority()
  return eventLane
}

/**
 * 将指定的更新车道（Lane）标记为“被跳过”。
 *
 * @description
 * 当 React 在处理更新队列（processUpdateQueue）时，如果发现某些更新的优先级
 * 低于当前渲染周期允许的优先级（renderLanes），就会放弃处理这些更新。
 *
 * 此时，React 会调用此函数，将这些被跳过的 Lanes 通过位运算（按位或 |）
 * 合并到全局变量 workInProgressRootSkippedLanes 中。
 *
 * 这样做的目的是：在当前渲染周期结束后，React 会检查这个变量，
 * 确保这些被跳过的更新被保留在根节点的 pendingLanes 中，
 * 从而在下一轮调度时能够被重新拾起并执行。
 *
 * @param lane - 本次需要标记为跳过的优先级车道（可以是单个 Lane 或多个 Lanes 的集合）。
 */
export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
  // 使用 mergeLanes（底层为位或运算）将新的 lane 累加到全局跳过记录中，避免覆盖之前已经被跳过的其他 Lanes。
  workInProgressRootSkippedLanes = mergeLanes(
    lane,
    workInProgressRootSkippedLanes
  )
}
