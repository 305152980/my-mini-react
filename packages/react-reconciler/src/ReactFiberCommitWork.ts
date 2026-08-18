import type { Fiber, FiberRoot } from './ReactInternalTypes'
import {
  Placement,
  ChildDeletion,
  Update,
  Passive,
  MutationMask,
  LayoutMask,
  PassiveMask,
  ContentReset,
  NoFlags,
} from './ReactFiberFlags'
import {
  type HookFlags,
  Layout as HookLayout,
  Passive as HookPassive,
  HasEffect as HookHasEffect,
  NoFlags as NoHookEffect,
} from './ReactHookEffectTags'
import {
  HostRoot,
  HostComponent,
  HostText,
  ClassComponent,
  FunctionComponent,
  SimpleMemoComponent,
  MemoComponent,
  HostPortal,
} from './ReactWorkTags'
import { type Lanes } from './ReactFiberLane'
import { type FunctionComponentUpdateQueue } from './ReactFiberHooks'
import { type Transition } from './ReactFiberTracingMarkerComponent'
import {
  type Instance,
  type TextInstance,
  type Container,
  type UpdatePayload,
  detachDeletedInstance,
  resetTextContent,
  commitUpdate,
  commitTextUpdate,
  removeChildFromContainer,
  removeChild,
  insertBefore,
  appendChild,
  insertInContainerBefore,
  appendChildToContainer,
} from 'ReactFiberHostConfig'

let nextEffect: Fiber | null = null

/**
 * Passive Unmount 阶段入口：遍历 Fiber 树，执行所有 useEffect 的销毁函数。
 *
 * 调用时机：flushPassiveEffects 内部调用。
 *
 * 执行流程：
 *   1. 设置 nextEffect 为遍历起点（root.current）。
 *   2. 进入 commitPassiveUnmountEffects_begin 的 while 循环。
 *   3. 遍历所有 Fiber，执行 useEffect 的销毁函数（destroy）。
 *
 * @param firstChild - 遍历起始的 Fiber 节点
 */
export function commitPassiveUnmountEffects(firstChild: Fiber): void {
  // 设置模块级遍历指针，指向起始 Fiber。
  nextEffect = firstChild
  // 开始遍历，进入 while 循环。
  commitPassiveUnmountEffects_begin()
}

/**
 * Passive Unmount 阶段的遍历循环。
 *
 * 遍历策略：深度优先（先子节点，再兄弟节点，再回溯父节点）。
 *
 * 每个 Fiber 节点的处理：
 *   1. 处理删除的子节点（ChildDeletion）。
 *   2. 如果有子节点且子树有 Passive 效果 → 进入子节点。
 *   3. 否则 → 进入 complete 阶段（执行当前节点的销毁函数）。
 */
function commitPassiveUnmountEffects_begin(): void {
  while (nextEffect !== null) {
    const fiber = nextEffect
    const child = fiber.child

    // 第一步：处理被删除的子节点。
    if ((nextEffect.flags & ChildDeletion) !== NoFlags) {
      const deletions = fiber.deletions!
      for (let i = 0; i < deletions.length; i++) {
        const fiberToDelete = deletions[i]!
        // 切换遍历指针到被删除的 Fiber。
        nextEffect = fiberToDelete
        // 递归执行被删除子树中所有 useEffect 的销毁函数。
        commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
          fiberToDelete,
          fiber
        )
      }

      // 断开旧 Fiber（alternate）的子节点链表，帮助 GC 回收被删除的子树。
      const previousFiber = fiber.alternate
      if (previousFiber !== null) {
        let detachedChild = previousFiber.child
        if (detachedChild !== null) {
          previousFiber.child = null
          do {
            const detachedSibling: Fiber | null = detachedChild.sibling
            detachedChild.sibling = null
            detachedChild = detachedSibling
          } while (detachedChild !== null)
        }
      }

      // 恢复遍历指针到当前 Fiber。
      nextEffect = fiber
    }

    // 第二步：决定下一步遍历方向。
    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
      // 子树中有 Passive 效果 → 先进入子节点（深度优先）。
      child.return = fiber
      nextEffect = child
    } else {
      // 子树中没有 Passive 效果 → 进入 complete 阶段。
      // 执行当前 Fiber 的 useEffect 的销毁函数，然后移动到兄弟/父节点。
      commitPassiveUnmountEffects_complete()
    }
  }
}

/**
 * 遍历被删除的子树，执行所有 useEffect 的销毁函数。
 *
 * 调用时机：commitPassiveUnmountEffects_begin 中，发现有子节点被删除时调用。
 *
 * 遍历策略：
 *     深度优先（先子节点，再兄弟节点，再回溯父节点）。
 *     只遍历被删除的子树，不超出 deletedSubtreeRoot。
 *
 * @param deletedSubtreeRoot - 被删除子树的根节点（遍历边界）
 * @param nearestMountedAncestor - 最近的已挂载祖先（用于错误冒泡）
 */
