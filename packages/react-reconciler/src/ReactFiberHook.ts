import { isFn } from '@my-mini-react/shared/utils'
import { scheduleUpdateOnFiber } from './ReactFiberWorkLoop'
import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { HostRoot } from './ReactWorkTags'
import { type Flags, Update, Passive } from './ReactFiberFlags'
import { type HookFlags, HookLayout, HookPassive } from './ReactHookEffectTags'
import type { ReactContext } from '@my-mini-react/shared/ReactTypes'
import { readContext } from './ReactFiberNewContext'

type Hook = {
  memoizedState: any
  next: null | Hook
}

type Dispatch<A> = (action: A) => void

type Effect = {
  tag: HookFlags
  create: () => void | (() => void)
  destroy: void | (() => void)
  deps: Array<any> | null | void
  next: Effect | null
}

// 当前正在渲染的 fiber。
let currentlyRenderingFiber: Fiber | null = null
// 上一轮渲染中生成的 Hook 链表的当前遍历指针，它代表了“旧的状态”。
let currentHook: Hook | null = null
// 下一个 hook。
let workInProgressHook: Hook | null = null

/**
 * 渲染带有 Hooks 的函数组件
 *
 * @param current - 内存中旧的 Fiber 节点（用于对比和获取上一次的状态）
 * @param workInProgress - 当前正在构建的新 Fiber 节点（工作进度节点）
 * @param Component - 用户定义的函数组件（例如：function App() { ... }）
 * @param props - 组件接收到的属性
 * @returns - 组件渲染返回的 React 节点（JSX）
 */
export function renderWithHooks<Props>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  props: Props
): any {
  // 1. 设置全局渲染指针
  // 将当前正在渲染的 Fiber 节点赋值给一个全局变量。
  // 这是 Hooks 能够工作的关键：useState() 等 Hook 函数不需要接收任何参数，
  // 它们通过这个全局变量知道当前是哪个组件在调用它们，从而找到对应的状态存储位置。
  currentlyRenderingFiber = workInProgress
  // 2. 重置工作节点的 Hooks 状态
  // 在重新渲染（更新）阶段，我们需要清空上一次渲染留下的 Hooks 链表。
  // 因为 Hooks 链表是根据组件渲染时的调用顺序重新构建的。
  // 注意：这里清空的是 memoizedState（Hooks 链表头），而不是 memoizedProps。
  workInProgress.memoizedState = null
  // 3. 重置更新队列
  // 同样，清除旧的 updateQueue。
  // 在函数组件中，updateQueue 主要用于存储 useReducer 或 useState 的更新，
  // 或者是 useLayoutEffect/useEffect 的副作用标记。
  workInProgress.updateQueue = null
  // 4. 执行组件函数
  // 这里真正执行了用户的组件代码。
  // 当组件内部调用 useState() 或 useEffect() 时，这些 Hook 会利用上面设置的
  // currentlyRenderingFiber 全局变量，将自身的数据（状态、副作用）
  // 挂载到 workInProgress 节点的 memoizedState 或 updateQueue 上。
  const children = Component(props)
  // 5. 完成渲染
  // 执行一些清理工作，比如重置全局变量 currentlyRenderingFiber 为 null，
  // 防止在组件外部误用 Hooks。
  // 同时处理一些特殊的副作用逻辑（如 useImperativeHandle）。
  finishRenderingHooks()
  // 6. 返回渲染结果
  // 返回组件生成的虚拟 DOM（React Elements），供 React 进行 Diff 和提交。
  return children
}

function finishRenderingHooks(): void {
  currentlyRenderingFiber = null
  currentHook = null
  workInProgressHook = null
}

// 1、返回当前 useX 函数对用的 hook。
// 2、构建 hook 链表。
function updateWorkInProgressHook(): Hook {
  let hook: Hook
  const current = currentlyRenderingFiber!.alternate
  if (current) {
    // update 阶段。
    currentlyRenderingFiber!.memoizedState = current.memoizedState
    if (workInProgressHook) {
      hook = workInProgressHook.next as Hook
      workInProgressHook = hook
      currentHook = currentHook!.next
    } else {
      hook = currentlyRenderingFiber!.memoizedState as Hook
      workInProgressHook = hook
      currentHook = current.memoizedState
    }
  } else {
    // mount 阶段。
    currentHook = null
    hook = {
      memoizedState: null,
      next: null,
    }
    if (workInProgressHook) {
      workInProgressHook.next = hook
      workInProgressHook = workInProgressHook.next
    } else {
      currentlyRenderingFiber!.memoizedState = hook
      workInProgressHook = currentlyRenderingFiber!.memoizedState
    }
  }
  return hook
}

