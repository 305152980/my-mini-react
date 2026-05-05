import { type FiberRoot } from './ReactInternalTypes'

export type Lanes = number
export type Lane = number
export type LaneMap<T> = Array<T>
export type LaneIndex = number

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

let nextTransitionLane: Lane = TransitionLane1

// 检查 lane 是否是 TransitionLanes 中的 lane。
export function isTransitionLane(lane: Lane): boolean {
  return (lane & TransitionLanes) !== NoLane
}

// 检查 lanes 是否有非 Idle 的 lane。
export function includesNonIdleWork(lanes: Lanes | Lane): boolean {
  return (lanes & NonIdleLanes) !== NoLanes
}

// 获取 lanes 中优先级最高的 lane。
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes
}

/**
 * 获取最高优先级的 Lanes 集合
 * @param lanes - 传入的 Lanes 位掩码集合
 * @returns 返回属于最高优先级区间的 Lanes（可能是单个，也可能是一组）
 */
export function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes | Lane {
  // 检查是否存在同步更新（常量位运算检查）
  const pendingSyncLane = SyncLane & SyncUpdateLanes
  if (pendingSyncLane !== 0) {
    return pendingSyncLane
  }
  // 获取当前 lanes 中优先级最高的那一个 Lanes | Lane
  switch (getHighestPriorityLane(lanes)) {
    case SyncHydrationLane:
      return SyncHydrationLane
    case SyncLane:
      return SyncLane
    case InputContinuousHydrationLane:
      return InputContinuousHydrationLane
    case InputContinuousLane:
      return InputContinuousLane
    case DefaultHydrationLane:
      return DefaultHydrationLane
    case DefaultLane:
      return DefaultLane
    case TransitionHydrationLane:
      return TransitionHydrationLane
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
      return lanes & TransitionLanes
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
      return lanes & RetryLanes
    case SelectiveHydrationLane:
      return SelectiveHydrationLane
    case IdleHydrationLane:
      return IdleHydrationLane
    case IdleLane:
      return IdleLane
    case OffscreenLane:
      return OffscreenLane
    case DeferredLane:
      return NoLanes
    default:
      // 如果遇到了一个不认识、或者没列出来的优先级，为了安全起见，直接返回 lanes。
      return lanes
  }
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

// 与 includesSomeLane 不同，includesSomeLane 返回的是是否有交叉，即结果是 boolean。而 intersectLanes 返回的是有交叉的 lanes。
export function intersectLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a & b
}

// 返回优先级较高的 lane。如果 a < b，则说明 a 的优先级高于 b，因为 lane 越小，优先级越高。
export function higherPriorityLane(a: Lane, b: Lane): Lane {
  return a !== NoLane && a < b ? a : b
}

// 返回比特位上最右边 1 的位置下标。
// 这个函数常用在获取一个 lanes 上优先级最高的 lane，如果这里返回值为 index，那么 1<< index 就是 lanes 中优先级最高的 lane。
function pickArbitraryLaneIndex(lanes: Lanes): LaneIndex {
  return 31 - Math.clz32(lanes)
}

// 返回比特位上最右边 1 的位置下标。
function laneToIndex(lanes: Lanes): LaneIndex {
  return pickArbitraryLaneIndex(lanes)
}

/**
 * 功能：判断传入的 lanes 集合中，是否**只包含**非紧急任务（即不包含任何紧急任务）。
 *
 * @param {Lanes} lanes - 待检查的任务优先级集合（位掩码）
 * @returns {boolean}
 *   - true: 集合中**完全没有**紧急任务（全是低优先级的，如过渡动画、后台任务）。
 *   - false: 集合中**包含**至少一个紧急任务（如同步更新、用户输入）。
 */
export function includesOnlyNonUrgentLanes(lanes: Lanes): boolean {
  // 定义“紧急任务”的集合
  // 这里使用了按位或 (|) 将三种高优先级的 Lane 合并成一个掩码
  // - SyncLane: 同步任务（最高优先级，如 setState 同步调用）
  // - InputContinuousLane: 连续输入任务（如打字、拖拽）
  // - DefaultLane: 默认任务（普通的异步更新）
  // 注意：TransitionLanes（过渡任务）和 IdleLanes（空闲任务）不在此列，它们属于“非紧急”
  const UrgentLanes = SyncLane | InputContinuousLane | DefaultLane
  return (lanes & UrgentLanes) === NoLanes
}

/**
 * 功能：判断传入的 lanes 集合中，是否**只包含**过渡任务（Transition Lanes）。
 *
 * @param {Lanes} lanes - 待检查的任务优先级集合（位掩码）
 * @returns {boolean}
 *   - true: 集合中**全都是**过渡任务（没有混入 Sync、Default 等其他任务）。
 *   - false: 集合中**包含**非过渡任务（或者集合为空）。
 */
export function includesOnlyTransitions(lanes: Lanes): boolean {
  return (lanes & TransitionLanes) === lanes
}