function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
  deletedSubtreeRoot: Fiber,
  nearestMountedAncestor: Fiber
): void {
  while (nextEffect !== null) {
    const fiber = nextEffect

    // 执行当前 Fiber 的 useEffect 销毁函数。
    commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor)

    // 决定下一步遍历方向。
    const child = fiber.child
    if (child !== null) {
      // 有子节点 → 先进入子节点（深度优先）。
      child.return = fiber
      nextEffect = child
    } else {
      // 无子节点 → 进入 complete 阶段。
      // 尝试移动到兄弟节点或回溯到父节点。
      commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
        deletedSubtreeRoot
      )
    }
  }
}

/**
 * 在被删除的子树中，对单个 Fiber 执行 passive unmount 效果。
 *
 * 调用时机：commitPassiveUnmountEffectsInsideOfDeletedTree_begin 遍历过程中，
 *     对每个被删除的 Fiber 调用。
 *
 * @param current - 当前 Fiber 节点
 * @param nearestMountedAncestor - 最近的已挂载祖先（用于错误冒泡）
 */
function commitPassiveUnmountInsideDeletedTreeOnFiber(
  current: Fiber,
  nearestMountedAncestor: Fiber
): void {
  switch (current.tag) {
    case FunctionComponent:
    // case ForwardRef:
    case SimpleMemoComponent: {
      // 执行 useEffect 销毁函数。
      commitHookEffectListUnmount(HookPassive, current, nearestMountedAncestor)
      break
    }
    // case OffscreenComponent:
    //   break
    // case CacheComponent:
    //   break
  }
}

/**
 * 被删除子树的 complete 阶段：回溯遍历，清理连接。
 *
 * 调用时机：commitPassiveUnmountEffectsInsideOfDeletedTree_begin 中，当前节点没有子节点时调用。
 *
 * 职责：
 *   1. 断开 Fiber 连接（帮助 GC 回收）。
 *   2. 移动到兄弟节点或回溯到父节点。
 *   3. 到达 deletedSubtreeRoot 时结束遍历。
 *
 * @param deletedSubtreeRoot - 被删除子树的根节点（遍历边界）
 */
function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
  deletedSubtreeRoot: Fiber
): void {
  while (nextEffect !== null) {
    const fiber = nextEffect
    const sibling = fiber.sibling
    const returnFiber = fiber.return

    // 清理 Fiber 连接（帮助 GC）。
    //   - 断开 alternate。
    //   - 清空 child、sibling、stateNode 等。
    detachFiberAfterEffects(fiber)

    // 决定下一步遍历方向。
    if (fiber === deletedSubtreeRoot) {
      nextEffect = null
      return
    }
    if (sibling !== null) {
      // 有兄弟节点 → 切换到兄弟节点。
      sibling.return = returnFiber
      nextEffect = sibling
      // 退出 complete，回到 begin 继续深度优先。
      return
    }

    // 无兄弟节点 → 回溯到父节点。
    nextEffect = returnFiber
  }
}

/**
 * Passive Unmount 阶段的 complete 处理。
 *
 * 职责：
 *   1. 执行当前 Fiber 的 useEffect 销毁函数。
 *   2. 移动到下一个要处理的 Fiber（兄弟节点或父节点）。
 *
 * 遍历策略：
 *   - 有兄弟节点 → 处理兄弟节点（return）。
 *   - 无兄弟节点 → 回溯到父节点。
 *   - 无父节点 → 遍历结束（nextEffect = null）。
 */
function commitPassiveUnmountEffects_complete(): void {
  while (nextEffect !== null) {
    const fiber = nextEffect

    // 如果当前 Fiber 有 Passive 效果，执行销毁函数。
    if ((fiber.flags & Passive) !== NoFlags) {
      commitPassiveUnmountOnFiber(fiber)
    }

    // 尝试移动到兄弟节点。
    const sibling = fiber.sibling
    if (sibling !== null) {
      sibling.return = fiber.return
      nextEffect = sibling
      // 退出 complete，回到 begin 继续遍历。
      return
    }

    // 没有兄弟节点 → 回溯到父节点。
    nextEffect = fiber.return
  }
}

/**
 * Passive Unmount 阶段：对单个 Fiber 执行 useEffect 的销毁函数。
 *
 * 核心逻辑：
 *   - 执行 useEffect 的销毁函数（destroy）。
 *
 * @param finishedWork - 当前 Fiber 节点
 */
function commitPassiveUnmountOnFiber(finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    // case ForwardRef:
    case SimpleMemoComponent: {
      // 直接执行销毁函数。
      // HookHasEffect: 首次挂载、deps 变了、无 deps 参数。
      commitHookEffectListUnmount(
        HookPassive | HookHasEffect,
        finishedWork,
        finishedWork.return!
      )
      break
    }
  }
}

