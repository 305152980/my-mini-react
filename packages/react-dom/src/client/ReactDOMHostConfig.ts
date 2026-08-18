import {
  DOCUMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
  COMMENT_NODE,
} from '../shared/HTMLNodeType'
import { getChildNamespace } from '../shared/DOMNamespaces'
import {
  createElement,
  createTextNode,
  setInitialProperties,
  diffProperties,
  updateProperties,
} from './ReactDOMComponent'
import { precacheFiberNode, updateFiberProps } from './ReactDOMComponentTree'
import setTextContent from './setTextContent'
import {
  DefaultEventPriority,
  type EventPriority,
  type Fiber,
} from '@my-mini-react/react-reconciler'
import { getEventPriority } from '../events/ReactDOMEventListener'
import { type DOMEventName } from '../events/DOMEventNames'

export type Type = string
export type Props = {
  autoFocus?: boolean
  children?: unknown
  disabled?: boolean
  hidden?: boolean
  suppressHydrationWarning?: boolean
  dangerouslySetInnerHTML?: any
  style?: Record<string, string | number | undefined>
  bottom?: null | number
  left?: null | number
  right?: null | number
  top?: null | number
  [key: string]: any
}
/**
 * 判断是否应该将子节点作为文本内容处理
 *
 * @param type - 元素类型（如 'div'、'textarea'）
 * @param props - 元素属性
 * @returns 是否应该将子节点作为文本内容处理
 */
export function shouldSetTextContent(type: string, props: Props): boolean {
  return (
    type === 'textarea' ||
    type === 'noscript' ||
    typeof props.children === 'string' ||
    typeof props.children === 'number' ||
    (typeof props.dangerouslySetInnerHTML === 'object' &&
      props.dangerouslySetInnerHTML !== null &&
      (props.dangerouslySetInnerHTML as { __html: any })?.__html != null)
  )
}

// Container 是 React 渲染的目标容器。
// 可以是普通的 DOM 元素、Document 对象或 DocumentFragment。
// 并且都扩展了任意属性（用于存储 React 内部状态）。
export type Container =
  | (Element & { [key: string]: any })
  | (Document & { [key: string]: any })
  | (DocumentFragment & { [key: string]: any })
export type Instance = Element
export type TextInstance = Text

// 开发环境的 HostContext。
type HostContextDev = {
  namespace: string // 命名空间（如 'http://www.w3.org/2000/svg'）。
  ancestorInfo: any // 祖先信息（用于验证 HTML 嵌套规则）。
  [key: string]: any
}
// 生产环境的 HostContext。
type HostContextProd = string // 只有命名空间。
// HostContext 可以是开发环境或生产环境的类型。
export type HostContext = HostContextDev | HostContextProd

/**
 * 获取根容器的宿主上下文（暂时只支持生产环境）
 *
 * 作用：
 * - 根据根容器类型获取命名空间（namespace）
 * - 用于区分 HTML、SVG、MathML 等不同的文档类型
 * - 在创建 DOM 元素时使用正确的命名空间
 *
 * 返回值：
 * - 开发环境：返回 {namespace, ancestorInfo} 对象
 * - 生产环境：只返回 namespace 字符串（性能优化）
 *
 * @param rootContainerInstance - 根容器实例（如 document.getElementById('root')）
 * @returns 宿主上下文（HostContext）
 */
export function getRootHostContext(
  rootContainerInstance: Container
): HostContext {
  let type
  let namespace

  // 获取节点类型。
  const nodeType = rootContainerInstance.nodeType
  // 根据节点类型获取命名空间。
  switch (nodeType) {
    // 文档节点（document）或文档片段（DocumentFragment）。
    case DOCUMENT_NODE:
    case DOCUMENT_FRAGMENT_NODE: {
      // 获取类型名称。
      type = nodeType === DOCUMENT_NODE ? '#document' : '#fragment'
      // 获取文档根元素（<html>）。
      const root = (rootContainerInstance as any).documentElement
      // 获取命名空间。
      //   如果有根元素，使用根元素的命名空间。
      //   否则使用默认的 HTML 命名空间。
      namespace = root ? root.namespaceURI : getChildNamespace(null, '')
      break
    }
    // 普通元素（如 div、span 等）。
    default: {
      // 如果是注释节点，获取父节点。否则使用当前节点。（注释节点没有 tagName 和 namespaceURI。）（在正常使用中，container 不会为空。）
      const container: any =
        nodeType === COMMENT_NODE
          ? rootContainerInstance.parentNode
          : rootContainerInstance
      // 获取容器自身的命名空间。
      const ownNamespace = container.namespaceURI || null
      // 获取标签名。
      type = container.tagName
      // 根据父命名空间和标签名获取子命名空间。
      namespace = getChildNamespace(ownNamespace, type)
      break
    }
  }

  // 返回命名空间。
  return namespace
}

