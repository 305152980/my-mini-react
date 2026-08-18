/**
 * 将 React 的 style 对象逐一设置到 DOM 节点的 style 上。
 *
 * 处理逻辑：
 *   - 自定义属性（--xxx）→ 用 setProperty 设置
 *   - float → 转换为 cssFloat（因为 float 是 JS 保留字）
 *   - 其他属性 → 直接赋值到 style[styleName]
 *
 * @param node - DOM 节点
 * @param styles - React 格式的样式对象（驼峰命名）
 */
export function setValueForStyles(
  node: HTMLElement | SVGElement,
  styles: Record<string, string | number>
): void {
  const style = node.style
  for (let styleName in styles) {
    if (!styles.hasOwnProperty(styleName)) {
      continue
    }

    // 判断是否是 CSS 自定义属性（如 --my-color）。
    const isCustomProperty = styleName.indexOf('--') === 0
    // TODO: 待实现。
    // // 将 React 格式的值转换为浏览器可接受的 CSS 值。
    // // 例如：数字自动加 px（width: 100 → "100px"），null/undefined → ""。
    // const styleValue = dangerousStyleValue(
    //   styleName,
    //   styles[styleName],
    //   isCustomProperty
    // )
    const styleValue = styles[styleName]
    if (styleName === 'float') {
      styleName = 'cssFloat'
    }
    if (isCustomProperty) {
      style.setProperty(styleName, styleValue as string | null)
    } else {
      ;(style as any)[styleName] = styleValue
    }
  }
}