/**
 * 遍历 effect 链表，执行匹配的销毁函数。
 *
 * 核心逻辑：
 *   1. 从 updateQueue.lastEffect 获取循环链表的头节点。
 *   2. 遍历链表，找到 tag 匹配的 effect。
 *   3. 执行销毁函数（destroy），并清空 destroy 引用。
 *
 * @param flags - 过滤标志
 * @param finishedWork - 当前 Fiber 节点
 * @param nearestMountedAncestor - 最近的已挂载祖先（用于错误冒泡）
 */
function commitHookEffectListUnmount(
  flags: HookFlags,
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber
): void {
  // 获取 effect 循环链表。
  const updateQueue: FunctionComponentUpdateQueue | null =
    finishedWork.updateQueue as any
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null

  if (lastEffect !== null) {
    // 循环链表：lastEffect.next 指向第一个 effect。
    const firstEffect = lastEffect.next!
    let effect = firstEffect
    do {
      // 检查 effect.tag 是否包含 flags 的所有位。
      if ((effect.tag & flags) === flags) {
        // 取出销毁函数。
        const destroy = effect.destroy
        // 清空引用（帮助 GC + 防止重复执行）。
        effect.destroy = undefined
        if (destroy !== undefined) {
          // 安全执行销毁函数（内部 try-catch 捕获错误）。
          safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy)
        }
      }
      // 移动到下一个 effect。
      effect = effect.next!
    } while (effect !== firstEffect)
  }
}

/**
 * 安全执行 effect 的销毁函数。
 *
 * 作用：
 *   - 用 try-catch 包裹 destroy 调用。
 *   - 捕获错误，触发错误边界（componentDidCatch）。
 *   - 防止单个 effect 出错导致整个 commit 阶段中断。
 *
 * @param current - 当前 Fiber 节点（用于错误边界定位）
 * @param nearestMountedAncestor - 最近的已挂载祖先（用于错误冒泡）
 * @param destroy - useEffect/useLayoutEffect 返回的销毁函数
 */
function safelyCallDestroy(
  current: Fiber,
  nearestMountedAncestor: Fiber,
  destroy: () => void
): void {
  try {
    // 执行销毁函数。
    destroy()
  } catch (error) {
    // TODO: 暂不实现。
    // captureCommitPhaseError(current, nearestMountedAncestor, error)
  }
}

function detachFiberAfterEffects(fiber: Fiber): void {
  const alternate = fiber.alternate
  if (alternate !== null) {
    fiber.alternate = null
    detachFiberAfterEffects(alternate)
  }

  fiber.child = null
  fiber.deletions = null
  fiber.sibling = null

  if (fiber.tag === HostComponent) {
    const hostInstance: Instance = fiber.stateNode
    if (hostInstance !== null) {
      // 断开 DOM 节点对 Fiber 的反向引用。
      detachDeletedInstance(hostInstance)
    }
  }
  fiber.stateNode = null

  fiber.return = null
  fiber.dependencies = null
  fiber.memoizedProps = null
  fiber.memoizedState = null
  fiber.pendingProps = null
  fiber.stateNode = null
  fiber.updateQueue = null
}

/**
 * Passive Mount 阶段入口：遍历 Fiber 树，执行所有 useEffect 的创建函数。
 *
 * 执行流程：
 *   1. 设置 nextEffect 为遍历起点（root.current）。
 *   2. 进入 commitPassiveMountEffects_begin 的遍历循环。
 *   3. 遍历所有 Fiber，执行 useEffect 的创建函数（create）。
 *
 * @param root - FiberRoot
 * @param finishedWork - 遍历起始的 Fiber 节点
 * @param committedLanes - 本次 commit 的优先级
 * @param committedTransitions - 本次 commit 的 transitions
 */
export function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  // 设置模块级遍历指针，指向起始 Fiber。
  nextEffect = finishedWork
  // 开始遍历，执行所有 useEffect 的创建函数。
  commitPassiveMountEffects_begin(
    finishedWork,
    root,
    committedLanes,
    committedTransitions
  )
}

/**
 * Passive Mount 阶段的遍历循环：深度优先遍历，找到所有有 Passive 效果的 Fiber。
 *
 * 遍历策略：
 *   - 子树有 Passive 效果 → 进入子节点（深度优先向下）。
 *   - 子树没有 Passive 效果 → 进入 complete 阶段（回溯向上）。
 *
 * @param subtreeRoot - 遍历的根节点（边界）
 * @param root - FiberRoot
 * @param committedLanes - 本次 commit 的优先级
 * @param committedTransitions - 本次 commit 的 transitions
 */
