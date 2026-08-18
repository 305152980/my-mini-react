// 此方法简化了实现。
/**
 * 将属性设置到 DOM 节点上（最精简版）。
 *
 * 核心逻辑：
 *   - 值为 null / undefined / false → removeAttribute
 *   - 其他值 → 转为字符串后 setAttribute
 *
 * 完整版还需处理的边界情况：
 *   - 布尔属性（disabled → setAttribute('disabled', '')）
 *   - mustUseProperty（input.value 等必须用 node.value = ... 设置）
 *   - 自定义元素事件绑定
 *   - Trusted Types 安全策略
 *   - URL 消毒（javascript: 协议）
 *
 * @param node - 目标 DOM 节点
 * @param name - 属性名
 * @param value - 属性值
 * @param isCustomComponentTag - 是否是自定义组件标签
 */
export function setValueForProperty(
  node: Element,
  name: string,
  value: any,
  isCustomComponentTag: boolean
): void {
  if (value == null || value === false) {
    node.removeAttribute(name)
  } else {
    node.setAttribute(name, '' + value)
  }
}
