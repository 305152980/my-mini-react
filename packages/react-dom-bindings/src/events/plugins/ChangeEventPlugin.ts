import { registerTwoPhaseEvent } from '../EventRegistry'
import { type DOMEventName } from '../DOMEventNames'
import { type Fiber } from '@my-mini-react/react-reconciler'
import {
  type AnyNativeEvent,
  type DispatchQueue,
  accumulateTwoPhaseListeners,
} from '../DOMPluginEventSystem'
import { type EventSystemFlags } from '../EventSystemFlags'
import isTextInputElement from '../isTextInputElement'
import { SyntheticEvent } from '../SyntheticEvent'

/**
 * 注册 change 事件相关的原生 DOM 事件监听器
 *
 * 为什么需要监听这么多事件？
 * 因为不同表单元素的 change 行为不一致：
 * - input/textarea: 失去焦点时触发 change
 * - checkbox/radio: 立即触发 change
 *
 * React 需要统一行为：所有元素的 onChange 都立即触发
 * 所以需要监听多个原生事件来模拟统一的 onChange 行为
 */
function registerEvents(): void {
  registerTwoPhaseEvent('onClick', [
    'change', // change 事件
    'click', // 点击事件
    'focusin', // 获得焦点
    'focusout', // 失去焦点
    'input', // 输入事件
    'keydown', // 键盘按下
    'keyup', // 键盘抬起
    'selectionchange', // 选区改变
  ])
}

function extractEvents(
  dispatchQueue: DispatchQueue, // 派发队列，用于存储待处理的事件和监听器
  domEventName: DOMEventName, // 原生 DOM 事件名称，例如 'click'
  targetInst: Fiber | null, // 触发事件的 DOM 元素对应的 Fiber 节点
  nativeEvent: AnyNativeEvent, // 原生的浏览器事件对象
  nativeEventTarget: EventTarget | null, // 原生事件的目标元素
  eventSystemFlags: EventSystemFlags, // 事件系统标志，包含是否是捕获阶段等信息
  targetContainer: EventTarget // 事件委托的容器元素（通常是 root 容器）
): void {
  const targetNode = targetInst ? targetInst.stateNode : null
  // 分支 1: 文本输入元素（input/textarea）
  // 处理 input 和 textarea 的 change 事件
  // 需要追踪 value 的变化，模拟立即触发的行为
  if (
    isTextInputElement(targetNode) &&
    (domEventName === 'input' || domEventName === 'change')
  ) {
    // 因为我们只在冒泡阶段处理这些插件，所以我们需要（通过模拟）一次性收集两个阶段的监听器。
    const listeners = accumulateTwoPhaseListeners(targetInst, 'onChange')
    if (listeners.length > 0) {
      const event = new SyntheticEvent(
        'onChange',
        'change',
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
  // TODO
  // 分支 2: select 元素
  // 处理 select 的 change 事件
  // 需要追踪 selected 值的变化
  // 分支 3: contentEditable 元素
  // 处理可编辑内容的 change 事件
  // 需要追踪文本内容的变化
  // 分支 4: 其他元素
  // 不做特殊处理
}

export { registerEvents, extractEvents }
