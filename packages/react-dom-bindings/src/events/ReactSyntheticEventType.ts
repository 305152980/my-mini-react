import { type Fiber } from '@my-mini-react/react-reconciler'

/**
 * 基础的合成事件类型，是对浏览器原生事件的跨浏览器包装。
 * 它提供了一致的接口，并集成了 React 内部的事件处理机制。
 */
type BaseSyntheticEvent = {
  /**
   * 判断事件对象是否被“持久化”。
   * React 为了性能，会使用对象池来复用合成事件对象。
   * 事件处理函数执行完毕后，事件对象会被释放并重置。
   * 如果需要在异步代码中访问事件属性，可以调用 event.persist() 方法，
   * 该方法会将此标志设为 true，从而将事件对象从对象池中移除，防止被重置。
   */
  isPersistent: () => boolean
  /**
   * 判断是否已调用过 event.stopPropagation() 方法。
   * 用于阻止事件在 React 应用内部的进一步传播（捕获或冒泡）。
   */
  isPropagationStopped: () => boolean
  /**
   * 指向与当前事件处理器关联的 React 内部 Fiber 节点。
   * Fiber 是 React 16+ 引入的核心数据结构，代表一个组件实例或一个 DOM 节点。
   * 通过这个属性，React 可以从事件目标向上遍历组件树，以执行事件冒泡或捕获。
   */
  _targetInst: Fiber
  /**
   * 原始的浏览器事件对象。
   * 合成事件是对原生事件的封装，所有原生事件的属性和方法都可以通过这个属性访问。
   * 当需要访问 React 合成事件未提供的底层浏览器 API 时，可以使用它。
   */
  nativeEvent: Event
  /**
   * 触发事件的 DOM 元素。
   * 它直接引用原生的事件目标，是事件流的最末端节点。
   */
  // 触发事件的原始 DOM 元素。
  target?: any
  /**
   * 与事件相关的另一个 DOM 元素。
   * 主要用于如 `onMouseEnter`、`onMouseLeave` 等事件，表示鼠标移入或移出的那个元素。
   */
  relatedTarget?: any
  /**
   * 事件的类型字符串，例如 'click'、'change'、'keydown' 等。
   */
  type: string
  /**
   * 当前正在执行事件处理器的 DOM 元素。
   * 在事件冒泡或捕获的过程中，`currentTarget` 会指向当前绑定事件监听器的那个元素。
   * 它与 `this` 在事件处理函数中的值相同。
   */
  // 当前正在执行事件处理函数的 DOM 元素。
  currentTarget: null | EventTarget
}

export type KnownReactSyntheticEvent = BaseSyntheticEvent & {
  _reactName: string
}

export type UnknownReactSyntheticEvent = BaseSyntheticEvent & {
  _reactName: null
}

export type ReactSyntheticEvent =
  | KnownReactSyntheticEvent
  | UnknownReactSyntheticEvent
