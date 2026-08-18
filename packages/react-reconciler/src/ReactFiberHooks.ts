import ReactSharedInternals from '@my-mini-react/shared/ReactSharedInternals'
import { type Lane, type Lanes, NoLanes, removeLanes } from './ReactFiberLane'
import {
  type Flags,
  Passive as PassiveEffect,
  Update as UpdateEffect,
  PassiveStatic as PassiveStaticEffect,
  LayoutStatic as LayoutStaticEffect,
} from './ReactFiberFlags'
import {
  type HookFlags,
  HasEffect as HookHasEffect,
  Layout as HookLayout,
  Passive as HookPassive,
} from './ReactHookEffectTags'
import { type Fiber, type Dispatcher } from './ReactInternalTypes'
import is from '@my-mini-react/shared/objectIs'

const { ReactCurrentDispatcher } = ReactSharedInternals

export type Update<S, A> = {
  lane: Lane
  action: A
  hasEagerState: boolean
  eagerState: S | null
  next: Update<S, A>
}

export type UpdateQueue<S, A> = {
  pending: Update<S, A> | null
  lanes: Lanes
  dispatch: ((action: A) => void) | null
  lastRenderedReducer: ((state: S, action: A) => S) | null
  lastRenderedState: S | null
}

export type Hook = {
  memoizedState: any
  baseState: any
  baseQueue: Update<any, any> | null
  queue: any
  next: Hook | null
}

export type Effect = {
  tag: HookFlags
  create: () => (() => void) | void
  destroy: (() => void) | void
  deps: Array<any> | null
  next: Effect
}

type StoreConsistencyCheck<T> = {
  value: T
  getSnapshot: () => T
}
export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null
  stores: Array<StoreConsistencyCheck<any>> | null
}

type BasicStateAction<S> = ((state: S) => S) | S

type Dispatch<A> = (action: A) => void

// 当前渲染轮次的优先级集合。
let renderLanes: Lanes = NoLanes
// 当前正在渲染的 Fiber。
let currentlyRenderingFiber: Fiber | null = null
// current 树 Hook 链表指针。
let currentHook: Hook | null = null
// workInProgress 树 Hook 链表指针。
let workInProgressHook: Hook | null = null

/**
 * 渲染函数组件，执行组件代码并处理 Hooks。
 *
 * 调用时机：beginWork 中，处理 FunctionComponent 时调用。
 *
 * 核心职责：
 *   1. 初始化 Hooks 渲染环境。
 *   2. 选择正确的 Dispatcher（Mount 或 Update）。
 *   3. 执行组件函数。
 *   4. 清理渲染环境。
 *
 * @param current - 当前 Fiber 节点（null 表示首次挂载）
 * @param workInProgress - 工作中的 Fiber 节点
 * @param Component - 函数组件
 * @param props - 组件 props
 * @param secondArg - 第二个参数（如 ref）
 * @param nextRenderLanes - 本次渲染的优先级
 * @returns 组件返回的子节点
 */
export function renderWithHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any,
  props: Props,
  secondArg: SecondArg,
  nextRenderLanes: Lanes
): any {
  // 初始化渲染环境。
  renderLanes = nextRenderLanes
  currentlyRenderingFiber = workInProgress

  // 清空 workInProgress 的 Hooks 状态。
  workInProgress.memoizedState = null
  workInProgress.updateQueue = null
  workInProgress.lanes = NoLanes

  // 选择 Hooks 的 Dispatcher，根据是首次挂载还是更新阶段来决定使用哪套 Hooks 实现。
  //   current === null：首次挂载。
  //   current.memoizedState === null：有 Fiber 节点，但没有 Hooks 状态，之前没有渲染过 Hooks。
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate

  // 执行组件函数。
  const children = Component(props, secondArg)

  // 如果不在渲染完成后重置 Dispatcher，开发者可能在事件处理器、setTimeout、Promise 回调等地方调用 Hooks，这会导致难以追踪的 bug。
  // 切换为 ContextOnlyDispatcher 后，任何在渲染外调用 Hooks 的行为都会立即报错，并给出明确的错误信息。
  ReactCurrentDispatcher.current = ContextOnlyDispatcher

  // 如果 currentHook 还有剩余，说明本次渲染的 Hooks 比上次少。
  const didRenderTooFewHooks = currentHook !== null && currentHook.next !== null

  // 清理渲染环境。
  renderLanes = NoLanes
  currentlyRenderingFiber = null
  currentHook = null
  workInProgressHook = null

  // 如果 Hooks 数量不一致，抛出错误。
  if (didRenderTooFewHooks) {
    throw new Error(
      'Rendered fewer hooks than expected. This may be caused by an accidental ' +
        'early return statement.'
    )
  }

  return children
}

