export type Lanes = number
export type Lane = number
export type LaneMap<T> = Array<T>

export const TotalLanes = 31

// lane 都是数字，可以表示优先级。lane值越小，优先级越高。
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000

export const SyncHydrationLane: Lane = /*               */ 0b0000000000000000000000000000001
export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000010
export const SyncLaneIndex: number = 1

export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000100
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000001000

export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000010000
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000100000

// TODO: 20260412 - 待完善
// export const SyncUpdateLanes: Lanes | Lane = enableUnifiedSyncLane
//   ? SyncLane | InputContinuousLane | DefaultLane
//   : SyncLane
export const SyncUpdateLanes: Lanes =
  SyncLane | InputContinuousLane | DefaultLane

const TransitionHydrationLane: Lane = /*                */ 0b0000000000000000000000001000000
const TransitionLanes: Lanes = /*                       */ 0b0000000001111111111111110000000
const TransitionLane1: Lane = /*                        */ 0b0000000000000000000000010000000
const TransitionLane2: Lane = /*                        */ 0b0000000000000000000000100000000
const TransitionLane3: Lane = /*                        */ 0b0000000000000000000001000000000
const TransitionLane4: Lane = /*                        */ 0b0000000000000000000010000000000
const TransitionLane5: Lane = /*                        */ 0b0000000000000000000100000000000
const TransitionLane6: Lane = /*                        */ 0b0000000000000000001000000000000
const TransitionLane7: Lane = /*                        */ 0b0000000000000000010000000000000
const TransitionLane8: Lane = /*                        */ 0b0000000000000000100000000000000
const TransitionLane9: Lane = /*                        */ 0b0000000000000001000000000000000
const TransitionLane10: Lane = /*                       */ 0b0000000000000010000000000000000
const TransitionLane11: Lane = /*                       */ 0b0000000000000100000000000000000
const TransitionLane12: Lane = /*                       */ 0b0000000000001000000000000000000
const TransitionLane13: Lane = /*                       */ 0b0000000000010000000000000000000
const TransitionLane14: Lane = /*                       */ 0b0000000000100000000000000000000
const TransitionLane15: Lane = /*                       */ 0b0000000001000000000000000000000

const RetryLanes: Lanes = /*                            */ 0b0000011110000000000000000000000
const RetryLane1: Lane = /*                             */ 0b0000000010000000000000000000000
const RetryLane2: Lane = /*                             */ 0b0000000100000000000000000000000
const RetryLane3: Lane = /*                             */ 0b0000001000000000000000000000000
const RetryLane4: Lane = /*                             */ 0b0000010000000000000000000000000

export const SomeTransitionLane: Lane = TransitionLane1

export const SelectiveHydrationLane: Lane = /*          */ 0b0000100000000000000000000000000
const NonIdleLanes: Lanes = /*                          */ 0b0000111111111111111111111111111

export const IdleHydrationLane: Lane = /*               */ 0b0001000000000000000000000000000
export const IdleLane: Lane = /*                        */ 0b0010000000000000000000000000000

export const OffscreenLane: Lane = /*                   */ 0b0100000000000000000000000000000
export const DeferredLane: Lane = /*                    */ 0b1000000000000000000000000000000

// Any lane that might schedule an update. This is used to detect infinite
// update loops, so it doesn't include hydration lanes or retries.
export const UpdateLanes: Lanes =
  SyncLane | InputContinuousLane | DefaultLane | TransitionLanes

// 检查 lane 是否是 TransitionLanes 中的 lane。
export function isTransitionLane(lane: Lane): boolean {
  return (lane & TransitionLanes) !== NoLane
}

// 获取 lanes 中优先级最高的 lane。
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes
}

// 检查 a 和 b 是否有相同的 lane，只要有一个单独的 lane 相同，则返回 true。
export function includesSomeLane(a: Lanes | Lane, b: Lanes): boolean {
  return (a & b) !== NoLanes
}

// 检查 set 是否包含 subset。
export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane): boolean {
  return (set & subset) === subset
}

// 合并两个 lane 或者 lanes。
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b
}

// 从 set 移除 subset。例如：执行完节点的 Update 操作之后，则需要移除 fiber.flags 的 Update 状态。
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset
}
