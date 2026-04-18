import {
  registerSimpleEvents,
  topLevelEventsToReactNames,
} from '../DOMEventProperties'
import { type DOMEventName } from '../DOMEventNames'
import { type Fiber } from '@my-mini-react/react-reconciler'
import {
  type AnyNativeEvent,
  type DispatchQueue,
  accumulateSinglePhaseListeners,
} from '../DOMPluginEventSystem'
import { IS_CAPTURE_PHASE, type EventSystemFlags } from '../EventSystemFlags'
import { SyntheticEvent, SyntheticMouseEvent } from '../SyntheticEvent'

/**
 * extractEvents 是 SimpleEventPlugin 的核心方法
 * 它的职责是：
 * 1. 将原生 DOM 事件名称映射为 React 事件名称（如 'click' -> 'onClick'）
 * 2. 收集在该事件传播路径上所有需要执行的监听器（冒泡或捕获）
 * 3. 将事件对象和监听器列表打包放入派发队列 (dispatchQueue)
 */
function extractEvents(
  dispatchQueue: DispatchQueue, // 派发队列，用于存储待处理的事件和监听器
  domEventName: DOMEventName, // 原生 DOM 事件名称，例如 'click'
  targetInst: Fiber | null, // 触发事件的 DOM 元素对应的 Fiber 节点
  nativeEvent: AnyNativeEvent, // 原生的浏览器事件对象
  nativeEventTarget: EventTarget | null, // 原生事件的目标元素
  eventSystemFlags: EventSystemFlags, // 事件系统标志，包含是否是捕获阶段等信息
  targetContainer: EventTarget // 事件委托的容器元素（通常是 root 容器）
): void {
  // 1. 将原生事件名（如 'click'）转换为 React 事件名（如 'onClick'）
  const reactName = topLevelEventsToReactNames.get(domEventName)
  if (reactName === undefined) {
    // 如果 React 不支持该事件，直接返回
    return
  }
  let SyntheticEventCtor = SyntheticEvent
  switch (domEventName) {
    case 'click':
      // 检测鼠标按键：0=左键, 1=中键, 2=右键
      if ((nativeEvent as MouseEvent).button === 2) {
        // 忽略右键点击事件
        return
      }
    case 'auxclick':
    case 'dblclick':
    case 'mousedown':
    case 'mousemove':
    case 'mouseup':
    case 'mouseout':
    case 'mouseover':
    case 'contextmenu':
      SyntheticEventCtor = SyntheticMouseEvent
      break
    // TODO: 根据事件类型指定不同的合成事件构造函数，例如 KeyboardEvent、TouchEvent 等
  }
  // 2. 判断当前是否处于捕获阶段
  // 通过位运算检查 eventSystemFlags 中是否包含 IS_CAPTURE_PHASE 标志
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0
  // 3. 判断是否只收集目标节点的监听器（不向上冒泡）
  // scroll 和 scrollend 事件比较特殊，它们不冒泡，所以只需要收集目标节点的监听器
  const accumulateTargetOnly =
    !inCapturePhase &&
    (domEventName === 'scroll' || domEventName === 'scrollend')
  // 4. 收集事件传播路径上的所有监听器
  // 根据是否是捕获阶段、是否只收集目标节点等条件，从 targetInst 开始向上遍历 Fiber 树
  // 收集所有匹配的 onClick、onClickCapture 等监听函数
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
    nativeEvent
  )
  // 5. 如果收集到了监听器，则将事件和监听器列表放入派发队列
  if (listeners.length > 0) {
    // 创建合成事件对象
    // 第三个参数 targetInst 传 null 的原因：
    // 1. targetInst 已经在第 68 行的 accumulateSinglePhaseListeners 中使用过了（用于收集监听器）
    // 2. SyntheticEvent 的 _targetInst 属性会在后续事件分发阶段被设置
    // _targetInst 的作用：
    //   用于在事件传播过程中追踪当前处理到的 Fiber 节点
    //   它会在事件分发阶段动态设置，而不是在创建时设置
    const event = new SyntheticEventCtor(
      reactName,
      domEventName,
      null,
      nativeEvent,
      nativeEventTarget
    )
    dispatchQueue.push({
      event,
      listeners,
    })
  }
}

export { registerSimpleEvents as registerEvents, extractEvents }
