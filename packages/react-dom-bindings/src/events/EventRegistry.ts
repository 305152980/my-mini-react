import type { DOMEventName } from './DOMEventNames'

// 存储所有需要监听的原生 DOM 事件名称的集合
// 例如：Set { 'click', 'scroll', 'change' ... }
// 这个集合用于在 React 容器根节点上统一绑定原生事件监听器
export const allNativeEvents: Set<DOMEventName> = new Set()

// 存储 React 合成事件名与原生 DOM 事件依赖之间的映射关系
// 键 (Key): React 事件名，如 'onClick', 'onChange'
// 值 (Value): 对应的原生 DOM 事件数组，如 ['click'], ['change', 'input']
// 作用：当事件触发时，通过这个映射表找到对应的 React 事件回调
export const registrationNameDependencies: {
  [registrationName: string]: Array<DOMEventName>
} = {}

/**
 * 注册一个两阶段（冒泡和捕获）的合成事件
 * @param registrationName React 事件名，例如 'onClick'
 * @param dependencies 依赖的原生 DOM 事件，例如 ['click']
 *
 * 作用：
 * 1. 注册冒泡阶段事件 (如 onClick)
 * 2. 注册捕获阶段事件 (如 onClickCapture)
 */
export function registerTwoPhaseEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
): void {
  // 注册冒泡事件
  registerDirectEvent(registrationName, dependencies)
  // 注册捕获事件（名称后面加上 'Capture' 后缀）
  registerDirectEvent(registrationName + 'Capture', dependencies)
}

/**
 * 注册一个直接的合成事件（通常是冒泡阶段）
 * @param registrationName React 事件名
 * @param dependencies 依赖的原生 DOM 事件
 *
 * 作用：
 * 1. 将 React 事件名和原生事件依赖存入映射表
 * 2. 将原生事件添加到全局监听集合中
 */
export function registerDirectEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
): void {
  // 建立 React 事件名 -> 原生事件依赖 的映射
  registrationNameDependencies[registrationName] = dependencies
  // 将该事件依赖的所有原生 DOM 事件添加到全局监听集合
  // 使用 Set 确保同一个原生事件（如 'click'）不会被重复添加
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i])
  }
}
