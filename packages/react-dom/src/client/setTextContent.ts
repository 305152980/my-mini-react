import { TEXT_NODE } from '../shared/HTMLNodeType'

/**
 * 设置 DOM 节点的文本内容。
 *
 * 性能优化：
 *   如果节点只有一个文本子节点，直接修改 nodeValue，而不是用 textContent 重写整个子树。
 *   nodeValue 赋值是 O(1)，textContent 赋值会先清空所有子节点再创建新文本节点。
 *
 * @param node - 目标 DOM 元素
 * @param text - 要设置的文本内容
 */
const setTextContent = function (node: Element, text: string): void {
  if (text) {
    const firstChild = node.firstChild

    // 快速路径：只有一个文本子节点时，直接修改 nodeValue。
    // 条件：
    //   firstChild → 有子节点。
    //   firstChild === node.lastChild → 只有一个子节点。
    //   firstChild.nodeType === TEXT_NODE → 该子节点是文本节点。
    if (
      firstChild &&
      firstChild === node.lastChild &&
      firstChild.nodeType === TEXT_NODE
    ) {
      firstChild.nodeValue = text
      return
    }
  }

  // 慢路径：直接设置 textContent。
  // 会清空所有子节点，创建新的文本节点。
  // 适用于：无子节点、多个子节点、或 text 为空的情况。
  node.textContent = text
}

export default setTextContent