/**
 * 获取子元素的宿主上下文
 *
 * 作用：
 * - 根据父元素的上下文和当前元素类型，计算子元素的上下文
 * - 主要用于计算命名空间（namespace）
 * - 开发环境还会更新祖先信息（用于验证 HTML 嵌套规则）（暂时只支持生产环境）
 *
 * @param parentHostContext - 父元素的宿主上下文
 * @param type - 当前元素类型（如 'div'、'svg'）
 * @param rootContainerInstance - 根容器实例（未使用）
 * @returns 子元素的宿主上下文
 */
export function getChildHostContext(
  parentHostContext: HostContext,
  type: string,
  rootContainerInstance: Container
): HostContext {
  const parentNamespace = parentHostContext as HostContextProd
  return getChildNamespace(parentNamespace, type)
}

/**
 * 创建原生 DOM 元素实例（初始挂载阶段）。
 *
 * 调用时机：completeWork 阶段，当 HostComponent 没有 alternate（首次挂载）时调用，
 * 负责创建真实的 DOM 节点并建立 Fiber ↔ DOM 的双向绑定。
 *
 * 核心流程：
 *   1. createElement  → 创建 DOM 节点并设置初始属性
 *   2. precacheFiberNode → DOM 上缓存 Fiber 引用（DOM → Fiber）
 *   3. updateFiberProps  → DOM 上缓存最新 props（事件系统用）
 *
 * 注意：此时 DOM 节点还在内存中，尚未插入文档。
 *
 * @param type - 元素类型，如 'div'、'span'
 * @param props - 元素属性
 * @param rootContainerInstance - 根容器实例
 * @param hostContext - Host 上下文（包含命名空间信息，如 SVG / HTML）
 * @param internalInstanceHandle - 对应的 Fiber 节点
 * @returns 创建好的 DOM 实例
 */
export function createInstance(
  type: string,
  props: Props,
  rootContainerInstance: Container,
  hostContext: HostContext,
  internalInstanceHandle: Object
): Instance {
  // 从 hostContext 取出父级命名空间（用于 SVG / MathML 等）。
  const parentNamespace: string = hostContext as HostContextProd
  // 创建 DOM 节点，设置初始属性（class、style、事件监听等）。
  const domElement: Instance = createElement(
    type,
    props,
    rootContainerInstance,
    parentNamespace
  )
  // 在 DOM 节点上缓存 Fiber 引用。
  //    底层：domElement.__reactFiber$xxxxx = fiber。
  //    用途：事件触发时，从 DOM 反向找到对应的 Fiber 节点。
  precacheFiberNode(internalInstanceHandle as Fiber, domElement)
  // 在 DOM 节点上缓存最新 props。
  //    底层：domElement.__reactProps$xxxxx = props。
  //    用途：事件系统读取最新的 onClick 等处理函数。
  updateFiberProps(domElement, props)
  // 返回 DOM 元素。
  return domElement
}

/**
 * 创建文本节点实例（初始挂载阶段）。
 *
 * 调用时机：completeWork 阶段，当 HostText 没有 alternate（首次挂载）时调用，
 * 负责创建真实的文本 DOM 节点并建立 Fiber → DOM 的反向绑定。
 *
 * 与 createInstance 的区别：
 *   - 文本节点没有 props，不需要调用 updateFiberProps
 *   - 文本节点没有属性/样式/事件，逻辑更简单
 *
 * @param text - 文本内容
 * @param rootContainerInstance - 根容器实例
 * @param hostContext - Host 上下文（文本节点用于 DEV 模式下的 DOM 嵌套校验）
 * @param internalInstanceHandle - 对应的 Fiber 节点
 * @returns 创建好的文本 DOM 节点
 */
