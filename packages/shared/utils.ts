export function getCurrentTime(): number {
  return performance.now()
}

export function isArray(sth: any): boolean {
  return Array.isArray(sth)
}

export function isNum(sth: any): boolean {
  return typeof sth === 'number'
}

export function isObject(sth: any): boolean {
  return typeof sth === 'object'
}

export function isFn(sth: any): boolean {
  return typeof sth === 'function'
}

export function isStr(sth: any): boolean {
  return typeof sth === 'string'
}
