export type StackCursor<T> = {
  current: T
}

const valueStack: Array<any> = []
let index = -1

export function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  }
}

export function push<T>(cursor: StackCursor<T>, value: T): void {
  index += 1
  valueStack[index] = cursor.current
  cursor.current = value
}

export function pop<T>(cursor: StackCursor<T>): void {
  if (index < 0) {
    return
  }
  cursor.current = valueStack[index]
  valueStack[index] = null
  index -= 1
}