export function createTextInstance(
  text: string,
  rootContainerInstance: Container,
  hostContext: HostContext,
  internalInstanceHandle: Object
): TextInstance {
  // 创建真实的文本 DOM 节点（document.createTextNode）。
  const textNode: TextInstance = createTextNode(text, rootContainerInstance)
  // 在文本节点上缓存 Fiber 引用。
  // 底层：textNode.__reactFiber$xxxxx = fiber。
  // 用途：事件触发时，从文本节点反向找到对应的 Fiber。
  precacheFiberNode(internalInstanceHandle as Fiber, textNode)
  // 返回文本节点。
  return textNode
}

/**
 * 完成 DOM 元素的初始属性设置，并判断是否需要额外的挂载后操作。
 *
 * 调用时机：completeWork 阶段，createInstance 创建 DOM 节点后调用。
 *
 * 核心职责：
 *   1. setInitialProperties → 设置 DOM 的初始属性（class、style、事件等）
 *   2. 返回是否需要 commitMount 执行挂载后操作（如 autoFocus）
 *
 * 返回值含义：
 *   - true  → 需要 commitMount（completeWork 中会标记 markUpdate）
 *   - false → 不需要额外操作
 *
 * 为什么 autoFocus 需要推迟到 commit 阶段？
 *   因为 focus() 必须在 DOM 节点插入文档后才能生效，
 *   而 completeWork 阶段 DOM 还在内存中，尚未挂载到页面。
 *
 * @param domElement - 新创建的 DOM 节点
 * @param type - 元素类型，如 'div'、'input'
 * @param props - 元素属性
 * @param rootContainerInstance - 根容器实例
 * @param hostContext - Host 上下文（命名空间信息）
 * @returns 是否需要执行 commitMount
 */
export function finalizeInitialChildren(
  domElement: Instance,
  type: string,
  props: Props,
  rootContainerInstance: Container,
  hostContext: HostContext
): boolean {
  // 设置 DOM 的初始属性（class、style、事件监听、表单状态等）。
  // 此时 DOM 还在内存中，直接设置是安全的。
  setInitialProperties(domElement, type, props, rootContainerInstance)
  // 判断是否需要 commitMount（挂载后操作）。
  switch (type) {
    case 'button':
    case 'input':
    case 'select':
    case 'textarea':
      // 表单元素：有 autoFocus 时需要 commitMount 调用 focus()。
      return !!props.autoFocus
    case 'img':
      // img 始终返回 true，commitMount 中处理 src 的加载时机。
      return true
    default:
      // 其他元素不需要额外操作。
      return false
  }
}

/**
 * 将子 DOM 节点追加到父 DOM 节点上（初始挂载专用）。
 *
 * 调用时机：completeWork 阶段，appendAllChildren 内部调用。
 * 此时所有 DOM 节点还在内存中，尚未插入文档。
 *
 * 本质就是对原生 DOM API 的薄封装。
 *
 * @param parentInstance - 父 DOM 节点
 * @param child - 子 DOM 节点（元素节点或文本节点）
 */
export function appendInitialChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.appendChild(child)
}

/**
 * 对比新旧 props，计算 DOM 属性差异。
 *
 * 调用时机：completeWork 阶段，updateHostComponent 内部调用。
 * 纯计算，不操作 DOM。
 *
 * 返回值：
 *   - null → 无差异，无需更新
 *   - Array → 差异数组 [key1, val1, key2, val2, ...]
 *     供 commit 阶段的 commitUpdate → updateProperties 消费
 *
 * @param domElement - 真实 DOM 节点
 * @param type - 元素标签名，如 'div'
 * @param oldProps - 旧 props
 * @param newProps - 新 props
 * @param rootContainerInstance - 根容器
 * @param hostContext - Host 上下文（命名空间信息）
 * @returns 差异数组或 null
 */
export function prepareUpdate(
  domElement: Instance,
  type: string,
  oldProps: Props,
  newProps: Props,
  rootContainerInstance: Container,
  hostContext: HostContext
): null | Array<any> {
  // diffProperties 遍历新旧 props，找出所有变更项。
  // 返回 [key1, val1, key2, val2, ...] 格式的差异数组。
  return diffProperties(
    domElement,
    type,
    oldProps,
    newProps,
    rootContainerInstance
  )
}

export const supportsMutation = true

export type UpdatePayload = any[]

export { detachDeletedInstance } from './ReactDOMComponentTree'

export function resetTextContent(domElement: Instance): void {
  setTextContent(domElement, '')
}

