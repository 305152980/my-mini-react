import { DOCUMENT_NODE } from '../shared/HTMLNodeType'
import { HTML_NAMESPACE, getIntrinsicNamespace } from '../shared/DOMNamespaces'
import { registrationNameDependencies } from '../events/EventRegistry'
import isCustomComponent from '../shared/isCustomComponent'
import { setValueForStyles } from './CSSPropertyOperations'
import setTextContent from './setTextContent'
import { setValueForProperty } from './DOMPropertyOperations'
import {
  initWrapperState as ReactDOMTextareaInitWrapperState,
  getHostProps as ReactDOMTextareaGetHostProps,
  postMountWrapper as ReactDOMTextareaPostMountWrapper,
} from './ReactDOMTextarea'

const DANGEROUSLY_SET_INNER_HTML = 'dangerouslySetInnerHTML'
const SUPPRESS_CONTENT_EDITABLE_WARNING = 'suppressContentEditableWarning'
const SUPPRESS_HYDRATION_WARNING = 'suppressHydrationWarning'
const AUTOFOCUS = 'autoFocus'
const CHILDREN = 'children'
const STYLE = 'style'
const HTML = '__html'

/**
 * 从根容器元素获取 ownerDocument
 *
 * 作用：
 * - 获取根容器元素的 ownerDocument
 * - 用于创建 DOM 元素
 *
 * 参数：
 * - rootContainerElement：根容器元素（Element、Document 或 DocumentFragment）
 *
 * 返回值：
 * - Document 对象
 */
function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document | DocumentFragment
): Document {
  // 如果是 Document 节点，直接返回。否则返回 ownerDocument。
  return rootContainerElement.nodeType === DOCUMENT_NODE
    ? (rootContainerElement as Document)
    : (rootContainerElement.ownerDocument as Document)
}

/**
 * 创建 DOM 元素
 *
 * 作用：
 * - 创建 DOM 元素
 * - 用于创建原生 DOM 元素
 *
 * 参数：
 * - type：元素类型（如 'div'、'span'）
 * - props：元素属性
 * - rootContainerElement：根容器元素
 * - parentNamespace：父命名空间
 *
 * 返回值：
 * - DOM 元素（Element 类型）
 *
 * 特殊处理：
 * - script 元素：使用 innerHTML 创建，避免安全问题
 * - 自定义元素：使用 is 属性
 * - select 元素：设置 multiple 或 size 属性
 * - 非 HTML 命名空间：使用 createElementNS
 */
export function createElement(
  type: string,
  props: Object,
  rootContainerElement: Element | Document | DocumentFragment,
  parentNamespace: string
): Element {
  // 获取 ownerDocument。
  const ownerDocument: Document =
    getOwnerDocumentFromRootContainer(rootContainerElement)

  let domElement: Element
  let namespaceURI = parentNamespace

  // 如果是 HTML 命名空间，获取内在命名空间。
  if (namespaceURI === HTML_NAMESPACE) {
    namespaceURI = getIntrinsicNamespace(type)
  }

  if (namespaceURI === HTML_NAMESPACE) {
    // HTML 命名空间。

    if (type === 'script') {
      // 特殊处理 script 元素。
      // 使用 innerHTML 创建，避免安全问题。
      const div = ownerDocument.createElement('div')
      div.innerHTML = '<script><' + '/script>'
      const firstChild = div.firstChild as HTMLScriptElement
      domElement = div.removeChild(firstChild)
    } else if (typeof (props as any).is === 'string') {
      // 处理自定义元素。
      // 例如：<button is="my-button">。
      domElement = ownerDocument.createElement(type, { is: (props as any).is })
    } else {
      // 普通元素。
      domElement = ownerDocument.createElement(type)

      if (type === 'select') {
        // 特殊处理 select 元素。
        const node = domElement as HTMLSelectElement
        if ((props as any).multiple) {
          // 如果有 multiple 属性。不需要设置 size 属性。
          node.multiple = true
        } else if ((props as any).size) {
          // 如果没有 multiple 属性。才需要设置 size 属性。
          node.size = (props as any).size
        }
      }
    }
  } else {
    // 非 HTML 命名空间（如 SVG、MathML）。

    // 使用 createElementNS。
    domElement = ownerDocument.createElementNS(namespaceURI, type)
  }

  return domElement
}