function commitPassiveMountEffects_begin(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  while (nextEffect !== null) {
    const fiber = nextEffect
    const firstChild = fiber.child

    // 决定下一步遍历方向。
    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && firstChild !== null) {
      // 子树中有 Passive 效果 → 先进入子节点（深度优先向下）。
      firstChild.return = fiber
      nextEffect = firstChild
    } else {
      // 子树中没有 Passive 效果 → 进入 complete 阶段。
      // 执行当前 Fiber 的 useEffect 创建函数，然后回溯。
      commitPassiveMountEffects_complete(
        subtreeRoot,
        root,
        committedLanes,
        committedTransitions
      )
    }
  }
}

/**
 * Passive Mount 阶段的 complete 处理：自底向上执行 useEffect 的创建函数。
 *
 * 遍历策略：
 *   - 执行当前 Fiber 的 useEffect 创建函数（如果有 Passive 标志）。
 *   - 到达 subtreeRoot 时结束遍历。
 *   - 有兄弟节点 → 切换到兄弟节点。
 *   - 无兄弟节点 → 回溯到父节点。
 *
 * @param subtreeRoot - 遍历的根节点（边界）
 * @param root - FiberRoot
 * @param committedLanes - 本次 commit 的优先级
 * @param committedTransitions - 本次 commit 的 transitions
 */
function commitPassiveMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  while (nextEffect !== null) {
    const fiber = nextEffect

    // 执行 useEffect 的创建函数（如果当前 Fiber 有 Passive 效果）。
    if ((fiber.flags & Passive) !== NoFlags) {
      try {
        commitPassiveMountOnFiber(
          root,
          fiber,
          committedLanes,
          committedTransitions
        )
      } catch (error) {
        // TODO: 暂不实现。
        // captureCommitPhaseError(fiber, fiber.return, error)
      }
    }

    // 到达遍历边界 → 结束。
    if (fiber === subtreeRoot) {
      nextEffect = null
      return
    }

    // 有兄弟节点 → 切换到兄弟节点。
    const sibling = fiber.sibling
    if (sibling !== null) {
      sibling.return = fiber.return
      nextEffect = sibling
      return // 退出 complete，回到 begin 继续深度优先。
    }

    // 无兄弟节点 → 回溯到父节点。
    nextEffect = fiber.return
  }
}

/**
 * Passive Mount 阶段：对单个 Fiber 执行 useEffect 的创建函数。
 *
 * 核心逻辑：
 *   - 执行 useEffect 的创建函数（create）。
 *   - 将返回值（destroy）保存到 effect.destroy。
 *
 * @param finishedRoot - FiberRoot
 * @param finishedWork - 当前 Fiber 节点
 * @param committedLanes - 本次 commit 的优先级
 * @param committedTransitions - 本次 commit 的 transitions
 */
function commitPassiveMountOnFiber(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    // case ForwardRef:
    case SimpleMemoComponent: {
      // 执行所有 useEffect 的创建函数。
      // HookHasEffect: 首次挂载、deps 变了、无 deps 参数。
      commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork)
      break
    }
    case HostRoot:
      // FiberRoot 没有 useEffect，跳过。
      break
    // case OffscreenComponent:
    //   break
    // case CacheComponent:
    //   break
  }
}

/**
 * 遍历 effect 链表，执行匹配的创建函数。
 *
 * 核心逻辑：
 *   1. 从 updateQueue.lastEffect 获取循环链表的头节点。
 *   2. 遍历链表，找到 tag 匹配的 effect。
 *   3. 执行创建函数（create），将返回值（destroy）保存到 effect.destroy。
 *
 * @param flags - 过滤标志
 * @param finishedWork - 当前 Fiber 节点
 */
function commitHookEffectListMount(
  flags: HookFlags,
  finishedWork: Fiber
): void {
  // 获取 effect 循环链表。
  const updateQueue: FunctionComponentUpdateQueue | null =
    finishedWork.updateQueue as any
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null

  if (lastEffect !== null) {
    // 循环链表：lastEffect.next 指向第一个 effect。
    const firstEffect = lastEffect.next!
    let effect = firstEffect
    do {
      // 检查 effect.tag 是否包含 flags 的所有位。
      if ((effect.tag & flags) === flags) {
        // 执行创建函数，保存返回的销毁函数。
        const create = effect.create
        effect.destroy = create()
      }
      // 移动到下一个 effect。
      effect = effect.next!
    } while (effect !== firstEffect)
  }
}

/**
 * Mutation 阶段入口：遍历 Fiber 树，处理 DOM 操作。
 *
 * 调用时机：commitRoot 内部，在 beforeMutation 阶段之后调用。
 *
 * 核心职责：
 *   - 处理 DOM 的增删改（Placement、ChildDeletion、Update）。
 *   - 处理 ContentReset（清空文本内容）。
 *
 * @param root - FiberRoot
 * @param finishedWork - 遍历起始的 Fiber 节点（root.current）
 * @param committedLanes - 本次 commit 的优先级
 */
