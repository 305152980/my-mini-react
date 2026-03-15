// React 元素类型（虚拟DOM节点）
// 由 React.createElement / jsx 编译后生成
export type ReactElement = {
  // 标识对象是 ReactElement 的唯一内部标记（防XSS）
  $$typeof: any

  // 元素类型：字符串(div/span) 或 函数组件/类组件
  type: any

  // 列表渲染的 key，用于 diff 优化
  key: any

  // 引用真实 DOM 或组件实例的 ref 对象
  ref: any

  // 组件/元素接收的属性对象（children、className、onClick 等）
  props: any

  // 待更新的新属性（Reconciler 协调阶段使用）
  pendingProps: any

  // 内部属性：创建此元素的组件所有者（React 内部使用）
  _owner: any
}
// React 文本类型：字符串 / 数字
export type ReactText = string | number

// React 空类型：null / undefined / 布尔值（均不渲染）
export type ReactEmpty = null | void | boolean

// React 片段类型：可迭代的 ReactNode（用于 <></> 等片段容器）
export type ReactFragment = ReactEmpty | Iterable<ReactNode>

// React 可渲染节点：所有能在 React 中渲染的内容（元素、文本、片段）
export type ReactNode = ReactElement | ReactText | ReactFragment

// React 节点列表：可作为 children 传入的任意内容
export type ReactNodeList = ReactEmpty | ReactNode
