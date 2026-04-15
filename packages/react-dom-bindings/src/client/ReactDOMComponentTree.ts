import type { Fiber } from '@my-mini-react/react-reconciler'

const randomKey = Math.random().toString(36).slice(2)
const internalInstanceKey = '__reactFiber$' + randomKey
const internalPropsKey = '__reactProps$' + randomKey

export function precacheFiberNode(hostInst: Fiber, node: Element | Text): void {
  ;(node as any)[internalInstanceKey] = hostInst
}
export function getClosestInstanceFromNode(targetNode: Node): null | Fiber {
  let targetInst = (targetNode as any)[internalInstanceKey]
  if (targetInst) {
    return targetInst
  }
  return null
}

export function getFiberCurrentPropsFromNode(node: Element | Text): null | any {
  return (node as any)[internalPropsKey] || null
}

export function updateFiberProps(node: Element | Text, props: any): void {
  ;(node as any)[internalPropsKey] = props
}
