import {
  DefaultEventPriority,
  type EventPriority,
} from '@my-mini-react/react-reconciler'
import { getEventPriority } from '../events/ReactDOMEventListener'
import { type DOMEventName } from '../events/DOMEventNames'

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