/**
 * 提交 DOM 属性更新。
 *
 * 调用时机：commitMutationEffectsOnFiber 中，处理 HostComponent 的 Update 标志时调用。
 *
 * 核心职责：
 *   1. 调用 updateProperties 更新 DOM 属性。
 *   2. 调用 updateFiberProps 同步 Fiber props 到 DOM（用于事件系统）。
 *
 * @param domElement - DOM 节点
 * @param updatePayload - 差异数组 [key1, val1, key2, val2, ...]
 * @param type - 标签名（如 'div'）
 * @param oldProps - 旧 props
 * @param newProps - 新 props
 * @param internalInstanceHandle - Fiber 实例（内部使用）
 */
export function commitUpdate(
  domElement: Instance,
  updatePayload: Array<any>,
  type: string,
  oldProps: Props,
  newProps: Props,
  internalInstanceHandle: Object
): void {
  updateProperties(domElement, updatePayload, type, oldProps, newProps)
  updateFiberProps(domElement, newProps)
}

export function commitTextUpdate(
  textInstance: TextInstance,
  oldText: string,
  newText: string
): void {
  textInstance.nodeValue = newText
}

export function removeChildFromContainer(
  container: Container,
  child: Instance | TextInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    // 容器是注释节点。
    ;(container.parentNode as any).removeChild(child)
  } else {
    // 容器是普通元素节点。
    container.removeChild(child)
  }
}

export function removeChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.removeChild(child)
}

export function insertBefore(
  parentInstance: Instance,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance
): void {
  parentInstance.insertBefore(child, beforeChild)
}

export function appendChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.appendChild(child)
}

export function insertInContainerBefore(
  container: Container,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    ;(container.parentNode as any).insertBefore(child, beforeChild)
  } else {
    container.insertBefore(child, beforeChild)
  }
}

export function appendChildToContainer(
  container: Container,
  child: Instance | TextInstance
): void {
  let parentNode
  if (container.nodeType === COMMENT_NODE) {
    parentNode = container.parentNode as any
    // 插入到注释节点之前。
    parentNode.insertBefore(child, container)
  } else {
    parentNode = container
    // 追加到容器末尾。
    parentNode.appendChild(child)
  }

  // TODO: 暂不考虑。
  // const reactRootContainer = container._reactRootContainer
  // if (
  //   (reactRootContainer === null || reactRootContainer === undefined) &&
  //   parentNode.onclick === null
  // ) {
  //   trapClickOnNonInteractiveElement(parentNode as HTMLElement)
  // }
}

/**
 * 获取当前正在执行的本地事件的优先级。
 *
 * 这个函数主要用于在调度更新时，确定当前是否有正在进行的原生事件，
 * 并获取该事件的优先级（例如：点击事件是高优先级，滚动是中优先级）。
 * 如果没有正在处理的事件（例如在微任务或宏任务中触发的更新），
 * 则返回默认优先级。
 */
export function getCurrentEventPriority(): EventPriority {
  // 获取当前全局上下文中的原生事件对象（例如 click, input, scroll 等）
  // window.event 是一个非标准的全局属性，它只有在浏览器正在执行一个原生 DOM 事件处理函数（Event Handler）的过程中才会有值。
  // 简单来说，它的生命周期严格绑定在“事件触发的同步执行流”中。
  const currentEvent = window.event

  if (currentEvent === undefined) {
    // 如果当前不在任何原生事件的处理函数中（例如在 setTimeout 或 Promise 回调中），
    // window.event 会是 undefined，此时返回默认优先级。
    return DefaultEventPriority
  }
  // 如果存在原生事件，根据事件类型（如 'click', 'scroll'）
  // 查询并返回对应的 React 内部优先级（如 DiscreteEventPriority 或 ContinuousEventPriority）
  return getEventPriority(currentEvent.type as DOMEventName)
}

export const supportsMicrotasks = true

const localPromise = typeof Promise === 'function' ? Promise : undefined
const scheduleTimeout =
  typeof setTimeout === 'function' ? setTimeout : undefined
function handleErrorInNextTick(error: unknown): void {
  setTimeout(() => {
    throw error
  })
}
/**
 * 调度一个微任务（microtask）：
 * - 优先使用标准 queueMicrotask。
 * - 若不可用，则降级到 Promise.then。
 * - 最后 fallback 到 setTimeout。
 */
export const scheduleMicrotask: ((callback: () => void) => void) | undefined =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof localPromise !== 'undefined'
      ? (callback: () => void) =>
          localPromise.resolve(null).then(callback).catch(handleErrorInNextTick)
      : (scheduleTimeout as ((callback: () => void) => void) | undefined)