function getRootForUpdateFiber(sourceFiber: Fiber): FiberRoot | null {
  let node = sourceFiber
  let parent = node.return
  while (parent !== null) {
    node = parent
    parent = node.return
  }
  if (node.tag === HostRoot) {
    // 对于 HostRoot 类型的 Fiber，其 stateNode 就是 FiberRoot 实例。
    return node.stateNode as FiberRoot
  } else {
    // 如果循环结束后 node.tag 不是 HostRoot，说明它可能是一个未挂载的游离节点。
    return null
  }
}

function dispatchReducerAction<S, I, A>(
  fiber: Fiber,
  hook: Hook,
  reducer: (state: S, action: A) => S,
  action: A
): void {
  hook.memoizedState = reducer(hook.memoizedState, action)
  const root = getRootForUpdateFiber(fiber) as FiberRoot
  scheduleUpdateOnFiber(root, fiber, true)
}

export function useReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initialArg: I) => S
): [S, Dispatch<A>] {
  // 1、构建 hook 链表（mount、update）。
  const hook: Hook = updateWorkInProgressHook()
  let initialState: S
  if (init !== undefined) {
    initialState = init(initialArg)
  } else {
    initialState = initialArg as unknown as S
  }
  // 2、区分函数组件是初次挂载还是更新。
  if (!currentlyRenderingFiber!.alternate) {
    hook.memoizedState = initialState
  }
  // 3、dispatch 函数。
  const dispatch: Dispatch<A> = (dispatchReducerAction<S, I, A>).bind(
    null,
    currentlyRenderingFiber!,
    hook,
    reducer
  )
  return [hook.memoizedState, dispatch]
}

type SetStateAction<S> = S | ((prevState: S) => S)
export function useState<S>(
  initialState: S | (() => S)
): [S, Dispatch<SetStateAction<S>>] {
  const init = isFn(initialState) ? (initialState as () => S)() : initialState
  return useReducer(
    (s: S, a: SetStateAction<S>) => (isFn(a) ? (a as any)(s) : a),
    init
  )
}

export function areHookInputsEqual(
  nextDeps: Array<any>,
  prevDeps: Array<any> | null
): boolean {
  if (prevDeps === null) {
    return false
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue
    }
    return false
  }
  return true
}
export function useMemo<T>(
  nextCreate: () => T,
  deps: Array<any> | null | void
): T {
  const hook: Hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps

  const prevState = hook.memoizedState
  if (prevState !== null && nextDeps !== null) {
    const prevDeps = prevState[1]
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      // 1、prevState 有值。
      // 2、nextDeps 不为 null 且 areHookInputsEqual(nextDeps, prevDeps)。
      // 1 & 2
      return prevState[0]
    }
  }

  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}

export function useCallback<T extends Function>(
  callback: T,
  deps: Array<any> | null | void
): T {
  return useMemo(() => callback, deps)
}

export function useRef<T>(initialValue: T): { current: T } {
  const hook: Hook = updateWorkInProgressHook()
  if (currentHook === null) {
    hook.memoizedState = { current: initialValue }
  }
  return hook.memoizedState
}

export function useLayoutEffect(
  create: () => void | (() => void),
  deps: Array<any> | null | void
): void {
  updateEffectImpl(Update, HookLayout, create, deps)
}

export function useEffect(
  create: () => void | (() => void),
  deps: Array<any> | null | void
): void {
  updateEffectImpl(Passive, HookPassive, create, deps)
}

function pushEffect(
  hookFlags: HookFlags,
  create: () => void | (() => void),
  deps: Array<any> | null | void
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy: undefined,
    deps,
    next: null,
  }
  let componentUpdateQueue = currentlyRenderingFiber!.updateQueue
  if (componentUpdateQueue === null) {
    // 第一个 effect。
    componentUpdateQueue = {
      lastEffect: null,
    }
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue
    effect.next = effect
    componentUpdateQueue.lastEffect = effect
  } else {
    // 已有 effect，追加到链表末尾。
    const lastEffect = componentUpdateQueue.lastEffect
    const firstEffect = lastEffect.next
    lastEffect.next = effect
    effect.next = firstEffect
    componentUpdateQueue.lastEffect = effect
  }
  return effect
}
function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => void | (() => void),
  deps: Array<any> | null | void
): void {
  const hook: Hook = updateWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  // 检测依赖项是否发生变化。
  // 组件更新阶段才检查：currentHook !== null。
  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevState = currentHook.memoizedState.deps
      if (areHookInputsEqual(nextDeps, prevState)) {
        return
      }
    }
  }
  currentlyRenderingFiber!.flags |= fiberFlags
  // 1、保存 Effect 对象到当前 Hook 的 memoizedState。
  // 2、构建 Effect 链表（单向循环链表）。
  hook.memoizedState = pushEffect(hookFlags, create, nextDeps)
}

export function useContext<T>(context: ReactContext<T>): T {
  return readContext(context)
}
