/**
 * 在目标元素上添加一个冒泡阶段的事件监听器
 * @param target 目标 DOM 元素或事件目标
 * @param eventType 事件类型，如 'click', 'scroll'
 * @param listener 事件回调函数
 * @returns 返回传入的监听器函数（便于后续移除）
 */
export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): Function {
  target.addEventListener(eventType, listener as any, false)
  return listener
}

/**
 * 在目标元素上添加一个捕获阶段的事件监听器
 * @param target 目标 DOM 元素或事件目标
 * @param eventType 事件类型，如 'click', 'scroll'
 * @param listener 事件回调函数
 * @returns 返回传入的监听器函数（便于后续移除）
 */
export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): Function {
  target.addEventListener(eventType, listener as any, true)
  return listener
}

/**
 * 移除目标元素上的事件监听器
 * @param target 目标 DOM 元素或事件目标
 * @param eventType 事件类型
 * @param listener 要移除的事件回调函数
 * @param capture 是否与添加时相同的阶段（true=捕获，false=冒泡）
 */
export function removeEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  capture: boolean
): void {
  // 移除时必须保证 capture 参数与添加时一致，否则无法正确移除
  target.removeEventListener(eventType, listener as any, capture)
}
