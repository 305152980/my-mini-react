import type { DOMEventName } from './DOMEventNames'
import * as SimpleEventPugin from './plugins/SimpleEventPlugin'
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin'
import { allNativeEvents } from './EventRegistry'
import {
  IS_CAPTURE_PHASE,
  SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS,
  type EventSystemFlags,
} from './EventSystemFlags'
import {
  addEventCaptureListener,
  addEventBubbleListener,
} from './EventListener'
import { createEventListenerWrapperWithPriority } from './ReactDOMEventListener'
import { type Fiber, HostComponent } from '@my-mini-react/react-reconciler'
import { getListener } from './getListener'
import { type ReactSyntheticEvent } from './ReactSyntheticEventType'

// TODO
SimpleEventPugin.registerEvents()
// EnterLeaveEventPlugin.registerEvents()
ChangeEventPlugin.registerEvents()
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
  // 事件回调本身是同步执行的，但它触发的渲染是被调度的，而调度需要优先级！事件触发的渲染调度，其优先级就是该事件的优先级。
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

export type AnyNativeEvent = Event | KeyboardEvent | MouseEvent | TouchEvent

export type DispatchListener = {
  instance: null | Fiber
  listener: Function
  currentTarget: EventTarget
}

type DispatchEntry = {
  event: ReactSyntheticEvent // 合成事件对象。
  listeners: Array<DispatchListener>
}

export type DispatchQueue = Array<DispatchEntry>

/**
 * 事件提取入口：将原生 DOM 事件转化为 React 合成事件
 *
 * 工作流程：
 * 1. 接收原生 DOM 事件和相关信息
 * 2. 分发给各个事件插件（如 SimpleEventPlugin）处理
 * 3. 插件负责收集监听器、创建合成事件，并放入 dispatchQueue
 * 4. 最终由 processDispatchQueue 统一执行
 */
export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
): void {
  // 分发给 SimpleEventPlugin 处理标准事件（click, input 等）
  SimpleEventPugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  )
  const shouldProcessPolyfillPlugins =
    (eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0
  // We don't process these events unless we are in the
  // event's native "bubble" phase, which means that we're
  // not in the capture phase. That's because we emulate
  // the capture phase here still. This is a trade-off,
  // because in an ideal world we would not emulate and use
  // the phases properly, like we do with the SimpleEvent
  // plugin. However, the plugins below either expect
  // emulation (EnterLeave) or use state localized to that
  // plugin (BeforeInput, Change, Select). The state in
  // these modules complicates things, as you'll essentially
  // get the case where the capture phase event might change
  // state, only for the following bubble event to come in
  // later and not trigger anything as the state now
  // invalidates the heuristics of the event plugin. We
  // could alter all these plugins to work in such ways, but
  // that might cause other unknown side-effects that we
  // can't foresee right now.
  if (shouldProcessPolyfillPlugins) {
    ChangeEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer
    )
    // TODO: 其他事件插件
  }
  // TODO: 其他事件插件
}

export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  nativeEvent: AnyNativeEvent
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + 'Capture' : null
  const reactEventName = inCapturePhase ? captureName : reactName
  const listeners: Array<DispatchListener> = []

  let instance = targetFiber

  // 从目标 Fiber 开始，沿着 Fiber 树向上遍历，收集匹配的事件监听器。
  while (instance !== null) {
    const { stateNode, tag } = instance
    // 只有当 Fiber 是 HostComponent（即对应一个真实 DOM 元素）时，才有可能绑定事件监听器。
    if (tag === HostComponent && stateNode !== null) {
      // 获取当前 Fiber 上对应事件名称的监听器函数。
      const listener = getListener(instance, reactEventName!)
      if (listener !== null) {
        listeners.push({
          instance,
          listener,
          currentTarget: stateNode,
        })
      }
    }
    // 如果只需要收集目标节点的监听器（如 scroll 事件），则在第一次循环后就停止，不继续向上冒泡。
    if (accumulateTargetOnly) {
      break
    }
    instance = instance.return
  }

  return listeners
}

// 因为我们只在冒泡阶段处理这些插件，所以我们需要（通过模拟）一次性收集两个阶段的监听器。
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + 'Capture' : null
  const listeners: Array<DispatchListener> = []

  let instance = targetFiber

  while (instance !== null) {
    const { stateNode, tag } = instance
    if (tag === HostComponent && stateNode !== null) {
      // 捕获阶段监听器。
      const captureListener = getListener(instance, captureName!)
      if (captureListener !== null) {
        listeners.unshift({
          instance,
          listener: captureListener,
          currentTarget: stateNode,
        })
      }
      // 冒泡阶段监听器。
      const bubbleListener = getListener(instance, reactName!)
      if (bubbleListener !== null) {
        listeners.push({
          instance,
          listener: bubbleListener,
          currentTarget: stateNode,
        })
      }
    }
    instance = instance.return
  }
  return listeners
}
