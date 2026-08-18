/**
 * React 根节点类型。
 *
 * 用于标记 React 应用的根节点类型。
 * React 18 引入了并发模式，因此有两种根节点类型。
 */

// 根节点类型定义。
export type RootTag = 0 | 1

// 传统根节点（Legacy Root）。
// 使用 ReactDOM.render 创建的根节点。
// 使用旧版渲染模式（同步、不可中断）。
// 例如：ReactDOM.render(<App />, container)。
export const LegacyRoot = 0
// 并发根节点（Concurrent Root）。
// 使用 ReactDOM.createRoot 创建的根节点。
// 使用新版并发模式（可中断、时间切片、Suspense）。
// 例如：ReactDOM.createRoot(container).render(<App />)。
export const ConcurrentRoot = 1
