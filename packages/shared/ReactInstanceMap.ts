export function remove(key: any): void {
  key._reactInternals = undefined
}

export function get(key: any): any {
  return key._reactInternals
}

export function has(key: any): boolean {
  return key._reactInternals !== undefined
}

export function set(key: any, value: any): void {
  key._reactInternals = value
}
