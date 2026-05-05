// ReactEventPriorities.ts（或者更准确地说是优先级相关的逻辑，如 ReactFiberLane.ts 中的定义）之所以放在 react-reconciler 中，
// 而不是 react-dom-bindings（或 react-dom）中，
// 核心原因在于：React 的架构设计遵循“宿主环境（Host）无关”的原则，且优先级的判断本质上是“调度决策”的一部分，而非单纯的“事件绑定”细节。

import {
  DefaultLane,
  IdleLane,
  InputContinuousLane,
  type Lane,
  type Lanes,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  includesNonIdleWork,
} from './ReactFiberLane'

export type EventPriority = Lane

export const DiscreteEventPriority: EventPriority = SyncLane
export const ContinuousEventPriority: EventPriority = InputContinuousLane
export const DefaultEventPriority: EventPriority = DefaultLane // 页面初次渲染的 lane 32
export const IdleEventPriority: EventPriority = IdleLane

let currentUpdatePriority: EventPriority = NoLane

export function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority
}

export function setCurrentUpdatePriority(newPriority: EventPriority) {
  currentUpdatePriority = newPriority
}

/**
 * 判断优先级 a 是否高于 b
 *
 * 核心规则：数字越小，优先级越高
 *
 * @param {EventPriority} a - 待比较的优先级 A
 * @param {EventPriority} b - 待比较的优先级 B
 * @returns {boolean} - 如果 a 的优先级比 b 高（即 a 的数值更小），返回 true
 */
export function isHigherEventPriority(
  a: EventPriority,
  b: EventPriority
): boolean {
  // a !== 0 排除无优先级的情况
  // a < b 利用数值大小判断：数值越小，优先级越高
  return a !== 0 && a < b
}

/**
 * 将 Lanes（位掩码集合）转换为 EventPriority（事件优先级）
 *
 * 核心作用：
 * 从一堆待处理的更新（lanes）中，找出那个“最紧急”的更新，
 * 并将其归类为 React 定义的四种标准事件优先级之一。
 *
 * 转换逻辑（从高到低逐级降级）：
 * 1. 如果是 SyncLane -> 离散事件（最高）
 * 2. 如果是 InputContinuousLane -> 连续事件
 * 3. 如果是 DefaultLane -> 默认事件
 * 4. 如果是 IdleLane -> 空闲事件（最低）
 */
export function lanesToEventPriority(lanes: Lanes): EventPriority {
  // 获取 lanes 中优先级最高的 lane。
  const lane = getHighestPriorityLane(lanes)
  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority
  }
  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority
  }
  // 检查 lane 是否为非 Idle 的 lane。
  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority
  }
  return IdleEventPriority
}
