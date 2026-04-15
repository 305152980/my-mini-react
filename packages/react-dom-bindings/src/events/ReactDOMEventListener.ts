import {
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  IdleEventPriority,
  ContinuousEventPriority,
  type EventPriority,
} from '@my-mini-react/react-reconciler'
import { type DOMEventName } from './DOMEventNames'
import {
  Scheduler,
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
} from '@my-mini-react/scheduler'
import { IS_CAPTURE_PHASE, type EventSystemFlags } from './EventSystemFlags'
import {
  type AnyNativeEvent,
  type DispatchListener,
  type DispatchQueue,
  extractEvents,
} from './DOMPluginEventSystem'
import { getClosestInstanceFromNode } from '../client/ReactDOMComponentTree'
import { invokeGuardedCallbackAndCatchFirstError } from '@my-mini-react/shared/ReactErrorUtils'

function dispatchDiscreteEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
): void {
  // 1. 暂存当前的更新优先级
  // React 内部维护着一个全局的优先级状态，我们需要先保存它，以便稍后恢复
  const previousPriority = getCurrentUpdatePriority()
  try {
    // 2. 提升优先级为“离散事件优先级”
    // 离散事件（如点击）通常代表用户的明确意图，必须优先处理。
    // 这行代码告诉 React 调度器：接下来的任务（事件回调、状态更新）应该被视为高优先级任务。
    setCurrentUpdatePriority(DiscreteEventPriority)
    // 3. 执行通用的事件分发逻辑
    // 这里会进行事件系统的核心工作：
    // - 构造合成事件 (SyntheticEvent)
    // - 收集事件回调队列 (Dispatch Queue)
    // - 执行用户定义的 onClick 等回调
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    // 4. 恢复之前的优先级 (无论是否发生错误)
    // 这是一个防御性编程模式。
    // 防止因为本次点击事件的高优先级设置，影响到后续其他低优先级任务（如数据获取后的渲染）的执行。
    // 确保全局优先级状态“用完即走”，不留副作用。
    setCurrentUpdatePriority(previousPriority)
  }
}
function dispatchContinuousEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
): void {
  const previousPriority = getCurrentUpdatePriority()
  try {
    setCurrentUpdatePriority(ContinuousEventPriority)
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    setCurrentUpdatePriority(previousPriority)
  }
}
function executeDispatch(
  event: AnyNativeEvent, // 原生的浏览器事件对象。
  listener: Function, //事件回调函数
  currentTarget: EventTarget //当前事件绑定的 DOM 元素
): void {
  const type = event.type || 'unknown-event'
  // @ts-expect-error: 忽略参数数量不匹配的报错
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event)
}
function processDispatchQueueItemsInOrder(
  event: AnyNativeEvent, // 原生的浏览器事件对象。
  dispatchListeners: Array<DispatchListener>, // 待执行的监听器列表。
  isCapturePhase: boolean // 是否处于“捕获阶段”。
): void {
  if (isCapturePhase) {
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      // instance：Fiber 节点（组件实例）
      // listener：事件回调函数
      // currentTarget：当前事件绑定的 DOM 元素
      const { instance, listener, currentTarget } = dispatchListeners[i]
      executeDispatch(event, listener, currentTarget)
    }
  } else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { instance, listener, currentTarget } = dispatchListeners[i]
      executeDispatch(event, listener, currentTarget)
    }
  }
}
function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags
): void {
  const isCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i]
    processDispatchQueueItemsInOrder(event, listeners, isCapturePhase)
  }
}
/**
 * 事件分发的核心入口
 * 负责将原生 DOM 事件转化为 React 的合成事件处理流程
 *
 * @param domEventName 原生 DOM 事件名称 (如 'click', 'change')
 * @param eventSystemFlags 事件系统标志位 (标识是捕获还是冒泡，是否包含非委托事件等)
 * @param targetContainer 监听该事件的根容器 (通常是 document 或挂载点)
 * @param nativeEvent 浏览器原生的事件对象
 */
function dispatchEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
): void {
  // 1. 获取原生事件的目标节点
  // 例如：用户实际点击的那个 <button> 或 <div>
  const nativeEventTarget = nativeEvent.target
  // 2. 找到目标节点对应的 React Fiber 实例
  // React 通过 DOM 节点反向查找其对应的虚拟 DOM 节点 (Fiber Node)。
  // 这个实例包含了组件的状态、props 以及绑定的事件处理函数。
  // 注意：return_targetInst 看起来像是一个模块级的全局变量，用于在后续步骤中传递目标实例，避免参数透传。
  const return_targetInst = getClosestInstanceFromNode(
    nativeEventTarget as Element | Text
  )
  // 3. 初始化事件调度队列
  // 这是一个数组，用于存放本次事件需要执行的所有回调（包括捕获阶段和冒泡阶段的回调）。
  // React 不会立即执行回调，而是先收集到一个队列中，统一处理。
  // 大多数情况下 dispatchQueue 的长度为 1。
  // 虽然 SimpleEventPlugin（处理标准事件）只推入 1 个任务，但 dispatchQueue 的设计初衷是为了支持更复杂的场景。
  // dispatchQueue 的长度大于 1 通常发生在复合事件或特殊插件处理时。
  const dispatchQueue: DispatchQueue = []
  // 4. 提取事件并收集回调
  // 这是 React 事件系统的核心逻辑之一。它会：
  // - 从目标节点开始，向上遍历 Fiber 树（模拟冒泡或捕获路径）。
  // - 收集路径上所有组件注册的监听器（如 onClick, onClickCapture）。
  // - 将这些监听器封装成“调度项”放入 dispatchQueue 中。
  // - 创建 React 的合成事件对象 (SyntheticEvent)。
  extractEvents(
    dispatchQueue, // 存放回调的队列
    domEventName, // 事件类型
    return_targetInst, // 触发事件的 React 实例
    nativeEvent, // 原生事件对象
    nativeEventTarget, // 原生事件目标
    eventSystemFlags, // 标志位
    targetContainer // 根容器
  )
  // 5. 处理调度队列
  // 遍历 dispatchQueue，按顺序执行收集到的所有回调。
  // 这里会处理 React 的批量更新逻辑，确保状态变更被正确调度。
  processDispatchQueue(dispatchQueue, eventSystemFlags)
}
export function createEventListenerWrapperWithPriority(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags
): Function {
  const eventPriority = getEventPriority(domEventName)
  let listenerWrapper
  switch (eventPriority) {
    case DiscreteEventPriority:
      listenerWrapper = dispatchDiscreteEvent
      break
    case ContinuousEventPriority:
      listenerWrapper = dispatchContinuousEvent
      break
    case DefaultEventPriority:
    default:
      listenerWrapper = dispatchEvent
      break
  }
  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer
  )
}

export function getEventPriority(domEventName: DOMEventName): EventPriority {
  switch (domEventName) {
    case 'cancel':
    case 'click':
    case 'close':
    case 'contextmenu':
    case 'copy':
    case 'cut':
    case 'auxclick':
    case 'dblclick':
    case 'dragend':
    case 'dragstart':
    case 'drop':
    case 'focusin':
    case 'focusout':
    case 'input':
    case 'invalid':
    case 'keydown':
    case 'keypress':
    case 'keyup':
    case 'mousedown':
    case 'mouseup':
    case 'paste':
    case 'pause':
    case 'play':
    case 'pointercancel':
    case 'pointerdown':
    case 'pointerup':
    case 'ratechange':
    case 'reset':
    case 'resize':
    case 'seeked':
    case 'submit':
    case 'touchcancel':
    case 'touchend':
    case 'touchstart':
    case 'volumechange':
    case 'change':
    case 'selectionchange':
    case 'textInput':
    case 'compositionstart':
    case 'compositionend':
    case 'compositionupdate':
    case 'beforeblur':
    case 'afterblur':
    case 'beforeinput':
    case 'blur':
    case 'fullscreenchange':
    case 'focus':
    case 'hashchange':
    case 'popstate':
    case 'select':
    case 'selectstart':
      return DiscreteEventPriority
    case 'drag':
    case 'dragenter':
    case 'dragexit':
    case 'dragleave':
    case 'dragover':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'toggle':
    case 'touchmove':
    case 'wheel':
    case 'mouseenter':
    case 'mouseleave':
    case 'pointerenter':
    case 'pointerleave':
      return ContinuousEventPriority
    case 'message':
      const schedulerPriority = Scheduler.getCurrentPriorityLevel()
      switch (schedulerPriority) {
        case ImmediatePriority:
          return DiscreteEventPriority
        case UserBlockingPriority:
          return ContinuousEventPriority
        case NormalPriority:
        case LowPriority:
          return DefaultEventPriority
        case IdlePriority:
          return IdleEventPriority
        default:
          return DefaultEventPriority
      }
    default:
      return DefaultEventPriority
  }
}
