import type { Fiber } from '@my-mini-react/react-reconciler'
import type {
  Container,
  TextInstance,
  Instance,
  Props,
} from './ReactDOMHostConfig'

const randomKey = Math.random().toString(36).slice(2)

const internalContainerInstanceKey = '__reactContainer$' + randomKey
const internalInstanceKey = '__reactFiber$' + randomKey
const internalPropsKey = '__reactProps$' + randomKey
const internalEventHandlersKey = '__reactEvents$' + randomKey
const internalEventHandlerListenersKey = '__reactListeners$' + randomKey
const internalEventHandlesSetKey = '__reactHandles$' + randomKey

export function markContainerAsRoot(hostRoot: Fiber, node: Container): void {
  ;(node as any)[internalContainerInstanceKey] = hostRoot
}

export function precacheFiberNode(
  hostInst: Fiber,
  node: Instance | TextInstance
): void {
  ;(node as any)[internalInstanceKey] = hostInst
}

export function updateFiberProps(
  node: Instance | TextInstance,
  props: Props
): void {
  ;(node as any)[internalPropsKey] = props
}

/**
 * 根据 DOM 节点获取最近的 Fiber 节点
 *
 * 作用：
 * - 根据 DOM 节点获取最近的 Fiber 节点
 * - 用于事件处理时，找到对应的 Fiber 节点
 *
 * 参数：
 * - targetNode：DOM 节点
 *
 * 返回值：
 * - Fiber 节点或 null
 *
 * 实现：
 * 1. 首先检查目标节点本身是否有 Fiber 节点
 * 2. 如果没有，遍历父节点
 * 3. 检查父节点是否是容器根节点或实例节点
 * 4. 如果是，返回对应的 Fiber 节点
 * 5. 继续向上查找，直到找到或到达根节点
 */
export function getClosestInstanceFromNode(targetNode: Node): null | Fiber {
  // 首先检查目标节点本身是否有 Fiber 节点。
  let targetInst = (targetNode as any)[internalInstanceKey]
  if (targetInst) {
    // 找到了，直接返回。
    return targetInst
  }
  // 如果没有，遍历父节点。
  let parentNode = targetNode.parentNode
  while (parentNode) {
    // 检查父节点是否是容器根节点或实例节点。
    targetInst =
      (parentNode as any)[internalContainerInstanceKey] ||
      (parentNode as any)[internalInstanceKey]
    if (targetInst) {
      // 如果是，返回对应的 Fiber 节点。
      return targetInst
    }
    // 继续向上查找。
    targetNode = parentNode
    parentNode = targetNode.parentNode
  }
  // 没有找到，返回 null。
  return null
}

export function getFiberCurrentPropsFromNode(
  node: Instance | TextInstance
): null | Props {
  return (node as any)[internalPropsKey] || null
}

/**
 * 断开 DOM 节点对 Fiber 的反向引用。
 *
 * 调用时机：detachFiberAfterEffects 中，清理 HostComponent 时调用。
 *
 * 核心职责：
 *   删除 DOM 节点上存储的所有 React 内部属性，
 *   断开 DOM → Fiber 的反向引用，帮助 GC 回收。
 *
 * @param node - 被删除的 DOM 节点
 */
export function detachDeletedInstance(node: Instance): void {
  delete (node as any)[internalInstanceKey]
  delete (node as any)[internalPropsKey]
  delete (node as any)[internalEventHandlersKey]
  delete (node as any)[internalEventHandlerListenersKey]
  delete (node as any)[internalEventHandlesSetKey]
}
