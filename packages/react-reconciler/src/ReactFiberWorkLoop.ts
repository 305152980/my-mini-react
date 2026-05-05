import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { ensureRootIsScheduled } from './ReactFiberRootScheduler'
import { createWorkInProgress } from './ReactFiber'
import { beginWork } from './ReactFiberBeginWork'
import { completeWork } from './ReactFiberCompleteWork'
import {
  commitMutationEffects,
  flushPassiveEffects,
} from './ReactFiberCommitWork'
import { Scheduler, NormalPriority } from '@my-mini-react/scheduler'
import { type Lane, NoLane, claimNextTransitionLane } from './ReactFiberLane'
import { getCurrentUpdatePriority } from './ReactEventPriorities'
import { getCurrentEventPriority } from '@my-mini-react/react-dom-bindings'

type ExecutionContext = number

export const NoContext = /*             */ 0b000
export const BatchedContext = /*        */ 0b001
export const RenderContext = /*         */ 0b010
export const CommitContext = /*         */ 0b100

let executionContext: ExecutionContext = NoContext

let workInProgress: Fiber | null = null
let workInProgressRoot: FiberRoot | null = null

let workInProgressDeferredLane: Lane = NoLane

/**
 * 从任意 Fiber 节点出发，找到其所属的 FiberRoot，并触发整棵树的渲染。
 * 这是 React 更新调度的入口点之一。
 * @param fiber - 触发更新的起始 Fiber 节点。
 */
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  isSync?: boolean
): void {
  workInProgressRoot = root
  workInProgress = fiber
  if (isSync) {
    queueMicrotask(() => performConcurrentWorkOnRoot(root))
  } else {
    ensureRootIsScheduled(root)
  }
}

export function performConcurrentWorkOnRoot(root: FiberRoot): void {
  // 1、render，构建 fiber 树。
  renderRootSync(root)
  // 2、commit，提交 fiber 树到 DOM。
  const finishedWork = root.current.alternate
  root.finishedWork = finishedWork
  commitRoot(root)
  console.log('performConcurrentWorkOnRoot', root)
}

function renderRootSync(root: FiberRoot): void {
  // 1、render 阶段开始。
  const previousExecutionContext = executionContext
  executionContext |= RenderContext
  // 2、初始化。
  prepareFreshStack(root)
  // 3、遍历构建 Fiber 树。
  workLoopSync()
  // 4、render 阶段结束。
  executionContext = previousExecutionContext
  workInProgressRoot = null
}

function prepareFreshStack(root: FiberRoot): Fiber {
  root.finishedWork = null
  workInProgressRoot = root
  const rootWorkInProgress = createWorkInProgress(root.current, null)
  workInProgress = rootWorkInProgress
  return rootWorkInProgress
}

function workLoopSync(): void {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate
  // 1、beginWork。
  let next = beginWork(current, unitOfWork)
  // 把 pendingProps 赋值给 memoizedProps，表示这个 Fiber 已经完成了 props 的准备工作。
  unitOfWork.memoizedProps = unitOfWork.pendingProps
  if (next === null) {
    // 2、completeWork。
    completeUnitOfWork(unitOfWork)
  } else {
    workInProgress = next
  }
}

// 深度优先遍历（左→右→中）：子节点、兄弟节点、叔叔节点、爷爷的兄弟节点......
function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork = unitOfWork
  do {
    const current = completedWork.alternate
    const returnFiber = completedWork.return
    completeWork(current, completedWork)
    const siblingFiber = completedWork.sibling
    if (siblingFiber !== null) {
      workInProgress = siblingFiber
      return
    }
    completedWork = returnFiber as Fiber
    workInProgress = completedWork
  } while (completedWork !== null)
}

function commitRoot(root: FiberRoot): void {
  // commit 阶段开始。
  const previousExecutionContext = executionContext
  executionContext |= CommitContext

  // TODO: Before Mutation 阶段。

  // mutation 阶段：渲染 DOM 树。
  const finishedWork = root.finishedWork as Fiber
  root.finishedWork = null
  commitMutationEffects(root, finishedWork)
  root.current = finishedWork

  // layout 阶段：执行 useEffect 的副作用函数。
  Scheduler.scheduleCallback(NormalPriority, () => {
    flushPassiveEffects(root.current)
  })

  // commit 阶段结束。
  executionContext = previousExecutionContext
  workInProgressRoot = null
}

// 获取紧急 update 的 lane。
/**
 * 请求当前更新任务的优先级车道 (Lane)
 *
 * 核心逻辑：优先复用当前环境上下文，若无则回退至原生事件类型。
 */
export function requestUpdateLane(): Lane {
  const updateLane: Lane = getCurrentUpdatePriority()
  if (updateLane !== NoLane) {
    return updateLane
  }
  // 这一行是兜底逻辑。如果 React 不知道你是谁（没有上下文），它就会看看浏览器现在发生了什么（window.event），
  // 如果浏览器也没发生啥（比如定时器），它就给你个默认优先级（DefaultLane），让你慢慢排队去。
  const eventLane: Lane = getCurrentEventPriority()
  return eventLane
}

// 获取非紧急 update 的 lane。
/**
 * 请求一个用于「延迟更新」的车道 (Lane)
 *
 * 核心作用：
 * 为 useDeferredValue 或 Suspense 等低优先级任务分配一个专用的 Transition Lane。
 *
 * 关键机制：
 * 1. 惰性分配 (Lazy Allocation)：
 *    - 只有当真正需要延迟更新时，才去申请车道，而不是预先分配。
 *
 * 2. 同一批次复用 (Batching Consistency)：
 *    - 利用 workInProgressDeferredLane 这个全局变量（实际上是模块级变量）。
 *    - 如果在同一个渲染流程（Render Phase）中，有多个组件都调用了 useDeferredValue，
 *      它们会共用同一个 Lane。
 *    - 目的：确保所有延迟的值能在同一次渲染中同时更新，保持 UI 的一致性，
 *      避免出现“一部分旧值、一部分新值”的撕裂现象。
 */
// 在一次渲染里：requestDeferredLane 确实会让所有 useDeferredValue 共用一个车道。这是为了 UI 一致性。
// 在多次渲染间：claimNextTransitionLane 会让每次新的输入使用不同的车道。这是为了可中断和防饥饿。
export function requestDeferredLane(): Lane {
  // 检查是否已经为当前渲染流程分配过延迟车道
  if (workInProgressDeferredLane === NoLane) {
    // 如果还没有，则申请一个新的 Transition Lane
    // claimNextTransitionLane 会从一个位掩码池中按顺序取下一个可用的低优先级车道
    workInProgressDeferredLane = claimNextTransitionLane()
  }
  // 返回该车道（无论是刚申请的和之前申请过的）
  return workInProgressDeferredLane
}
