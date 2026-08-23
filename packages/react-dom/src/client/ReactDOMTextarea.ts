import { type ToStringValue, getToStringValue, toString } from './ToStringValue'
import { isArray } from '@my-mini-react/shared/utils'

// 扩展 HTMLTextAreaElement，附加 React 内部使用的 _wrapperState 字段。
type TextAreaWithWrapperState = HTMLTextAreaElement & {
  _wrapperState: {
    initialValue: ToStringValue
  }
}

/**
 * textarea 的初始化前置处理。
 *
 * 调用时机：setInitialProperties 的第一个 switch (tag) 中，在 setInitialDOMProperties 设置通用属性之前执行。
 *
 * 核心职责：计算 textarea 的初始值，保存到 _wrapperState.initialValue 中。
 *   后续 getHostProps 和 postMountWrapper 都会读取这个值。
 *
 * 初始值的优先级：
 *   1. props.value（受控组件）。
 *   2. props.defaultValue（非受控组件的默认值）。
 *   3. props.children（等价于 defaultValue）。
 *   4. 空字符串（兜底）。
 */
export function initWrapperState(element: Element, props: Object): void {
  const node = element as TextAreaWithWrapperState

  let initialValue = (props as any).value
  if (initialValue == null) {
    let { children, defaultValue } = props as any
    if (children != null) {
      if (defaultValue != null) {
        throw new Error(
          'If you supply `defaultValue` on a <textarea>, do not pass children.'
        )
      }
      if (isArray(children)) {
        if (children.length > 1) {
          throw new Error('<textarea> can only have at most one child.')
        }
        children = children[0]
      }
      defaultValue = children
    }
    if (defaultValue == null) {
      defaultValue = ''
    }
    initialValue = defaultValue
  }

  node._wrapperState = {
    initialValue: getToStringValue(initialValue),
  }
}

/**
 * textarea 的 props 转换。
 *
 * 调用时机：setInitialProperties 的第一个 switch (tag) 中，initWrapperState 之后、setInitialDOMProperties 之前执行。
 *
 * 核心职责：将原始 props 转换为 setInitialDOMProperties 能正确处理的格式。
 *   关键操作：把 value 转为 children，让 textarea 通过 textContent 显示初始值。
 */
export function getHostProps(element: Element, props: Object): Object {
  const node = element as TextAreaWithWrapperState

  if ((props as any).dangerouslySetInnerHTML != null) {
    throw new Error(
      '`dangerouslySetInnerHTML` does not make sense on <textarea>.'
    )
  }

  const hostProps = {
    ...props,
    value: undefined,
    defaultValue: undefined,
    children: toString(node._wrapperState.initialValue),
  }

  return hostProps
}

/**
 * textarea 挂载后的后置处理。
 *
 * 调用时机：setInitialProperties 的 switch (tag) 中，在 setInitialDOMProperties 设置完通用属性之后执行。
 *
 * 核心目的：将 textarea 的初始值同步到 DOM 的 value 属性上。
 *   textarea 的显示内容由 textContent 决定，但 React 需要确保DOM 的 value 属性也与初始值一致（受控组件需要）。
 */
export function postMountWrapper(element: Element, props: Object): void {
  const node = element as TextAreaWithWrapperState
  // 获取 textarea 当前的文本内容（在 setInitialDOMProperties 中已设置）。
  const textContent = node.textContent

  // 防御性校验：只有当 textContent 与初始化时记录的 initialValue 一致时才处理。
  // 这是为了应对 Edge 浏览器的一个 bug（见上方链接），在某些情况下 Edge 会错误地修改 textarea 的 textContent。
  // https://developer.microsoft.com/microsoft-edge/platform/issues/101525/
  if (textContent === node._wrapperState.initialValue) {
    // 只有非空文本才需要同步到 value 属性。
    if (textContent !== '' && textContent !== null) {
      node.value = textContent
    }
  }
}
