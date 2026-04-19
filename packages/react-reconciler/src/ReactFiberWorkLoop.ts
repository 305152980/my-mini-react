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

type ExecutionContext = number

export const NoContext = /*             */ 0b000
export const BatchedContext = /*        */ 0b001
export const RenderContext = /*         */ 0b010
export const CommitContext = /*         */ 0b100

let executionContext: ExecutionContext = NoContext

let workInProgress: Fiber | null = null
let workInProgressRoot: FiberRoot | null = null

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