export function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  // 进入 Fiber 树遍历，处理所有 mutation 效果。
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes)
}

/**
 * Mutation 阶段：对单个 Fiber 处理 DOM 操作。
 *
 * 调用时机：commitMutationEffects 内部，深度优先遍历每个 Fiber 时调用。
 *
 * 核心职责（按 Fiber 类型分发）：
 *   - 递归处理子节点（recursivelyTraverseMutationEffects）。
 *   - 处理协调效果（commitReconciliationEffects）。
 *   - 根据 Fiber 类型执行特定操作：
 *     * FunctionComponent：执行 useLayoutEffect 。
 *     * HostComponent：处理 ContentReset、commitUpdate。
 *     * HostText：更新文本内容。
 *
 * @param finishedWork - 当前 Fiber 节点
 * @param root - FiberRoot
 * @param lanes - 本次 commit 的优先级
 */
function commitMutationEffectsOnFiber(
  finishedWork: Fiber,
  root: FiberRoot,
  lanes: Lanes
): void {
  const current = finishedWork.alternate
  const flags = finishedWork.flags

  // 根据 Fiber 类型分发处理。
  switch (finishedWork.tag) {
    case FunctionComponent:
    // case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      // 递归处理子节点。
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      // 处理协调效果。
      commitReconciliationEffects(finishedWork)

      // 判断 flags 是否包含 Update 标志。
      if (flags & Update) {
        try {
          // 执行 useLayoutEffect 的销毁函数。
          commitHookEffectListUnmount(
            HookLayout | HookHasEffect,
            finishedWork,
            finishedWork.return!
          )
        } catch (error) {
          // TODO: 暂不实现。
          // captureCommitPhaseError(finishedWork, finishedWork.return, error)
        }
      }
      return
    }
    case ClassComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)
      return
    }
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)

      // 处理 ContentReset（清空文本内容）。
      // 场景：从 innerHTML 切换到子节点渲染时，需要先清空内容。
      if (finishedWork.flags & ContentReset) {
        const instance: Instance = finishedWork.stateNode
        try {
          // 清空 DOM 节点的文本，用于 innerHTML → 子节点 的切换场景。
          resetTextContent(instance)
        } catch (error) {
          // TODO: 暂不实现。
          // captureCommitPhaseError(finishedWork, finishedWork.return, error)
        }
      }

      // 处理属性更新（commitUpdate）。
      if (flags & Update) {
        const instance: Instance = finishedWork.stateNode
        const newProps = finishedWork.memoizedProps
        const oldProps = current!.memoizedProps
        const type = finishedWork.type
        const updatePayload: UpdatePayload = finishedWork.updateQueue
        finishedWork.updateQueue = null
        try {
          // 执行 DOM 属性更新。
          commitUpdate(
            instance,
            updatePayload,
            type,
            oldProps,
            newProps,
            finishedWork
          )
        } catch (error) {
          // TODO: 暂不实现。
          // captureCommitPhaseError(finishedWork, finishedWork.return, error)
        }
      }
      return
    }
    case HostText: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)

      // 处理文本内容更新。
      if (flags & Update) {
        const textInstance: TextInstance = finishedWork.stateNode
        const newText: string = finishedWork.memoizedProps
        const oldText: string = current!.memoizedProps
        try {
          // 执行文本更新（直接修改 DOM 文本内容）。
          commitTextUpdate(textInstance, oldText, newText)
        } catch (error) {
          // TODO: 暂不实现。
          // captureCommitPhaseError(finishedWork, finishedWork.return, error)
        }
      }
      return
    }
    case HostRoot: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)

      // if (flags & Update) {
      // TODO: 暂不实现。
      // }
      return
    }
    // case HostPortal:
    // case SuspenseComponent:
    // case OffscreenComponent:
    // case SuspenseListComponent:
    // case ScopeComponent:
    default: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)
      return
    }
  }
}

/**
 * 递归遍历子节点，处理 mutation 效果。
 *
 * 调用时机：commitMutationEffectsOnFiber 内部，对每个 Fiber 调用。
 *
 * 核心职责：
 *   1. 处理被删除的子节点（deletions）。
 *   2. 递归处理有 mutation 效果的子节点（subtreeFlags）。
 *
 * @param root - FiberRoot
 * @param parentFiber - 父 Fiber 节点
 * @param lanes - 本次 commit 的优先级
 */
