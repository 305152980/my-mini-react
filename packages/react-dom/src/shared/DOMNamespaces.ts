// HTML 元素的命名空间（Namespace）是 XML 和 DOM 规范中的一个概念，用于区分和识别不同来源的标签，防止命名冲突。

// 命名空间常量。
export const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
export const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML'
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * 获取元素固有的命名空间
 *
 * @param type - 元素类型（如 'svg'、'math'）
 * @returns 对应的命名空间
 */
export function getIntrinsicNamespace(type: string): string {
  switch (type) {
    case 'svg':
      return SVG_NAMESPACE
    case 'math':
      return MATH_NAMESPACE
    default:
      return HTML_NAMESPACE
  }
}

/**
 * 获取子元素的命名空间
 *
 * @param parentNamespace - 父元素的命名空间
 * @param type - 元素类型
 * @returns 子元素的命名空间
 */
export function getChildNamespace(
  parentNamespace: string | null,
  type: string
): string {
  // 如果父元素没有命名空间或是 HTML 命名空间，根据元素类型获取固有命名空间。
  if (parentNamespace == null || parentNamespace === HTML_NAMESPACE) {
    return getIntrinsicNamespace(type)
  }

  // SVG 中的 foreignObject 可以包含 HTML 元素。
  if (parentNamespace === SVG_NAMESPACE && type === 'foreignObject') {
    return HTML_NAMESPACE
  }

  // 其他情况继承父元素的命名空间。
  return parentNamespace
}