const HooksDispatcherOnMount: Dispatcher = {
  // readContext,
  useCallback: mountCallback,
  // useContext: readContext,
  useEffect: mountEffect,
  // useImperativeHandle: mountImperativeHandle,
  useLayoutEffect: mountLayoutEffect,
  // useInsertionEffect: mountInsertionEffect,
  useMemo: mountMemo,
  useReducer: mountReducer,
  useRef: mountRef,
  useState: mountState,
  // useDebugValue: mountDebugValue,
  // useDeferredValue: mountDeferredValue,
  // useTransition: mountTransition,
  // useMutableSource: mountMutableSource,
  // useSyncExternalStore: mountSyncExternalStore,
  // useId: mountId,
  // unstable_isNewReconciler: enableNewReconciler,
}

const HooksDispatcherOnUpdate: Dispatcher = {
  // readContext,
  useCallback: updateCallback,
  // useContext: readContext,
  useEffect: updateEffect,
  // useImperativeHandle: updateImperativeHandle,
  // useInsertionEffect: updateInsertionEffect,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: updateReducer,
  useRef: updateRef,
  useState: updateState,
  // useDebugValue: updateDebugValue,
  // useDeferredValue: updateDeferredValue,
  // useTransition: updateTransition,
  // useMutableSource: updateMutableSource,
  // useSyncExternalStore: updateSyncExternalStore,
  // useId: updateId,
  // unstable_isNewReconciler: enableNewReconciler,
}

export const ContextOnlyDispatcher: Dispatcher = {
  // readContext,
  useCallback: throwInvalidHookError,
  // useContext: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  // useImperativeHandle: throwInvalidHookError,
  // useInsertionEffect: throwInvalidHookError,
  useLayoutEffect: throwInvalidHookError,
  useMemo: throwInvalidHookError,
  useReducer: throwInvalidHookError,
  useRef: throwInvalidHookError,
  useState: throwInvalidHookError,
  // useDebugValue: throwInvalidHookError,
  // useDeferredValue: throwInvalidHookError,
  // useTransition: throwInvalidHookError,
  // useMutableSource: throwInvalidHookError,
  // useSyncExternalStore: throwInvalidHookError,
  // useId: throwInvalidHookError,
  // unstable_isNewReconciler: enableNewReconciler,
}

/**
 * 创建新的 Hook 节点并加入 Hook 链表。
 *
 * 调用时机：首次挂载时，每个 Hook（useState、useEffect 等）调用。
 *
 * 核心职责：
 *   1. 创建空的 Hook 对象。
 *   2. 将 Hook 加入链表（第一个或追加到末尾）。
 *   3. 返回新创建的 Hook。
 *
 * @returns 新创建的 Hook
 */
function mountWorkInProgressHook(): Hook {
  // 创建空的 Hook 对象。
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  }

  // 加入 Hook 链表。
  if (workInProgressHook === null) {
    // 第一个 Hook。
    // 将 hook 设为 Fiber 的 memoizedState（链表头）。
    // 同时设为 workInProgressHook（当前指针）。
    currentlyRenderingFiber!.memoizedState = workInProgressHook = hook
  } else {
    // 后续 Hook。
    // 追加到链表末尾。
    // workInProgressHook 指向新创建的 hook。
    workInProgressHook = workInProgressHook.next = hook
  }

  // 返回新创建的 Hook。
  return workInProgressHook
}

/**
 * 首次挂载 useCallback。
 *
 * 调用时机：首次渲染时，执行 useCallback 调用。
 *
 * 核心职责：
 *   1. 创建新的 Hook 节点。
 *   2. 存储 callback 和 deps。
 *   3. 返回 callback。
 *
 * @param callback - 需要缓存的函数
 * @param deps - 依赖数组
 * @returns 缓存的 callback
 */
function mountCallback<T>(callback: T, deps: Array<any> | void | null): T {
  // 创建新的 Hook。
  const hook = mountWorkInProgressHook()
  // 处理 deps。undefined → null（表示没有依赖数组）。
  const nextDeps = deps === undefined ? null : deps
  // 存储到 memoizedState。
  hook.memoizedState = [callback, nextDeps]
  // 返回 callback。
  return callback
}

function mountMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T {
  const hook = mountWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook()
  const ref = { current: initialValue }
  hook.memoizedState = ref
  return ref
}

/**
 * 创建函数组件的 updateQueue。
 *
 * 调用时机：pushEffect 中，queue 不存在时调用。
 *
 * 返回值：
 *   - lastEffect：effect 循环链表的尾指针
 *   - stores：useSyncExternalStore 的 store 链表
 */
function createFunctionComponentUpdateQueue(): FunctionComponentUpdateQueue {
  return {
    lastEffect: null,
    stores: null,
  }
}

/**
 * 创建 Effect 对象，加入 Fiber 的 effect 循环链表。
 *
 * 核心职责：
 *   1. 创建 Effect 对象。
 *   2. 加入 componentUpdateQueue 的 effect 循环链表。
 *   3. 返回 Effect 对象。
 */
function pushEffect(
  tag: HookFlags,
  create: () => (() => void) | void,
  destroy: (() => void) | void,
  deps: Array<any> | null
): Effect {
  const effect: Effect = {
    tag,
    create,
    destroy,
    deps,
    next: null as any,
  }
  let componentUpdateQueue: null | FunctionComponentUpdateQueue =
    currentlyRenderingFiber!.updateQueue
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue()
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue
    componentUpdateQueue.lastEffect = effect.next = effect
  } else {
    const lastEffect = componentUpdateQueue.lastEffect
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect
    } else {
      const firstEffect = lastEffect.next
      lastEffect.next = effect
      effect.next = firstEffect
      componentUpdateQueue.lastEffect = effect
    }
  }
  return effect
}

/**
 * 挂载 Effect 的通用实现（useEffect / useLayoutEffect 共用）。
 */
function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  // 创建新的 Hook 节点。
  const hook = mountWorkInProgressHook()
  // 处理 deps：undefined → null。
  const nextDeps = deps === undefined ? null : deps
  // 设置 Fiber flags（标记有 effect 需要处理）。
  currentlyRenderingFiber!.flags |= fiberFlags
  // 创建 Effect 对象，加入到 currentlyRenderingFiber!.updateQueue，并挂载到 hook.memoizedState。
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    undefined,
    nextDeps
  )
}

/**
 * 首次挂载 useEffect。
 *
 * 调用时机：首次渲染时，执行 useEffect 调用。
 *
 * 核心职责：
 *   调用 mountEffectImpl，传入 useEffect 专用的 flags。
 *
 * @param create - useEffect 回调函数
 * @param deps - 依赖数组
 */
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  return mountEffectImpl(
    PassiveEffect | PassiveStaticEffect,
    HookPassive,
    create,
    deps
  )
}

/**
 * 首次挂载 useLayoutEffect。
 *
 * 调用时机：首次渲染时，执行 useLayoutEffect 调用。
 *
 * 与 mountEffect 的区别：
 *   - mountEffect：PassiveEffect | PassiveStaticEffect, HookPassive。
 *   - mountLayoutEffect：UpdateEffect | LayoutStaticEffect, HookLayout。
 */
function mountLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  return mountEffectImpl(
    UpdateEffect | LayoutStaticEffect,
    HookLayout,
    create,
    deps
  )
}

/**
 * 更新阶段获取 Hook 节点（简化版，不考虑 Rerender）。
 *
 * 核心职责：从 current 树复制 Hook 到 workInProgress 树。
 */
function updateWorkInProgressHook(): Hook {
  if (currentHook === null) {
    currentHook = currentlyRenderingFiber!.alternate!.memoizedState as Hook
    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,
      next: null,
    }
    currentlyRenderingFiber!.memoizedState = workInProgressHook = newHook
  } else {
    currentHook = currentHook.next!
    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,
      next: null,
    }
    workInProgressHook = workInProgressHook!.next = newHook
  }
  return workInProgressHook
}

/**
 * 比较 Hooks 的依赖数组是否相等。
 *
 * 调用时机：useEffect、useMemo、useCallback 等 Hooks 更新时调用，用于判断是否需要重新执行 create 函数。
 *
 * 核心职责：
 *   逐个比较依赖项，使用 Object.is 进行严格比较。
 *
 * @param nextDeps - 新的依赖数组
 * @param prevDeps - 旧的依赖数组（null 表示首次）
 * @returns 是否相等
 */