/**
 * 创建文本节点
 *
 * 作用：
 * - 创建文本节点
 * - 用于创建文本 DOM 元素
 *
 * 参数：
 * - text：文本内容
 * - rootContainerElement：根容器元素（Element、Document 或 DocumentFragment）
 *
 * 返回值：
 * - 文本节点（Text 类型）
 */
export function createTextNode(
  text: string,
  rootContainerElement: Element | Document | DocumentFragment
): Text {
  // 获取 ownerDocument。创建文本节点。
  return getOwnerDocumentFromRootContainer(rootContainerElement).createTextNode(
    text
  )
}

/**
 * 遍历 props，将属性逐一设置到 DOM 节点上。
 *
 * 调用时机：setInitialProperties 内部调用，负责通用属性的设置。
 * 此时 DOM 节点还在内存中，直接写入是安全的。
 *
 * 处理的属性类型：
 *   - style     → 设置样式
 *   - dangerouslySetInnerHTML → 设置 innerHTML
 *   - children  → 设置文本内容（textarea 除外）
 *   - 事件监听   → onScroll 等不冒泡事件直接注册，其余由事件委托处理
 *   - 其他属性   → className、href、value 等，通过 setValueForProperty 设置
 *
 * 不处理的属性（Noop）：
 *   - suppressContentEditableWarning → 纯 React 内部标记，不写入 DOM
 *   - suppressHydrationWarning       → 纯 React 内部标记，不写入 DOM
 *   - autoFocus                      → 推迟到 commitMount 阶段处理
 *
 * @param tag - 元素标签名
 * @param domElement - DOM 节点
 * @param rootContainerElement - 根容器
 * @param nextProps - 要设置的 props
 * @param isCustomComponentTag - 是否是自定义组件
 */
function setInitialDOMProperties(
  tag: string,
  domElement: Element,
  rootContainerElement: Element | Document | DocumentFragment,
  nextProps: Object,
  isCustomComponentTag: boolean
): void {
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue
    }

    const nextProp = (nextProps as any)[propKey]
    if (propKey === STYLE) {
      // style 属性 → 设置 CSS 样式。
      // 内部会处理 vendor prefix、驼峰转换等。
      setValueForStyles(domElement as HTMLElement | SVGElement, nextProp)
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      // dangerouslySetInnerHTML → 直接设置 innerHTML。
      const nextHtml = nextProp ? nextProp[HTML] : undefined
      if (nextHtml != null) {
        // 这里简化了实现。
        domElement.innerHTML = nextHtml
      }
    } else if (propKey === CHILDREN) {
      // children → 设置文本内容。
      // textarea 的 children 不在此处理（由 postMountWrapper 处理）。
      if (typeof nextProp === 'string') {
        const canSetTextContent = tag !== 'textarea' || nextProp !== ''
        if (canSetTextContent) {
          setTextContent(domElement, nextProp)
        }
      } else if (typeof nextProp === 'number') {
        setTextContent(domElement, '' + nextProp)
      }
    } else if (
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // React 内部标记，不写入 DOM（Noop）。
    } else if (propKey === AUTOFOCUS) {
      // autoFocus 不在此处理，推迟到 commitMount 阶段。
      // 因为 focus() 必须在 DOM 插入文档后才能生效。
    } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      // // TODO: 待实现。
      // // 事件监听属性（onClick、onChange 等）。
      // // React 事件系统采用事件委托，大部分事件在 root 上统一监听。
      // // 只有 onScroll 等不冒泡的事件需要直接绑定到元素上。
      // if (nextProp != null) {
      //   if (propKey === 'onScroll') {
      //     listenToNonDelegatedEvent('scroll', domElement)
      //   }
      // }
      // // 注意：这里不直接 addEventListener。
      // // 事件处理函数由 React 事件委托系统统一管理。
    } else if (nextProp != null) {
      // 其他属性 → className、href、value、id、data-* 等。
      // 通过 setValueForProperty 设置（内部处理 SVG、布尔属性、数值单位等）。
      setValueForProperty(domElement, propKey, nextProp, isCustomComponentTag)
    }
  }
}