/**
 * 申请下一个可用的「过渡车道」(Transition Lane)
 *
 * 核心机制：循环位掩码分配 (Circular Bitmask Allocation)
 *
 * 1. 独立车道分配：
 *    - 每次调用都会分配一个新的、独立的 Transition Lane。
 *    - 目的：让不同的过渡更新（如多次搜索输入）拥有独立的优先级通道。
 *      这样 React 可以单独中断或跳过某个旧的过渡任务，而不影响新的任务。
 *
 * 2. 循环复用 (Recycling)：
 *    - Transition Lanes 是有限的（二进制位是有限的）。
 *    - 当分配完所有可用的 Transition Lanes 后，指针会自动绕回，从头开始复用。
 *    - 目的：防止资源耗尽，确保系统能持续处理新的过渡请求。
 */
// 循环是为了防止车道资源耗尽，而“撞车”正是 React 想要的——让新任务直接覆盖旧任务，从而避免页面卡死。
export function claimNextTransitionLane(): Lane {
  // 1. 获取当前的指针位置作为本次分配的车道
  const lane = nextTransitionLane
  // 2. 移动指针：左移一位 (相当于乘以 2)
  // 二进制示例：0b0010 -> 0b0100 -> 0b1000
  // 这样下一次调用时，就会分配到下一个优先级的车道
  nextTransitionLane <<= 1
  // 3. 边界检查：判断是否移出了 TransitionLanes 的掩码范围
  // 如果 (nextTransitionLane & TransitionLanes) 结果为 0 (NoLane)，
  // 说明已经转了一圈，超出了最大限制位。
  if ((nextTransitionLane & TransitionLanes) === NoLane) {
    // 重置指针：回到 Transition Lanes 的起始位置（通常是最高位的那个 bit）
    nextTransitionLane = TransitionLane1
  }
  // 4. 返回刚才分配的车道
  return lane
}

/**
 * 核心职责：
 * 1. 从所有待处理的任务中，选出下一批应该执行的任务优先级集合 (Lanes)。
 * 2. 决定是否需要“打断”当前正在进行的渲染 (Work In Progress)。
 *
 * @param {FiberRoot} root - React 应用的根节点，存储着全局调度信息
 * @param {Lanes} wipLanes - Work In Progress Lanes，当前正在渲染的任务优先级集合
 * @returns {Lanes} - 决定接下来要执行的任务优先级集合
 */
export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
  // 获取根节点上所有“待处理”的任务集合 (pendingLanes 是一个位掩码，记录了所有未完成的更新)
  const pendingLanes = root.pendingLanes
  if (pendingLanes === NoLanes) {
    // 如果没有任何待处理的任务 (二进制全为 0)，直接下班，返回空
    return NoLanes
  }
  // 从所有待处理任务中，提取出优先级最高的那些 Lanes。
  // 注意：这里简化了逻辑，实际源码会先排除掉 Suspended (挂起) 和 Idle (空闲) 的任务。
  let nextLanes = getHighestPriorityLanes(pendingLanes)
  if (nextLanes === NoLane) {
    // 再次检查，如果筛选后为空，直接返回
    return NoLanes
  }
  // --- 核心决策 —— 是否打断当前任务？ ---
  // 前提条件：
  // 1. wipLanes !== NoLanes: 当前确实有一个渲染任务正在进行中。
  // 2. wipLanes !== nextLanes: 新选出的任务与当前正在做的任务不一样。
  //    (如果一样，说明是同一批任务，直接继续执行即可，无需判断打断)
  if (wipLanes !== NoLanes && wipLanes !== nextLanes) {
    // 提取出“新任务”中优先级最高的那一个车道 (数值最小)
    const nextLane = getHighestPriorityLane(nextLanes)
    // 提取出“当前任务”中优先级最高的那一个车道
    const wipLane = getHighestPriorityLane(wipLanes)
    // 【关键判断逻辑】
    // 满足以下任一条件，则【不打断】当前任务，继续执行 wipLanes：
    // 条件 A: nextLane >= wipLane
    //   - 在 React Lanes 模型中，**数值越小，优先级越高** (如 SyncLane 是 1, DefaultLane 是 16)。
    //   - 如果 nextLane >= wipLane，说明新任务的优先级 **低于或等于** 当前任务。
    //   - 例子：正在做优先级 4 的事，来了个优先级 8 的事 -> 插队失败，继续做优先级 4 的事。
    // 条件 B: (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    //   - 这是一个特殊的防抖动优化。
    //   - 如果新任务是“默认优先级”，而当前正在做“过渡任务 (Transition)”。
    //   - 虽然理论上 Default > Transition，但 React 为了保护过渡动画的流畅性，
    //     规定：普通的默认更新不要打断正在进行的过渡更新。
    if (
      nextLane >= wipLane ||
      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    ) {
      // 【决策结果：维持现状】
      // 返回 wipLanes，意味着告诉调度器：“别管新来的了，先把当前手里的活干完”。
      // 这样可以避免频繁的重渲染和计算浪费。
      return wipLanes
    }
  }
  // 走到这里，说明以下两种情况之一：
  // 1. 当前没有任务在执行 (wipLanes === NoLanes)。
  // 2. 新任务的优先级 **严格高于** 当前任务 (例如：来了个同步更新，打断了默认的渲染)。
  // 【决策结果：插队成功】
  // 返回 nextLanes，调度器将暂停当前工作，转而去处理这批更高优先级的任务。
  return nextLanes
}
