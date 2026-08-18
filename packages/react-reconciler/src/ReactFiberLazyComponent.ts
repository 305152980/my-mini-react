import assign from '@my-mini-react/shared/assign'

/**
 * 解析组件的 defaultProps
 * @param Component - React 组件类型
 * @param baseProps - 传入的基础 props
 */
export function resolveDefaultProps<P extends Record<string, any>>(
  Component: any,
  baseProps: P
): P {
  if (Component && Component.defaultProps) {
    const props = assign({}, baseProps)

    const defaultProps = Component.defaultProps as Partial<P>

    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName]!
      }
    }
    return props
  }

  return baseProps
}