/**
 * 设置 DOM 元素的初始属性（初始挂载专用）。
 *
 * 调用时机：completeWork 阶段，由 finalizeInitialChildren 调用。
 * 此时 DOM 节点已在 createInstance 中创建，但尚未插入文档，
 * 可以安全地直接操作 DOM。
 *
 * 核心流程：
 *   1. 根据标签类型注册非委托事件（不冒泡的事件必须直接绑定到元素）
 *   2. 对表单元素初始化 wrapper state 并转换 props
 *   3. setInitialDOMProperties → 设置 class、style、事件监听等通用属性
 *   4. 对表单元素执行后置处理（设置 value/checked，必须在属性之后）
 *
 * @param domElement - 新创建的 DOM 节点
 * @param tag - 元素标签名，如 'div'、'input'
 * @param rawProps - 原始 props
 * @param rootContainerElement - 根容器
 */
export function setInitialProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  rootContainerElement: Element | Document | DocumentFragment
): void {
  // 判断是否是自定义组件（标签名含 '-' 或 is 属性）。
  const isCustomComponentTag = isCustomComponent(tag, rawProps)

  // 第一步：注册非委托事件 & 转换 props。
  // 非委托事件 = 不冒泡的事件（cancel/load/error/invalid/toggle）。
  // 这些事件无法通过事件委托在 root 上监听，必须直接绑定到元素。
  let props: Object
  switch (tag) {
    // TODO: 待实现。
    case 'textarea':
      ReactDOMTextareaInitWrapperState(domElement, rawProps)
      // React 源码不是直接设 textContent，而是通过 getHostProps 转换 props 来实现的。
      // 这样 setInitialDOMProperties 处理时：
      //   value 是 undefined → 不会设 value 属性。
      //   children 有值 → 走 setTextContent(domElement, children) → textarea 显示内容。
      props = ReactDOMTextareaGetHostProps(domElement, rawProps)
      // 待实现。
      break
    default:
      props = rawProps
  }
  // TODO: 待实现。
  // // 校验 props 合法性（如不能同时有 children 和 dangerouslySetInnerHTML）。
  // assertValidProps(tag, props)

  // 第二步：设置通用 DOM 属性。
  // class、style、事件监听、自定义属性等，直接写入 DOM。
  setInitialDOMProperties(
    tag,
    domElement,
    rootContainerElement,
    props,
    isCustomComponentTag
  )

  // TODO: 待实现。
  // 第三步：表单元素后置处理。
  // 必须在 setInitialDOMProperties 之后执行。
  // 因为 input 需要先设置 type，再设置 value（顺序影响浏览器行为）。
  switch (tag) {
    case 'input':
      // 待实现。
      break
    case 'textarea':
      // 待实现。
      ReactDOMTextareaPostMountWrapper(domElement, rawProps)
      break
    case 'option':
      // 待实现。
      break
    case 'select':
      // 待实现。
      break
    default:
      // 待实现。
      break
  }
}

/**
 * 对比新旧 props，计算 DOM 属性差异，返回差异数组。
 *
 * 调用时机：prepareUpdate 内部调用（completeWork 阶段）。
 * 纯计算，不操作 DOM。
 *
 * 返回值格式：
 *   - null → 无差异
 *   - [key1, val1, key2, val2, ...] → 差异数组
 *     值为 null 表示删除该属性
 *     值为 styleUpdates 对象表示样式变更
 *
 * 核心流程：
 *   1. 对表单元素转换 props（受控组件特殊处理）
 *   2. 遍历旧 props → 找出被删除的属性
 *   3. 遍历新 props → 找出新增/变更的属性
 *   4. 合并 style 变更到 styleUpdates
 *
 * diffProperties 的职责：
 *   遍历旧 props → 处理删除（大部分 Noop，交给 reconciler）
 *   遍历新 props → 处理新增/变更（必须记录到 updatePayload）
 *
 * @param domElement - DOM 节点
 * @param tag - 元素标签名
 * @param lastRawProps - 旧 props
 * @param nextRawProps - 新 props
 * @param rootContainerElement - 根容器
 * @returns 差异数组或 null
 */
