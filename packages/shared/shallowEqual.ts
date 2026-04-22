import is from './objectIs'
import hasOwnProperty from './hasOwnProperty'

/**
 * 浅比较两个对象的属性值是否相等
 */
function shallowEqual(objA: unknown, objB: unknown): boolean {
  // 如果两个值完全相等，直接返回 true
  if (is(objA, objB)) {
    return true
  }

  // 如果有一个不是对象类型，返回 false
  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false
  }

  const keysA = Object.keys(objA as object)
  const keysB = Object.keys(objB as object)

  // 如果属性数量不同，返回 false
  if (keysA.length !== keysB.length) {
    return false
  }

  // 遍历所有属性，检查 objB 是否包含相同属性且值相等
  for (let i = 0; i < keysA.length; i++) {
    const currentKey = keysA[i]
    if (
      !hasOwnProperty.call(objB, currentKey) ||
      !is(
        (objA as Record<string, unknown>)[currentKey],
        (objB as Record<string, unknown>)[currentKey]
      )
    ) {
      return false
    }
  }

  return true
}

export default shallowEqual
