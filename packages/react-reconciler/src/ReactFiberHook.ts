import { type Fiber } from './ReactInternalTypes'

type Hook = {
  memoizedState: any
  next: null | Hook
}

type Dispatch<A> = (action: A) => void

let currentlyRenderingFiber: Fiber | null = null
let currentHook: Hook | null = null
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

export function useReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initialArg: I) => S
): [S, Dispatch<A>] {
  const hook: Hook = {
    memoizedState: null,
    next: null,
  }
  let initialState: S
  if (init !== undefined) {
    initialState = init(initialArg)
  } else {
    initialState = initialArg as unknown as S
  }
  hook.memoizedState = initialState
  const dispatch: Dispatch<A> = (action: A) => {
    const newValue = reducer(initialState, action)
    // TODO
  }
  return [hook.memoizedState, dispatch]
}
