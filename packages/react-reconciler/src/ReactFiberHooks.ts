import ReactSharedInternals from '@my-mini-react/shared/ReactSharedInternals'
import {
  type Lane,
  type Lanes,
  NoLane,
  NoLanes,
  removeLanes,
  isSubsetOfLanes,
  mergeLanes,
} from './ReactFiberLane'
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
import {
  requestUpdateLane,
  requestEventTime,
  scheduleUpdateOnFiber,
  getWorkInProgressRootRenderLanes,
  markSkippedUpdateLanes,
} from './ReactFiberWorkLoop'
import { enqueueConcurrentHookUpdate } from './ReactFiberConcurrentUpdates'
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork'
import { readContext } from './ReactFiberNewContext'

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
  readContext,
  useCallback: mountCallback,
  useContext: readContext,
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
  readContext,
  useCallback: updateCallback,
  useContext: readContext,
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
  readContext,
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
 * 基础 state reducer。
 *
 * 用于 useState 的内部 reducer。
 * 如果 action 是函数，则调用它并传入当前 state（支持函数式更新）；
 * 如果 action 是普通值，则直接返回。
 *
 * 例如：
 *   setState(10)                 → action = 10     → 返回 10
 *   setState(prev => prev + 1)   → action = 函数   → 调用函数，返回 prev + 1
 */
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === 'function'
    ? (action as (state: S) => S)(state)
    : action
}

/**
 * dispatchSetState —— useState 返回的 setState 函数的底层实现。
 *
 * 调用时机：用户调用 setState(xxx) 时触发。
 *
 * 执行流程：
 *   1. 请求本次更新的优先级（lane）。
 *   2. 创建 update 对象，包含 action、lane、eagerState 等。
 *   3. 将 update 入队（通过 enqueueConcurrentHookUpdate）。
 *      - 入队到临时数组，不直接修改环形链表（保证并发安全）。
 *      - 返回 FiberRoot，如果返回 null 说明不需要调度。
 *   4. 如果有 root，调度一次 Fiber 更新（scheduleUpdateOnFiber）。
 *
 * 参数：
 *   fiber  - 当前组件对应的 Fiber 节点
 *   queue  - 该 hook 的更新队列
 *   action - 用户传入的新值或更新函数
 */
function dispatchSetState<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A
): void {
  const lane = requestUpdateLane(fiber)
  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null as any,
  }

  // TODO: 这里省略 eagerState 策略。

  const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane)
  if (root !== null) {
    const eventTime = requestEventTime()
    scheduleUpdateOnFiber(root, fiber, lane, eventTime)
  }
}

/**
 * mountState —— useState 在首次渲染（mount）时的实现。
 *
 * 调用时机：mount 阶段，Hooks 链表尚未建立，逐个处理 hooks 时调用。
 *
 * 执行流程：
 *   1. 创建一个新的 hook 对象，追加到当前 Fiber 的 hooks 链表尾部。
 *   2. 处理 initialState：如果是函数则调用它（惰性初始化）。
 *   3. 将初始 state 存入 hook.memoizedState 和 hook.baseState。
 *   4. 创建该 hook 的 updateQueue（环形链表，初始为空）。
 *   5. 创建 dispatch 函数（用户调用的 setState），绑定到 queue.dispatch。
 *   6. 返回 [当前 state, dispatch]。
 *
 * 关键数据结构：
 *   hook.memoizedState  - 当前 state 值（渲染时使用）
 *   hook.baseState      - 基础 state（处理 update 的起点）
 *   hook.queue          - 更新队列（存储待处理的 update）
 *   queue.dispatch      - setState 函数（用户调用触发更新）
 */
function mountState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountWorkInProgressHook()
  if (typeof initialState === 'function') {
    initialState = (initialState as () => S)()
  }
  hook.memoizedState = hook.baseState = initialState
  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  }
  hook.queue = queue
  const dispatch: Dispatch<BasicStateAction<S>> = (queue.dispatch =
    dispatchSetState.bind(null, currentlyRenderingFiber!, queue as any))
  return [hook.memoizedState, dispatch]
}

