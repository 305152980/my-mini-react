import { type EventPriority } from '../src/ReactEventPriorities'

declare module 'ReactFiberHostConfig' {
  export type Type = string
  export type Props = {
    [key: string]: any
  }
  /**
   * 判断是否应该将子节点作为文本内容处理
   *
   * @param type - 元素类型（如 'div'、'textarea'）
   * @param props - 元素属性
   * @returns 是否应该将子节点作为文本内容处理
   */
  export function shouldSetTextContent(type: string, props: Props): boolean

  // 挂载容器类型：React 应用挂载的 DOM 根节点。
  // 对应 createRoot(rootNode) 中的 rootNode。
  // export type Container = Element | Document | DocumentFragment
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
  ): HostContext

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
  ): HostContext

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
  ): Instance
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
  ): TextInstance

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
  ): boolean

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
  ): void

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
  ): null | Array<any>

  export const supportsMutation: boolean

  export type UpdatePayload = any[]

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
  export function detachDeletedInstance(node: Instance): void

  export function resetTextContent(domElement: Instance): void

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
  ): void

  export function commitTextUpdate(
    textInstance: TextInstance,
    oldText: string,
    newText: string
  ): void

  export function removeChildFromContainer(
    container: Container,
    child: Instance | TextInstance
  ): void

  export function removeChild(
    parentInstance: Instance,
    child: Instance | TextInstance
  ): void

  export function insertBefore(
    parentInstance: Instance,
    child: Instance | TextInstance,
    beforeChild: Instance | TextInstance
  ): void

  export function appendChild(
    parentInstance: Instance,
    child: Instance | TextInstance
  ): void

  export function insertInContainerBefore(
    container: Container,
    child: Instance | TextInstance,
    beforeChild: Instance | TextInstance
  ): void

  export function appendChildToContainer(
    container: Container,
    child: Instance | TextInstance
  ): void

  /**
   * 获取当前正在执行的本地事件的优先级。
   *
   * 这个函数主要用于在调度更新时，确定当前是否有正在进行的原生事件，
   * 并获取该事件的优先级（例如：点击事件是高优先级，滚动是中优先级）。
   * 如果没有正在处理的事件（例如在微任务或宏任务中触发的更新），
   * 则返回默认优先级。
   */
  export function getCurrentEventPriority(): EventPriority

  export const supportsMicrotasks: boolean

  /**
   * 调度一个微任务（microtask）：
   * - 优先使用标准 queueMicrotask。
   * - 若不可用，则降级到 Promise.then。
   * - 最后 fallback 到 setTimeout。
   */
  export const scheduleMicrotask: ((callback: () => void) => void) | undefined
}