function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes
): void {
  // 第一步：处理被删除的子节点。
  const deletions = parentFiber.deletions
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i]!
      try {
        // 执行删除效果：卸载组件、移除 DOM、清理 ref 等。
        commitDeletionEffects(root, parentFiber, childToDelete)
      } catch (error) {
        // TODO: 暂不实现。
        // captureCommitPhaseError(childToDelete, parentFiber, error)
      }
    }
  }

  // 第二步：递归处理有 mutation 效果的子节点。
  // 检查子树中是否有 mutation 效果（优化：无效果则跳过遍历）。
  if (parentFiber.subtreeFlags & MutationMask) {
    let child = parentFiber.child
    // 遍历所有子节点，对每个子节点执行 mutation 效果。
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root, lanes)
      child = child.sibling
    }
  }
}

/**
 * 处理协调效果：将新创建的 DOM 节点插入到正确位置。
 *
 * 调用时机：commitMutationEffectsOnFiber 内部，递归处理子节点后调用。
 *
 * 核心职责：
 *   - 检查 Placement 标志（表示需要插入 DOM）。
 *   - 调用 commitPlacement 执行 DOM 插入操作。
 *   - 清除 Placement 标志（已消费）。
 *
 * @param finishedWork - 当前 Fiber 节点
 */
function commitReconciliationEffects(finishedWork: Fiber): void {
  const flags = finishedWork.flags

  // 检查是否需要插入 DOM（Placement 标志）。
  if (flags & Placement) {
    try {
      // 执行 DOM 插入：将节点插入到父容器的正确位置。
      commitPlacement(finishedWork)
    } catch (error) {
      // TODO: 暂不实现。
      // captureCommitPhaseError(finishedWork, finishedWork.return, error)
    }
    // 清除 Placement 标志（已消费）。
    finishedWork.flags &= ~Placement
  }
}

// 记录被删除节点的宿主（用于 DOM 移除）。
let hostParent: Instance | Container | null = null
let hostParentIsContainer: boolean = false
/**
 * 处理被删除的 Fiber：找到宿主 DOM 节点，执行卸载和 DOM 移除。
 *
 * 调用时机：recursivelyTraverseMutationEffects 中处理 deletions 时调用。
 *
 * 核心职责：
 *   1. 向上遍历找到最近的宿主节点（HostComponent 或 HostRoot）。
 *   2. 执行卸载操作（DOM 移除等）。
 *   3. 断开 Fiber 连接（detachFiberMutation）。
 *
 * @param root - FiberRoot
 * @param returnFiber - 被删除节点的父 Fiber
 * @param deletedFiber - 被删除的 Fiber
 */
function commitDeletionEffects(
  root: FiberRoot,
  returnFiber: Fiber,
  deletedFiber: Fiber
): void {
  // 向上遍历，找到最近的宿主节点。
  let parent: Fiber | null = returnFiber
  findParent: while (parent !== null) {
    switch (parent.tag) {
      case HostComponent: {
        hostParent = parent.stateNode
        hostParentIsContainer = false
        break findParent
      }
      case HostRoot: {
        hostParent = parent.stateNode.containerInfo
        hostParentIsContainer = true
        break findParent
      }
      // case HostPortal:
    }
    parent = parent.return
  }
  // 执行卸载操作（移除 DOM 等）。
  commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber)

  hostParent = null
  hostParentIsContainer = false

  // 断开 Fiber 连接（help GC）。
  detachFiberMutation(deletedFiber)
}

function commitDeletionEffectsOnFiber(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  deletedFiber: Fiber
): void {
  switch (deletedFiber.tag) {
    case HostComponent:
    case HostText:
      const prevHostParent = hostParent
      const prevHostParentIsContainer = hostParentIsContainer
      hostParent = null
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      )
      hostParent = prevHostParent
      hostParentIsContainer = prevHostParentIsContainer

      if (hostParent !== null) {
        if (hostParentIsContainer) {
          removeChildFromContainer(
            hostParent as Container,
            deletedFiber.stateNode as Instance | TextInstance
          )
        } else {
          removeChild(
            hostParent as Instance,
            deletedFiber.stateNode as Instance | TextInstance
          )
        }
      }
      return
    // case DehydratedFragment:
    // // TODO
    // case HostPortal:
    // // TODO
    case FunctionComponent:
    // case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
      const updateQueue: FunctionComponentUpdateQueue | null =
        deletedFiber.updateQueue as any
      if (updateQueue !== null) {
        const lastEffect = updateQueue.lastEffect
        if (lastEffect !== null) {
          const firstEffect = lastEffect.next!
          let effect = firstEffect
          do {
            const { destroy, tag } = effect
            if (destroy !== undefined) {
              // 判断 effect 是否是 useLayoutEffect。
              if ((tag & HookLayout) !== NoHookEffect) {
                safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy)
              }
            }
            effect = effect.next!
          } while (effect !== firstEffect)
        }
      }

      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      )
      return
    case ClassComponent:
      // TODO: 执行 componentWillUnmount 生命周期方法，等。

      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      )
      return
    // case ScopeComponent:
    // // TODO
    // case OffscreenComponent:
    // // TODO
    default: {
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      )
      return
    }
  }
}

