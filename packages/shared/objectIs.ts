/**
 * Object.is 的 polyfill 实现
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
function objectIsPolyfill(x: unknown, y: unknown): boolean {
  return (
    (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) ||
    (x !== x && y !== y)
  )
}

// 优先使用原生 Object.is，否则使用 polyfill
const objectIs: (x: unknown, y: unknown) => boolean =
  typeof Object.is === 'function' ? Object.is : objectIsPolyfill

export default objectIs
