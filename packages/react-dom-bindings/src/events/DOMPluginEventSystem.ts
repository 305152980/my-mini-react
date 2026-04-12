import type { DOMEventName } from './DOMEventNames'
import * as SimpleEventPugin from './plugins/SimpleEventPlugin'
import { allNativeEvents } from './EventRegistry'
import { IS_CAPTURE_PHASE, type EventSystemFlags } from './EventSystemFlags'
import {
  addEventCaptureListener,
  addEventBubbleListener,
} from './EventListener'
import { createEventListenerWrapperWithPriority } from './ReactDOMEventListener'

SimpleEventPugin.registerEvents()
// EnterLeaveEventPlugin.registerEvents()
// ChangeEventPlugin.registerEvents()
// SelectEventPlugin.registerEvents()
// BeforeInputEventPlugin.registerEvents()

// 需要分别附加到媒体元素的事件列表。
export const mediaEventTypes: Array<DOMEventName> = [
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'resize',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
]

// 我们不应该将这些事件委托给容器，而是应该直接在实际的目标元素上设置它们。这主要是因为这些事件在 DOM 中的冒泡行为不一致。
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  'cancel',
  'close',
  'invalid',
  'load',
  'scroll',
  'scrollend',
  'toggle',
  // 注意：“error”事件并不是一个独占的媒体事件，也可能发生在其他元素上。我们不会重复这个事件，而是直接从媒体事件数组中取出。
  ...mediaEventTypes,
])

/**
 * 将事件监听器“捕获”并绑定到根容器上
 * 这是 React 事件系统底层真正执行 addEventListener 的地方
 *
 * @param targetContainer 目标容器（通常是 document 或 root 节点）
 * @param domEventName 原生 DOM 事件名称（如 'click', 'scroll'）
 * @param eventSystemFlags 事件系统标志位（用于标识是否是捕获阶段、是否是被动事件等）
 * @param isCapturePhaseListener 是否在捕获阶段监听（true 为捕获，false 为冒泡）
 */
function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean
): void {
  // 1. 构造一个带有优先级调度功能的包装监听器
  // React 不会直接执行回调，而是根据事件类型（如离散事件、连续事件）
  // 将其包装成不同优先级的任务，交给调度器（Scheduler）处理
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  )
  // 2. 根据阶段选择原生的 addEventListener 进行绑定
  if (isCapturePhaseListener) {
    // 如果是捕获阶段：注册捕获监听器
    // 对应原生：target.addEventListener(type, listener, true)
    addEventCaptureListener(targetContainer, domEventName, listener)
  } else {
    // 如果是冒泡阶段：注册冒泡监听器
    // 对应原生：target.addEventListener(type, listener, false)
    addEventBubbleListener(targetContainer, domEventName, listener)
  }
}
function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  target: EventTarget
): void {
  let eventSystemFlags = 0
  if (isCapturePhaseListener) {
    eventSystemFlags |= IS_CAPTURE_PHASE
  }
  addTrappedEventListener(
    target,
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener
  )
}
const listeningMarker = '__reactListening' + Math.random().toString(36).slice(2)
/**
 * 在根容器元素上监听所有 React 支持的原生事件。
 * 这是 React 事件系统初始化的核心入口。
 * @param rootContainerElement 根容器元素（通常是 document 或 React 应用的挂载点）。
 */
export function listenToAllSupportedEvents(
  rootContainerElement: EventTarget
): void {
  // 使用标记确保同一容器只绑定一次事件监听器。
  // 防止重复初始化导致的事件重复触发。
  if (!(rootContainerElement as any)[listeningMarker]) {
    // 设置已监听标记。
    ;(rootContainerElement as any)[listeningMarker] = true
    // 遍历所有需要支持的原生事件（如 click, change, scroll 等）。
    allNativeEvents.forEach(domEventName => {
      if (domEventName !== 'selectionchange') {
        // 判断该事件是否属于"不可委托"的事件类型。
        // 有些事件在 DOM 上冒泡行为不一致，这些事件就不做事件委托。
        // 如：cancel、close、invalid、load、scroll、scrollend、toggle 等
        if (!nonDelegatedEvents.has(domEventName)) {
          // 对于普通可冒泡事件：使用事件委托机制。
          // 将监听器绑定在根容器上，利用事件冒泡阶段（false）统一处理所有子元素的事件。
          listenToNativeEvent(domEventName, false, rootContainerElement)
        }
        // 对于非委托事件（如 scroll）：必须在捕获阶段进行监听。
        // 因为这些事件通常不会冒泡，只有通过捕获阶段才能在根节点截获它们。
        listenToNativeEvent(domEventName, true, rootContainerElement)
      } else {
        // selectionchange 事件的特殊处理。
        // 该事件只在 document 上触发且不冒泡，需要单独处理。
        // TODO: 实现 selectionchange 事件的特殊监听逻辑。
      }
    })
  }
}
