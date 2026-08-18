// React 元素类型（虚拟DOM节点）。
// 由 React.createElement / jsx 编译后生成。
export type ReactElement = {
  // 标识对象是 ReactElement 的唯一内部标记（防XSS）。
  $$typeof: any

  // 元素类型：字符串(div/span) 或 函数组件/类组件。
  type: any

  // 列表渲染的 key，用于 diff 优化。
  key: any

  // 引用真实 DOM 或组件实例的 ref 对象。
  ref: any

  // 组件/元素接收的属性对象（children、className、onClick 等）。
  props: any

  // 待更新的新属性（Reconciler 协调阶段使用）。
  pendingProps: any

  // 内部属性：创建此元素的组件所有者（React 内部使用）。
  _owner: any

  [key: string]: any
}

export type React$Node =
  // | React$Element<any> // React 元素（如 <div />, <Component />）。
  | ReactElement // React 元素（如 <div />, <Component />）。
  // | ReactPortal // Portal（ReactDOM.createPortal）。
  | string // 文本节点。
  | number // 数字文本。
  | null // null。
  | void // undefined。
  | boolean // boolean。
  | ReactFragment // Fragment（<>...</>）。
  | ReactProvider<any> // Context Provider。
  | ReactConsumer<any> // Context Consumer。

// React 可渲染节点：所有能在 React 中渲染的内容（元素、文本、片段）。
export type ReactNode =
  // | React$Element<any>
  | ReactElement
  // | ReactPortal
  | ReactText
  | ReactFragment
  | ReactProvider<any>
  | ReactConsumer<any>

// React 空类型：null / undefined / 布尔值（均不渲染）。
export type ReactEmpty = null | void | boolean

// React 片段类型：可迭代的 ReactNode（用于 <></> 等片段容器）。
// export type ReactFragment = ReactEmpty | Iterable<ReactNode>
export type ReactFragment = ReactEmpty | Iterable<ReactNode>

// React 节点列表：可作为 children 传入的任意内容。
// export type ReactNodeList = ReactEmpty | React$Node
export type ReactNodeList = ReactEmpty | ReactNode

// React 文本类型：字符串 / 数字。
export type ReactText = string | number

export type ReactProvider<T> = {
  $$typeof: Symbol | number
  type: ReactProviderType<T>
  key: null | string
  ref: null
  props: {
    value: T
    children?: ReactNodeList
    [key: string]: any
  }
  [key: string]: any
}

export type ReactProviderType<T> = {
  $$typeof: symbol | number
  _context: ReactContext<T>
  [key: string]: any
}

export type ReactConsumer<T> = {
  $$typeof: Symbol | number
  type: ReactContext<T>
  key: null | string
  ref: null
  props: {
    children: (value: T) => ReactNodeList
    [key: string]: any
  }
  [key: string]: any
}

export type ReactContext<T> = {
  $$typeof: Symbol | number
  Consumer: ReactContext<T>
  Provider: ReactProviderType<T>
  _currentValue: T

  _currentValue2: T
  _threadCount: number

  [key: string]: any
}
