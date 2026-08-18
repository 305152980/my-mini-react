import type { Dispatcher } from '@my-mini-react/react-reconciler'
import ReactCurrentDispatcher from './ReactCurrentDispatcher'

type BasicStateAction<S> = ((state: S) => S) | S
type Dispatch<A> = (action: A) => void

function resolveDispatcher(): Dispatcher {
  const dispatcher = ReactCurrentDispatcher.current
  return dispatcher as Dispatcher
}

export function useCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const dispatcher = resolveDispatcher()
  return dispatcher.useCallback(callback, deps)
}

export function useMemo<T>(create: () => T, deps: Array<any> | void | null): T {
  const dispatcher = resolveDispatcher()
  return dispatcher.useMemo(create, deps)
}

export function useRef<T>(initialValue: T): { current: T } {
  const dispatcher = resolveDispatcher()
  return dispatcher.useRef(initialValue)
}

export function useEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const dispatcher = resolveDispatcher()
  return dispatcher.useEffect(create, deps)
}

export function useLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const dispatcher = resolveDispatcher()
  return dispatcher.useLayoutEffect(create, deps)
}

export function useReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initial: I) => S
): [S, Dispatch<A>] {
  const dispatcher = resolveDispatcher()
  return dispatcher.useReducer(reducer, initialArg, init)
}

export function useState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher()
  return dispatcher.useState(initialState)
}