/**
 * dispatchReducerAction —— useReducer 返回的 dispatch 函数的底层实现。
 *
 * 与 dispatchSetState 逻辑几乎一致，区别在于：
 *   - dispatchSetState 使用 basicStateReducer（内置 reducer）。
 *   - dispatchReducerAction 使用用户自定义的 reducer。
 *
 * 执行流程：
 *   1. 计算本次更新的优先级（lane）。
 *   2. 创建 update 对象，action 为用户传入的动作描述。
 *   3. 将 update 入队（并发安全）。
 *   4. 如果有 root，调度一次 Fiber 更新。
 */
function dispatchReducerAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A
): void {
  const lane = requestUpdateLane(fiber)
  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null as any,
  }

  const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane)
  if (root !== null) {
    const eventTime = requestEventTime()
    scheduleUpdateOnFiber(root, fiber, lane, eventTime)
  }
}

/**
 * mountReducer —— useReducer 在首次渲染（mount）时的实现。
 *
 * 调用时机：mount 阶段，处理 useReducer 对应的 hook 时调用。
 *
 * 参数：
 *   reducer    - 用户定义的 reducer 函数 (state, action) => newState
 *   initialArg - 初始 state 或初始参数
 *   init       - 可选的惰性初始化函数，接收 initialArg 返回初始 state
 *
 * 执行流程：
 *   1. 创建新 hook，追加到 hooks 链表。
 *   2. 计算初始 state：有 init 则调用 init(initialArg)，否则 initialArg 本身就是初始 state。
 *   3. 将初始 state 存入 hook.memoizedState 和 hook.baseState。
 *   4. 创建 updateQueue，lastRenderedReducer 保存用户自定义的 reducer。
 *   5. 创建 dispatch 函数，绑定到 queue.dispatch。
 *   6. 返回 [state, dispatch]。
 *
 * 与 mountState 的区别：
 *   - mountState 用 basicStateReducer（内置 reducer，直接返回 action 或调用 action 函数）。
 *   - mountReducer 用用户自定义的 reducer（如 (state, action) => { switch(action.type) ... }）。
 */
function mountReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (arg: I) => S
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook()
  let initialState: S
  if (init !== undefined) {
    initialState = init(initialArg)
  } else {
    initialState = initialArg as unknown as S
  }
  hook.memoizedState = hook.baseState = initialState
  const queue: UpdateQueue<S, A> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState,
  }
  hook.queue = queue
  const dispatch: Dispatch<A> = (queue.dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber!,
    queue as any
  ))
  return [hook.memoizedState, dispatch]
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

function updateState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, initialState as any)
}

/**
 * updateReducer —— useReducer / useState 在更新阶段的实现。
 *
 * 调用时机：组件重新渲染时，处理 useReducer / useState 对应的 hook。
 *
 * 整体流程：
 *   1. 获取当前 hook 和它的 updateQueue。
 *   2. 合并 baseQueue（上次跳过的旧 update）和 pendingQueue（新的 update）。
 *   3. 遍历所有 update，按优先级处理或跳过。
 *   4. 比较新旧 state，决定是否标记更新。
 *   5. 更新 hook 的 memoizedState、baseState、baseQueue。
 *   6. 返回 [state, dispatch]。
 */