/**
 * 递归遍历子节点，执行删除操作。
 *
 * 调用时机：commitDeletionEffectsOnFiber 中，处理完当前 Fiber 后，递归处理子节点。
 *
 * 核心职责：
 *   遍历 parent 的所有子节点，对每个子节点调用 commitDeletionEffectsOnFiber。
 *
 * @param finishedRoot - FiberRoot
 * @param nearestMountedAncestor - 最近的已挂载祖先节点
 * @param parent - 父节点
 */
function recursivelyTraverseDeletionEffects(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  parent: Fiber
): void {
  let child = parent.child
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child)
    child = child.sibling
  }
}

/**
 * 断开 Fiber 的 return 指针（Mutation 阶段）。
 *
 * 调用时机：commitDeletionEffects 内部，删除 Fiber 后调用。
 *
 * 核心职责：
 *   - 断开 fiber.return（指向父节点的指针）。
 *   - 断开 alternate.return（旧 Fiber 的父节点指针）。
 *   - 帮助 GC 回收被删除的 Fiber 子树。
 *
 * 注意：
 *   - 只断开 return 指针，不断开 child/sibling。
 *   - 因为 passive 阶段还需要遍历子树执行 useEffect 销毁。
 *   - 更彻底的清理在 passive 阶段的 detachFiberAfterEffects 中。
 *
 * @param fiber - 被删除的 Fiber
 */
function detachFiberMutation(fiber: Fiber): void {
  const alternate = fiber.alternate
  if (alternate !== null) {
    alternate.return = null
  }
  fiber.return = null
}

/**
 * 处理 Placement 标志：将新节点插入到正确位置。
 *
 * 调用时机：commitMutationEffectsOnFiber 中，处理 Fiber 的 Placement 标志时调用。
 *
 * 核心职责：
 *   1. 找到父节点。
 *   2. 找到插入位置（兄弟节点之前）。
 *   3. 插入 DOM 节点。
 *
 * @param finishedWork - 需要插入的 Fiber 节点
 */
export function commitPlacement(finishedWork: Fiber): void {
  // 1. 找到最近的 Host 父节点（HostComponent 或 HostRoot）。
  const parentFiber = getHostParentFiber(finishedWork)

  switch (parentFiber.tag) {
    // 2a. 父节点是 HostComponent（如 div、span）。
    case HostComponent: {
      const parent: Instance = parentFiber.stateNode
      if (parentFiber.flags & ContentReset) {
        resetTextContent(parent)
        parentFiber.flags &= ~ContentReset
      }
      const before = getHostSibling(finishedWork)
      insertOrAppendPlacementNode(finishedWork, before, parent)
      break
    }
    // 2b. 父节点是 HostRoot（根节点）。
    case HostRoot:
      // case HostPortal:
      const parent: Container = parentFiber.stateNode.containerInfo
      const before = getHostSibling(finishedWork)
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent)
      break
    default:
      throw new Error(
        'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.'
      )
  }
}

/**
 * 找到最近的 Host 父节点。
 *
 * 调用时机：commitPlacement 中，需要找到插入位置的父节点时调用。
 *
 * 核心职责：
 *   从 fiber.return 开始向上遍历，找到第一个 Host 类型的父节点。
 *
 * Host 类型：
 *   - HostComponent（div、span 等 DOM 节点）。
 *   - HostRoot（根节点）。
 *
 * @param fiber - 起始 Fiber 节点
 * @returns 最近的 Host 父节点
 */
function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent
    }
    parent = parent.return
  }

  throw new Error(
    'Expected to find a host parent. This error is likely caused by a bug ' +
      'in React. Please file an issue.'
  )
}

/**
 * 找到下一个 Host 兄弟节点（用于确定插入位置）。
 *
 * 调用时机：commitPlacement 中，需要找到插入位置时调用。
 *
 * 核心职责：
 *   找到当前节点的下一个 Host 兄弟节点，
 *   用于 insertBefore(node, before) 的 before 参数。
 *
 * 返回 null 表示追加到末尾（appendChild）。
 *
 * @param fiber - 起始 Fiber 节点
 * @returns 下一个 Host 兄弟节点（或 null）
 */
function getHostSibling(fiber: Fiber): Instance | null {
  let node: Fiber = fiber
  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null
      }
      node = node.return
    }
    node.sibling.return = node.return
    node = node.sibling
    while (node.tag !== HostComponent && node.tag !== HostText) {
      if (node.flags & Placement) {
        continue siblings
      }
      if (node.child === null) {
        continue siblings
      } else {
        node.child.return = node
        node = node.child
      }
    }
    if (!(node.flags & Placement)) {
      return node.stateNode
    }
  }
}