export function diffProperties(
  domElement: Element,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object,
  rootContainerElement: Element | Document | DocumentFragment
): null | Array<any> {
  let updatePayload: null | Array<any> = null

  // 第一步：根据标签类型转换 props。
  // 表单元素需要特殊处理（受控组件的 value/checked 逻辑）。
  let lastProps: Object
  let nextProps: Object
  switch (tag) {
    case 'input':
      // TODO: 待实现。
      lastProps = lastRawProps
      nextProps = nextRawProps
      updatePayload = []
      break
    case 'select':
      // TODO: 待实现。
      lastProps = lastRawProps
      nextProps = nextRawProps
      updatePayload = []
      break
    case 'textarea':
      // TODO: 待实现。
      lastProps = lastRawProps
      nextProps = nextRawProps
      updatePayload = []
      break
    default:
      lastProps = lastRawProps
      nextProps = nextRawProps
      // TODO: 待实现。
      break
  }
  // TODO: 待实现。
  // assertValidProps(tag, nextProps)

  // 第二步：遍历旧 props，找出被删除的属性。
  let propKey
  let styleName
  let styleUpdates = null
  for (propKey in lastProps) {
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      (lastProps as any)[propKey] == null
    ) {
      // 跳过：新 props 中仍存在、不是自身属性、或值为空。
      continue
    }
    if (propKey === STYLE) {
      // 旧样式全部清空（新样式中没有的）。
      const lastStyle = (lastProps as any)[propKey]
      for (styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {}
          }
          // 空字符串 = 删除该样式。
          ;(styleUpdates as any)[styleName] = ''
        }
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML || propKey === CHILDREN) {
      // 内容属性（innerHTML / children）被删除时，这里不处理。
      // 原因：内容由 Fiber reconciler 的子节点协调机制处理，
      // 当新 props 没有 children/innerHTML 时，reconciler 会自动清空文本子节点。
      // 不需要记录到 updatePayload 中。
    } else if (
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // React 内部标记，不写入 DOM，删除时也无需处理（Noop）。
    } else if (propKey === AUTOFOCUS) {
      // autoFocus 只在初始挂载时生效，更新时删除它无需处理（Noop）。
    } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      // 事件监听被删除（如 onClick 从函数变为 null）。
      // 不需要记录具体的 key/value 到 updatePayload。
      // 只需要标记 updatePayload 不为 null，让 commit 阶段更新 DOM 上的 props 缓存。
      // 事件委托系统会自动通过 props 缓存对比来处理解绑。
      if (!updatePayload) {
        updatePayload = []
      }
    } else {
      // 其他普通属性被删除 → 记录 [key, null]。
      // commit 阶段 setValueForProperty 收到 null 值会调用 removeAttribute。
      ;(updatePayload = updatePayload || []).push(propKey, null)
    }
  }

  // 第三步：遍历新 props，找出新增/变更的属性。
  for (propKey in nextProps) {
    const nextProp = (nextProps as any)[propKey]
    const lastProp = lastProps != null ? (lastProps as any)[propKey] : undefined
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      // 跳过：不是自身属性、值完全相同、或新旧都为空。
      continue
    }
    if (propKey === STYLE) {
      if (lastProp) {
        // 删除旧样式中不再存在的。
        for (styleName in lastProp) {
          if (
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {}
            }
            styleUpdates[styleName] = ''
          }
        }
        // 更新变更的样式。
        for (styleName in nextProp) {
          if (
            nextProp.hasOwnProperty(styleName) &&
            lastProp[styleName] !== nextProp[styleName]
          ) {
            if (!styleUpdates) {
              styleUpdates = {}
            }
            styleUpdates[styleName] = nextProp[styleName]
          }
        }
      } else {
        // 全新样式，直接赋值。
        styleUpdates = nextProp
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      // innerHTML 变更。
      const nextHtml = nextProp ? nextProp[HTML] : undefined
      const lastHtml = lastProp ? lastProp[HTML] : undefined
      if (nextHtml != null && lastHtml !== nextHtml) {
        ;(updatePayload = updatePayload || []).push(propKey, nextHtml)
      }
    } else if (propKey === CHILDREN) {
      // 文本内容变更（仅 string/number 类型）。
      if (typeof nextProp === 'string' || typeof nextProp === 'number') {
        ;(updatePayload = updatePayload || []).push(propKey, '' + nextProp)
      }
      // children 变为元素时不在此处理，由 Fiber reconciler 子节点协调。
    } else if (
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // React 内部标记（Noop）。
    } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      // TODO: 待实现。
      // // React 事件系统采用事件委托，大部分事件在 root 上统一监听。
      // // 只有 onScroll 等不冒泡的事件需要直接绑定到元素上。
      // if (nextProp != null) {
      //   if (propKey === 'onScroll') {
      //     listenToNonDelegatedEvent('scroll', domElement)
      //   }
      // }
      // 事件监听变更。
      // 不直接 addEventListener，事件委托系统统一处理。
      // 只标记 updatePayload 不为 null，让 commit 阶段更新 Fiber props 绑定。
      if (!updatePayload && lastProp !== nextProp) {
        updatePayload = []
      }
    } else {
      // 其他普通属性新增/变更 → 记录 [key, value]。
      ;(updatePayload = updatePayload || []).push(propKey, nextProp)
    }
  }

  // 第四步：合并 style 变更到 updatePayload。
  if (styleUpdates) {
    // styleUpdates 在整个 diff 过程中累积所有样式变更。
    // 最后统一推进 payload，commit 阶段一次性调用 setValueForStyles。
    ;(updatePayload = updatePayload || []).push(STYLE, styleUpdates)
  }

  return updatePayload
}

