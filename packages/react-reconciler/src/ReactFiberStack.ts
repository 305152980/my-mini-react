import type { Fiber } from './ReactInternalTypes'

export type StackCursor<T> = {
  current: T
}
/**
 * valueStack 存储的内容：
 *   类型                说明	               示例
 *   HostContainer	     宿主容器	           document.getElementById('root')
 *   HostContext	       宿主环境上下文	     命名空间（SVG、MathML）
 *   Legacy Context	     旧版 Context	      React 16.3 之前的 Context
 *   New Context	       新版 Context	      React 16.3+ 的 Context
 *   Suspense Context	   Suspense 上下文	  是否处于 Suspense 状态
 */
const valueStack: Array<any> = []
let index = -1

export function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  }
}

export function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index++
  valueStack[index] = cursor.current
  cursor.current = value
}

export function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
  if (index < 0) {
    return
  }
  cursor.current = valueStack[index]
  valueStack[index] = null
  index--
}
