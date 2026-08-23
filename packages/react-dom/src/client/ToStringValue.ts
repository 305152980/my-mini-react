export type ToStringValue = boolean | number | object | string | null

export function toString(value: ToStringValue): string {
  return '' + value
}

export function getToStringValue(value: unknown): ToStringValue {
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'undefined':
      return value as ToStringValue
    case 'object':
      return value
    default:
      // function, symbol are assigned as empty strings.
      return ''
  }
}