/**
 * 更新 DOM 节点的属性。
 *
 * 调用时机：commitUpdate 内部，处理 HostComponent 的属性更新时调用。
 *
 * 核心职责：
 *   1. 处理特殊元素（input radio 的 checked 属性）。
 *   2. 调用 updateDOMProperties 执行通用属性更新。
 *   3. 处理表单元素的后更新逻辑（input/textarea/select）。
 *
 * @param domElement - DOM 节点
 * @param updatePayload - 差异数组 [key1, val1, key2, val2, ...]
 * @param tag - 标签名（如 'div'、'input'）
 * @param lastRawProps - 旧 props
 * @param nextRawProps - 新 props
 */
export function updateProperties(
  domElement: Element,
  updatePayload: Array<any>,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object
): void {
  // TODO: 待实现。
  // // 1. 特殊处理：input radio 的 checked 属性。
  // // radio 按钮的 checked 属性需要在更新前处理，避免与其他 radio 冲突。
  // if (
  //   tag === 'input' &&
  //   (nextRawProps as any).type === 'radio' &&
  //   (nextRawProps as any).name != null
  // ) {
  //   ReactDOMInputUpdateChecked(domElement, nextRawProps)
  // }

  // 2. 通用属性更新。
  const wasCustomComponentTag = isCustomComponent(tag, lastRawProps)
  const isCustomComponentTag = isCustomComponent(tag, nextRawProps)
  // 执行属性更新（遍历 updatePayload，应用每个变更）。
  updateDOMProperties(
    domElement,
    updatePayload,
    wasCustomComponentTag,
    isCustomComponentTag
  )

  // TODO: 待实现。
  // // 3. 表单元素后更新处理。
  // // 这些处理需要在属性更新之后执行。
  // switch (tag) {
  //   case 'input':
  //     // 更新 input 的 value、checked 等受控属性。
  //     ReactDOMInputUpdateWrapper(domElement, nextRawProps)
  //     break
  //   case 'textarea':
  //     // 更新 textarea 的 value。
  //     ReactDOMTextareaUpdateWrapper(domElement, nextRawProps)
  //     break
  //   case 'select':
  //     // 更新 select 的 value（多选情况）。
  //     ReactDOMSelectPostUpdateWrapper(domElement, nextRawProps)
  //     break
  // }
}

/**
 * 遍历差异数组，更新 DOM 属性。
 *
 * 调用时机：updateProperties 内部，处理通用属性更新时调用。
 *
 * 核心职责：
 *   遍历 updatePayload 数组，根据属性类型分发到不同的处理函数。
 *
 * updatePayload 格式：[key1, val1, key2, val2, ...]
 *   - 偶数索引：属性名
 *   - 奇数索引：属性值（null 表示删除）
 *
 * @param domElement - DOM 节点
 * @param updatePayload - 差异数组
 * @param wasCustomComponentTag - 旧的是否是自定义组件
 * @param isCustomComponentTag - 新的是否是自定义组件
 */
function updateDOMProperties(
  domElement: Element,
  updatePayload: Array<any>,
  wasCustomComponentTag: boolean,
  isCustomComponentTag: boolean
): void {
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i]
    const propValue = updatePayload[i + 1]
    if (propKey === STYLE) {
      setValueForStyles(domElement as HTMLElement | SVGElement, propValue)
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      // TODO: 待实现。
      // setInnerHTML(domElement, propValue)
    } else if (propKey === CHILDREN) {
      setTextContent(domElement, propValue)
    } else {
      setValueForProperty(domElement, propKey, propValue, isCustomComponentTag)
    }
  }
}