function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (arg: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook()
  const queue = hook.queue

  // 因为 queue 在 mount 阶段一定会被创建。如果 update 阶段发现 queue 为 null，说明 React 内部出了问题。
  if (queue === null) {
    throw new Error(
      'Should have a queue. This is likely a bug in React. Please file an issue.'
    )
  }

  // 更新 reducer 引用（用户可能在每次渲染时传入不同的 reducer）。
  queue.lastRenderedReducer = reducer

  const current = currentHook!

  // ─── 第一步：合并队列。旧队列在前，新队列在后。 ───
  let baseQueue = current.baseQueue
  const pendingQueue = queue.pending
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next
      const pendingFirst = pendingQueue.next
      baseQueue.next = pendingFirst
      pendingQueue.next = baseFirst
    }
    // queue.pending 是"一次性消费"的——读了就清空。清空后必须把数据存到别处（current.baseQueue），否则中断后就找不回来了。
    current.baseQueue = baseQueue = pendingQueue
    // 清空 pending，所有 update 已转移到 baseQueue。
    queue.pending = null
  }

  // ─── 第二步：处理 update 队列。 ───
  if (baseQueue !== null) {
    const first = baseQueue.next
    let newState = current.baseState

    let newBaseState = null
    let newBaseQueueFirst: Update<S, A> | null = null
    let newBaseQueueLast: Update<S, A> | null = null
    let update = first
    do {
      // 判断当前 update 的优先级是否足够，不够就跳过。
      //   isSubsetOfLanes: 检查 getWorkInProgressRootRenderLanes() 是否包含 update.lane。
      //   getWorkInProgressRootRenderLanes: 获取当前正在渲染的 root 的渲染优先级（lanes）。
      const shouldSkipUpdate = !isSubsetOfLanes(
        getWorkInProgressRootRenderLanes(),
        update.lane
      )

      if (shouldSkipUpdate) {
        const clone: Update<S, A> = {
          lane: update.lane,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: null as any,
        }
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone
          // 定格 baseState：下次渲染从这个 state 开始重新计算。
          newBaseState = newState
        } else {
          newBaseQueueLast.next = clone
          newBaseQueueLast = clone
        }
        // 将被跳过的 lane 累加到 fiber.lanes，确保下次会调度对应优先级。
        currentlyRenderingFiber!.lanes = mergeLanes(
          currentlyRenderingFiber!.lanes,
          update.lane
        )
        // 将被跳过的 update.lane 标记到 workInProgressRootSkippedLanes。
        markSkippedUpdateLanes(update.lane)
      } else {
        // 前面有被跳过的 update，当前 update 需要克隆一份（lane = NoLane）放入 baseQueue。
        // NoLane（0）是所有 lanes 的子集 → 下次一定不会被跳过。
        // 这保证了：一旦有 update 被跳过，后续 update 的副本下次一定执行。
        if (newBaseQueueLast !== null) {
          const clone: Update<S, A> = {
            lane: NoLane,
            action: update.action,
            hasEagerState: update.hasEagerState,
            eagerState: update.eagerState,
            next: null as any,
          }
          newBaseQueueLast.next = clone
          newBaseQueueLast = clone
        } else {
          if (update.hasEagerState) {
            // eagerState 策略：入队时已经预计算了结果，直接用。
            newState = update.eagerState
          } else {
            // 正常路径：用 reducer 计算新 state。
            const action = update.action
            newState = reducer(newState, action)
          }
        }
      }
      update = update.next
    } while (update !== null && update !== first)

    if (newBaseQueueLast === null) {
      // 没有 update 被跳过，baseState 就是最终 state。
      newBaseState = newState
    } else {
      // 有 update 被跳过，将 baseQueue 闭合成环形链表。
      newBaseQueueLast.next = newBaseQueueFirst!
    }

    // 比较新旧 state，如果变了则标记组件需要继续渲染（不 bailout）。
    if (!is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate()
    }

    // 更新 hook 的属性。
    hook.memoizedState = newState // 当前 state。
    hook.baseState = newBaseState // 下次渲染的起始 state。
    hook.baseQueue = newBaseQueueLast // 下次继承的未处理 update（尾指针）。

    // 记录本次最后渲染的 state（用于 eagerState 优化）。
    queue.lastRenderedState = newState
  } else {
    // 没有 update 需要处理，清空队列的 lanes。
    queue.lanes = NoLanes
  }

  const dispatch: Dispatch<A> = queue.dispatch
  return [hook.memoizedState, dispatch]
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
