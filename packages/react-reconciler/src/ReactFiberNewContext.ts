import type { ReactContext } from '@my-mini-react/shared/ReactTypes'
import { type StackCursor, createCursor, pop, push } from './ReactFiberStack'

const valueCursor: StackCursor<any> = createCursor(null)

export function pushProvider<T>(context: ReactContext<T>, nextValue: T): void {
  push(valueCursor, context._currentValue)
  context._currentValue = nextValue
}

export function readContext<T>(context: ReactContext<T>): T {
  return context._currentValue
}

export function popProvider<T>(context: ReactContext<T>): void {
  const currentValue = valueCursor.current
  pop(valueCursor)
  context._currentValue = currentValue
}