function areHookInputsEqual(
  nextDeps: Array<any>,
  prevDeps: Array<any> | null
): boolean {
  // prevDeps === null 表示没有旧依赖，必须执行 create 函数。
  if (prevDeps === null) {
    return false
  }

  // 遍历依赖数组，使用 Object.is 比较每个元素。
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (is(nextDeps[i], prevDeps[i])) {
      continue
    }
    return false
  }
  return true
}

/**
 * 更新阶段处理 useCallback。
 *
 * 核心职责：比较依赖数组，决定是否复用旧的 callback。
 */
function updateCallback<T>(callback: T, deps: Array<any> | void | null): T {
  // 从 current 树复制 Hook。
  const hook = updateWorkInProgressHook()
  // 处理 nextDeps。undefined → null（表示没有依赖数组）。
  const nextDeps = deps === undefined ? null : deps
  // 获取上一次的状态 [callback, deps]。
  const prevState = hook.memoizedState
  // nextDeps 不为 null 时，比较依赖。
  if (nextDeps !== null) {
    const prevDeps: Array<any> = prevState[1]
    // 依赖相等 → 复用旧的 callback。
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0]
    }
  }
  // 更新 memoizedState。
  hook.memoizedState = [callback, nextDeps]
  // 返回新的 callback。
  return callback
}

function updateMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState
  if (nextDeps !== null) {
    const prevDeps: Array<any> = prevState[1]
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0]
    }
  }
  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook()
  return hook.memoizedState
}

/**
 * 更新阶段 Effect 的核心实现（useEffect / useLayoutEffect 在组件重新渲染时调用）。
 *
 * @param fiberFlags  - 当依赖变化时，需要标记到 Fiber 节点上的副作用标志
 * @param hookFlags   - Hook 级别的标志位，标识当前 Effect 的类型
 * @param create      - 用户传入的 effect 回调函数，可返回一个销毁函数（destroy）
 * @param deps        - 用户传入的依赖数组，用于判断 effect 是否需要重新执行
 */
function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  let destroy = undefined

  const prevEffect = currentHook!.memoizedState
  destroy = prevEffect.destroy

  if (nextDeps !== null) {
    const prevDeps = prevEffect.deps
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      // 依赖未变：将 effect 节点推入链表，但不带 HookHasEffect 标志。
      //   这意味着该 effect 在本轮渲染中不会被执行（跳过）。
      hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps)
      return
    }
  }

  // 依赖发生了变化（或 deps 为 null 表示每次都要执行）。
  //   在 Fiber 节点上标记对应的副作用标志（如 PassiveEffect），告知协调器在 commit 阶段需要执行该 effect。
  currentlyRenderingFiber!.flags |= fiberFlags
  // 将 effect 节点推入链表，关键区别：带上 HookHasEffect 标志。
  //   HookHasEffect | hookFlags 表示该 effect 在本轮渲染中需要被实际执行。
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    destroy,
    nextDeps
  )
}

function updateEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  return updateEffectImpl(PassiveEffect, HookPassive, create, deps)
}

function updateLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  return updateEffectImpl(UpdateEffect, HookLayout, create, deps)
}

function throwInvalidHookError(): never {
  throw new Error(
    'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
      ' one of the following reasons:\n' +
      '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
      '2. You might be breaking the Rules of Hooks\n' +
      '3. You might have more than one copy of React in the same app\n' +
      'See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.'
  )
}

/**
 * Bailout 时同步 Hooks 状态。
 *
 * 调用时机：beginWork 中，检测到组件没有更新需要处理时调用。
 *
 * 核心职责：
 *   1. 复用旧的 updateQueue。
 *   2. 清除 Passive 和 Update 标志。
 *   3. 从 current.lanes 中移除本次处理的 lanes。
 *
 * @param current - 当前 Fiber 节点
 * @param workInProgress - 工作中的 Fiber 节点
 * @param lanes - 本次更新的优先级
 */
export function bailoutHooks(
  current: Fiber,
  workInProgress: Fiber,
  lanes: Lanes
): void {
  // 不需要重新渲染，直接复用旧的 updateQueue。
  workInProgress.updateQueue = current.updateQueue

  // PassiveEffect：useEffect 相关标志。
  // UpdateEffect：组件有更新标志。
  // 清除这些标志表示"不需要处理"。
  workInProgress.flags &= ~(PassiveEffect | UpdateEffect)

  // 作用：请见《React 设计原理》第 227 页。
  current.lanes = removeLanes(current.lanes, lanes)
}
