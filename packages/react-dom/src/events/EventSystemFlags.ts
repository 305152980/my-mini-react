// 定义 EventSystemFlags 的类型为数字。
// 它用于存储一组二进制标志，通过位运算来控制事件系统的行为。
export type EventSystemFlags = number

/**
 * 标志位 1 (二进制: 00001)
 * 表示事件处理器是附加在非受管节点（Non-managed Node）上的。
 * 通常 React 会将事件绑定在根节点（Container），但如果用户手动在普通 DOM 节点上添加 React 事件，
 * 或者在某些边缘情况下，就会用到这个标志。
 */
export const IS_EVENT_HANDLE_NON_MANAGED_NODE = 1

/**
 * 标志位 2 (二进制: 00010)
 * 表示该事件**不使用**事件委托机制。
 * 默认情况下，React 使用事件委托（将所有事件绑定在 root 上）。
 * 如果设置了此标志，React 会直接将事件监听器绑定在具体的 DOM 元素上。
 * 这通常用于 `onScroll` 或 `onLoad` 等不冒泡或需要精确目标的事件。
 * 计算方式：1 << 1 即 2 的 1 次方，等于 2。
 */
export const IS_NON_DELEGATED = 1 << 1

/**
 * 标志位 3 (二进制: 00100)
 * 表示事件处于**捕获阶段**（Capture Phase）。
 * 对应 React 的 `onClickCapture` 这类事件属性。
 * 计算方式：1 << 2 即 2 的 2 次方，等于 4。
 */
export const IS_CAPTURE_PHASE = 1 << 2

/**
 * 标志位 4 (二进制: 01000)
 * 表示事件监听器是**被动监听器**（Passive Listener）。
 * 对应原生的 `{ passive: true }` 选项，主要用于优化滚动性能，表明监听器不会调用 `preventDefault()`。
 * 计算方式：1 << 3 即 2 的 3 次方，等于 8。
 */
export const IS_PASSIVE = 1 << 3

/**
 * 标志位 5 (二进制: 10000)
 * 用于支持 Facebook 内部的旧版遗留模式（Legacy FB Support Mode）。
 * 这是一个特定于内部使用的标志，用于兼容旧的内部事件处理逻辑。
 * 计算方式：1 << 4 即 2 的 4 次方，等于 16。
 */
export const IS_LEGACY_FB_SUPPORT_MODE = 1 << 4

/**
 * 组合标志：用于处理 Facebook 内部兼容模式下的点击延迟问题。
 * 通过位运算（按位或 |）将两个标志合并。
 * 如果当前事件的 flags 包含这两个标志，React 就不会为了兼容旧模式而延迟点击事件的处理。
 */
export const SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE =
  IS_LEGACY_FB_SUPPORT_MODE | IS_CAPTURE_PHASE

/**
 * 组合标志：用于判断是否应该跳过某些 Polyfill 事件插件的处理。
 * 如果事件满足以下任一条件，则不需要经过复杂的 Polyfill 逻辑：
 * 1. 是非受管节点的事件
 * 2. 是非委托事件（直接绑定）
 * 3. 是捕获阶段的事件
 * 这是一个性能优化，避免在不必要的情况下执行额外的逻辑。
 */
export const SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS =
  IS_EVENT_HANDLE_NON_MANAGED_NODE | IS_NON_DELEGATED | IS_CAPTURE_PHASE
