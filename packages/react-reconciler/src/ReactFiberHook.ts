import { isFn } from '@my-mini-react/shared/utils'
import { scheduleUpdateOnFiber } from './ReactFiberWorkLoop'
import type { Fiber, FiberRoot } from './ReactInternalTypes'
import { HostRoot } from './ReactWorkTags'

type Hook = {
  memoizedState: any
  next: null | Hook
}

type Dispatch<A> = (action: A) => void

// 当前正在渲染的 fiber。
let currentlyRenderingFiber: Fiber | null = null
// 上一轮渲染中生成的 Hook 链表的当前遍历指针，它代表了“旧的状态”。
let currentHook: Hook | null = null
// 下一个 hook。
let workInProgressHook: Hook | null = null

export function renderWithHooks<Props>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  props: Props
): any {
  currentlyRenderingFiber = workInProgress
  workInProgress.memoizedState = null
  const children = Component(props)
  finishRenderingHooks()
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
  deps: Array<any> | void | null
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
  deps: Array<any> | void | null
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
