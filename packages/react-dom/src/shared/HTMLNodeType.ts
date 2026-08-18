/**
 * HTML 节点类型常量
 *
 * 对应 DOM 规范中的 nodeType 值
 * 用于区分不同类型的 DOM 节点
 */

// 元素节点（如 <div>、<span>、<p> 等）。
// 最常见的节点类型。
export const ELEMENT_NODE = 1

// 文本节点。
// 包含文本内容。
export const TEXT_NODE = 3

// 注释节点。
// 包含注释内容（如 <!-- 注释 -->）。
export const COMMENT_NODE = 8

// 文档节点。
// 即 document 对象。
export const DOCUMENT_NODE = 9

// 文档片段节点。
// DocumentFragment，用于批量操作 DOM。
export const DOCUMENT_FRAGMENT_NODE = 11