/**
 * 判断是否是 Host 父节点。
 *
 * Host 父节点：可以直接包含 DOM 子节点的节点类型。
 *
 * @param fiber - Fiber 节点
 * @returns 是否是 Host 父节点
 */
function isHostParent(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostRoot
}

/**
 * 将 Fiber 节点的 DOM 插入到父节点中。
 *
 * 调用时机：commitPlacement 中，处理 Placement 标志时调用。
 *
 * 核心职责：
 *   将 Fiber 节点对应的 DOM 插入到正确位置。
 *   如果是组件类型，递归处理子节点。
 *
 * @param node - 需要插入的 Fiber 节点
 * @param before - 插入位置（在此节点之前插入），null 表示追加到末尾
 * @param parent - 父 DOM 节点
 */
function insertOrAppendPlacementNode(
  node: Fiber,
  before: Instance | null,
  parent: Instance
): void {
  const { tag } = node
  const isHost = tag === HostComponent || tag === HostText
  if (isHost) {
    const stateNode = node.stateNode
    if (before) {
      insertBefore(parent, stateNode, before)
    } else {
      appendChild(parent, stateNode)
    }
  } else if (tag === HostPortal) {
    // 不做任何处理。
  } else {
    // node 为组件类型。
    const child = node.child
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent)
      let sibling = child.sibling
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent)
        sibling = sibling.sibling
      }
    }
  }
}

/**
 * 将 Fiber 节点的 DOM 插入到容器中。
 *
 * 调用时机：commitPlacement 中，父节点是 HostRoot 时调用。
 *
 * @param node - 需要插入的 Fiber 节点
 * @param before - 插入位置（在此节点之前插入），null 表示追加到末尾
 * @param parent - 容器
 */
function insertOrAppendPlacementNodeIntoContainer(
  node: Fiber,
  before: Instance | null,
  parent: Container
): void {
  const { tag } = node
  const isHost = tag === HostComponent || tag === HostText
  if (isHost) {
    const stateNode = node.stateNode
    if (before) {
      insertInContainerBefore(parent, stateNode, before)
    } else {
      appendChildToContainer(parent, stateNode)
    }
  } else if (tag === HostPortal) {
    // 不做任何处理。
  } else {
    // node 为组件类型。
    const child = node.child
    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent)
      let sibling = child.sibling
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent)
        sibling = sibling.sibling
      }
    }
  }
}

export function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
): void {
  nextEffect = finishedWork
  commitLayoutEffects_begin(finishedWork, root, committedLanes)
}

function commitLayoutEffects_begin(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
): void {
  while (nextEffect !== null) {
    const fiber = nextEffect
    const firstChild = fiber.child

    if ((fiber.subtreeFlags & LayoutMask) !== NoFlags && firstChild !== null) {
      firstChild.return = fiber
      nextEffect = firstChild
    } else {
      commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes)
    }
  }
}

function commitLayoutMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
): void {
  while (nextEffect !== null) {
    const fiber = nextEffect
    if ((fiber.flags & LayoutMask) !== NoFlags) {
      const current = fiber.alternate
      try {
        commitLayoutEffectOnFiber(root, current, fiber, committedLanes)
      } catch (error) {
        // TODO: 暂不实现。
        // captureCommitPhaseError(fiber, fiber.return, error)
      }
    }

    if (fiber === subtreeRoot) {
      nextEffect = null
      return
    }

    const sibling = fiber.sibling
    if (sibling !== null) {
      sibling.return = fiber.return
      nextEffect = sibling
      return
    }

    nextEffect = fiber.return
  }
}

function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  if ((finishedWork.flags & LayoutMask) !== NoFlags) {
    switch (finishedWork.tag) {
      case FunctionComponent:
      // case ForwardRef:
      case SimpleMemoComponent:
        commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork)
        break
      case ClassComponent:
        // TODO: 待实现。
        // 类组件在 Layout 阶段执行 componentDidMount / componentDidUpdate，然后处理 setState 的回调队列。
        break
      case HostRoot:
        // TODO: 待实现。
        // 处理 HostRoot（根 Fiber）的 updateQueue，执行排队的回调（如 setState 的回调）。
        break
      case HostComponent:
        // TODO: 待实现。
        // 处理 HostComponent（DOM 节点）首次挂载时的特殊操作。
        break
      case HostText:
        break
      // case HostPortal:
      //   break
      // case Profiler:
      //   break
      // case SuspenseComponent:
      //   // TODO: 待实现。
      //   break
      // case SuspenseListComponent:
      // case IncompleteClassComponent:
      // case ScopeComponent:
      // case OffscreenComponent:
      // case TracingMarkerComponent:
      //   break
      default:
        throw new Error(
          'This unit of work tag should not have side-effects. This error is ' +
            'likely caused by a bug in React. Please file an issue.'
        )
    }
  }
  // TODO: 待实现。
  // 处理 ref 回调的绑定。
}
