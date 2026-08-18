/**
 * Fiber 模式类型。
 *
 * 用于标记 Fiber 节点的工作模式和特性。
 * 通过位掩码组合，一个 Fiber 可以同时拥有多个模式。
 */

// 模式类型定义。
export type TypeOfMode = number

// 无模式（默认）。
// 普通模式，没有特殊的行为。
export const NoMode = /*                         */ 0b000000
// 并发模式。
// 启用并发渲染特性（React 18+ 的核心特性）。
// 允许中断和恢复渲染，实现时间切片和 Suspense。
export const ConcurrentMode = /*                 */ 0b000001
// 性能分析模式。
// 启用 React.Profiler 的性能分析功能。
// 记录组件的渲染时间、开始时间等信息。
export const ProfileMode = /*                    */ 0b000010
// 调试追踪模式。
// 启用调试追踪功能（实验性）。
// 用于追踪 React 的渲染过程，帮助调试。
export const DebugTracingMode = /*               */ 0b000100
// 严格模式（旧版）。
// 启用 React.StrictMode 的旧版严格检查。
// 检测不安全的生命周期、遗留 API 等。
export const StrictLegacyMode = /*               */ 0b001000
// 严格效果模式。
// 启用 React.StrictMode 的严格效果检查。
// 在开发环境下双重调用 effect，帮助发现副作用。
export const StrictEffectsMode = /*              */ 0b010000
// 默认并发更新模式。
// 默认启用并发更新（实验性）。
// 用于内部测试和实验。
export const ConcurrentUpdatesByDefaultMode = /* */ 0b100000
