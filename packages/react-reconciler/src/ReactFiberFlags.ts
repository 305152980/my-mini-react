export type Flags = number

export const NoFlags = /*                      */ 0b00000000000000000000000000
export const PerformedWork = /*                */ 0b00000000000000000000000001

export const Placement = /*                    */ 0b00000000000000000000000010
export const Update = /*                       */ 0b00000000000000000000000100
export const Deletion = /*                     */ 0b00000000000000000000001000
export const ChildDeletion = /*                */ 0b00000000000000000000010000
export const ContentReset = /*                 */ 0b00000000000000000000100000
export const Callback = /*                     */ 0b00000000000000000001000000
export const DidCapture = /*                   */ 0b00000000000000000010000000
export const ForceClientRender = /*            */ 0b00000000000000000100000000
export const Ref = /*                          */ 0b00000000000000001000000000
export const Snapshot = /*                     */ 0b00000000000000010000000000
export const Passive = /*                      */ 0b00000000000000100000000000
export const Hydrating = /*                    */ 0b00000000000001000000000000
export const Visibility = /*                   */ 0b00000000000010000000000000
export const StoreConsistency = /*             */ 0b00000000000100000000000000

export const LifecycleEffectMask =
  Passive | Update | Callback | Ref | Snapshot | StoreConsistency

export const HostEffectMask = /*               */ 0b00000000000111111111111111

/**
 * Incomplete 是 Fiber 节点 flags（副作用标记）中的一个特殊标志位。
 * 它的二进制值为 0b00000000001000000000000000（即十进制的 2048）。
 *
 * 【核心作用】：
 * 专门用来标记某个 Fiber 节点在处理过程中抛出了错误，导致未能成功完成工作。
 *
 * 【触发时机】：
 * 当组件在渲染期间发生异常时，React 会在 throwException 中给报错的组件打上这个标记：
 * sourceFiber.effectTag |= Incomplete;
 *
 * 【后续影响】：
 * 1. 阻止正常收尾：在 completeUnitOfWork 阶段，如果检测到该标志，React 会跳过正常的 completeWork 流程，转而执行 unwindWork 进行异常捕获和降级处理。
 * 2. 状态向上冒泡：如果没有找到 Error Boundary 来处理这个错误，React 会将父级节点也打上 Incomplete 标记，一路向上传染，直到根节点。
 */
export const Incomplete = /*                   */ 0b00000000001000000000000000
export const ShouldCapture = /*                */ 0b00000000010000000000000000
export const ForceUpdateForLegacySuspense = /* */ 0b00000000100000000000000000
export const DidPropagateContext = /*          */ 0b00000001000000000000000000
export const NeedsPropagation = /*             */ 0b00000010000000000000000000
export const Forked = /*                       */ 0b00000100000000000000000000

/**
 * 静态副作用标志。
 *
 * 这些标志不会在每次渲染时被重置，用于优化性能。
 * 通过静态标志，React 可以快速判断子树中是否有特定的副作用，从而避免不必要的遍历。
 */
// Ref 静态标志。
// 标记：这个 Fiber 的子树中是否有 ref 需要处理。
// 用途：优化 ref 的处理，如果子树中没有 ref，可以跳过 ref 相关的处理。
export const RefStatic = /*                    */ 0b00001000000000000000000000
// Layout 静态标志。
// 标记：这个 Fiber 的子树中是否有 layout effect（useLayoutEffect）。
// 用途：优化 layout effect 的处理，如果子树中没有 layout effect，可以跳过遍历。
export const LayoutStatic = /*                 */ 0b00010000000000000000000000
// Passive 静态标志。
// 标记：这个 Fiber 的子树中是否有 passive effect（useEffect）。
// 用途：优化 passive effect 的处理，如果子树中没有 passive effect，可以跳过遍历。
export const PassiveStatic = /*                */ 0b00100000000000000000000000

export const MountLayoutDev = /*               */ 0b01000000000000000000000000
export const MountPassiveDev = /*              */ 0b10000000000000000000000000

export const BeforeMutationMask = Update | Snapshot

// 定义 Mutation 阶段需要处理的所有副作用类型。
export const MutationMask =
  Placement |
  Update |
  ChildDeletion |
  ContentReset |
  Ref |
  Hydrating |
  Visibility

// Layout 阶段需要处理的副作用标志集合。
// 用于 commit 阶段快速判断子树是否需要遍历（subtreeFlags & LayoutMask === NoFlags 则跳过）。
//   Update     → componentDidMount / componentDidUpdate / useLayoutEffect。
//   Callback   → setState 的回调函数。
//   Ref        → ref 回调函数。
//   Visibility → Offscreen 子树可见性变化时的 layout effect。
export const LayoutMask = Update | Callback | Ref | Visibility

/**
 * PassiveMask：包含所有需要触发被动副作用清理或执行的标志。
 * 当前包括 Passive 和 ChildDeletion（因为删除节点时可能需清理 effect）。
 */
export const PassiveMask = Passive | ChildDeletion

// 静态标志掩码。
// 组合所有静态标志，用于在 Fiber 克隆时保留这些标志。
// 作用：重置其他副作用标志，但保留静态标志（LayoutStatic、PassiveStatic、RefStatic）。
export const StaticMask = LayoutStatic | PassiveStatic | RefStatic
