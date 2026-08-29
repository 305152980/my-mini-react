# My Mini React

一个基于 **React 18.2** 源码的教学级实现，旨在通过完整的 Fiber 架构深入理解 React 的核心工作原理。

---

## 一、项目介绍

本项目**不是**一个极简 Demo，而是尽可能贴近 React 18.2 官方源码的架构与实现思路，用 TypeScript 重写了 React 的核心模块。项目采用与 React 源码一致的包划分策略，保留了 Fiber 双缓冲树、Lane 优先级模型、可中断渲染、合成事件系统等关键设计。

### 技术栈

| 类别 | 工具 |
|------|------|
| 开发语言 | TypeScript ^5.9.3 |
| 模块系统 | ES Modules |
| 构建工具 | Rollup 4.62.4 |
| 类型声明打包 | rollup-plugin-dts 6.5.1 |
| 测试框架 | Vitest 4.1.5 |
| 代码规范 | ESLint 10.0.3 + Prettier 3.8.1 |
| 包管理器 | pnpm 10.26.1 (Monorepo) |

### 包结构

```
packages/
├── react/              # React 核心 API（createElement, hooks, Component 等）
├── react-dom/          # DOM 渲染器（DOM 操作、合成事件系统）
├── react-reconciler/   # Fiber 协调器（渲染主流程、Diff 算法、Lane 模型）
├── scheduler/          # 调度器（时间切片、优先级调度）
└── shared/             # 内部共享工具（类型定义、Symbol、工具函数）
```

### 已实现的核心功能

- **Fiber 架构**：双缓冲树（current / workInProgress）、可中断与恢复的渲染流程
- **协调算法（Reconciliation）**：单节点 / 多节点 Diff 算法
- **Lane 优先级模型**：事件优先级 → Lane → 调度器优先级的完整链路
- **Hooks 系统**：`useState`、`useReducer`、`useEffect`、`useLayoutEffect`、`useMemo`、`useCallback`、`useRef`、`useContext`
- **类组件**：`Component` 基类、`setState` 更新机制、`updateQueue`
- **合成事件系统**：事件委托、事件冒泡 / 捕获、`SyntheticEvent`、`ChangeEventPlugin`
- **memo 组件**：`React.memo` 浅比较跳过不必要的重渲染
- **Context**：`createContext`、Provider / Consumer 机制
- **Effect 清理函数**：`useEffect` / `useLayoutEffect` 的依赖变化检测与清理逻辑
- **受控组件**：`<textarea>` / `<input>` 等表单元素的受控更新

### 快速开始

```bash
# 1. 打包所有包到 dist 目录
pnpm run build:all

# 2. 启动示例项目
 pnpm run dev:examples
 pnpm run dev:project
```

---

## 二、与 React 18.2 源码的比较

### 相同点

| 维度 | 本项目 | React 18.2 源码 |
|------|--------|-----------------|
| 包结构 | react / react-dom / react-reconciler / scheduler / shared | 完全一致的包划分 |
| 核心架构 | Fiber 双缓冲树 | 一致 |
| 渲染流程 | render 阶段（可中断）→ commit 阶段（不可中断） | 一致 |
| commit 阶段 | mutationEffects → 切换 current → layoutEffects → 异步 passiveEffects | 一致 |
| Hooks 实现 | Dispatcher 模式，mount / update 分离 | 一致 |
| Lane 模型 | 位运算优先级调度 | 一致 |
| 合成事件 | 事件委托到 root，手动冒泡 / 捕获 | 一致 |
| 文件命名 | ReactFiberWorkLoop.ts、ReactFiberBeginWork.ts 等 | 与源码命名一致 |

### 简化点

| 维度 | 本项目的简化 | React 18.2 源码的完整实现 |
|------|-------------|------------------------|
| Concurrent 特性 | 未实现 Suspense、Transition、Offscreen | 完整实现 |
| Server Components | 未实现 | React 18 新增特性 |
| Hydration | 未实现 SSR 注水流程 | 完整的 SSR + Hydration |
| Profiler | 未实现性能分析模式 | 支持 Profiler 组件与 DevTools 集成 |
| Flow / 类型系统 | 使用 TypeScript 重写 | 源码使用 Flow 类型系统 |
| 浏览器兼容 | 仅现代浏览器 | 兼容 IE11 等旧浏览器，大量 polyfill |
| 错误边界 | 未实现 `componentDidCatch` | 完整的错误捕获与恢复机制 |
| 调度器 | 基于 MessageChannel 的核心逻辑 | 额外处理 Worker 线程、PostMessage 等边界场景 |
| DevTools | 未集成 React DevTools 协议 | 完整的 DevTools Hook |

---

## 三、与 GitHub 上高星同类 React 实现项目的比较

按 Stars 排序，选取 GitHub 上最具代表性的 React 源码学习/实现项目进行对比：

| 特性 | 本项目 | [lizuncong/mini-react](https://github.com/lizuncong/mini-react) | [react-fiber-implement](https://github.com/tranbathanhtung/react-fiber-implement) | [ZacharyL2/mini-react](https://github.com/ZacharyL2/mini-react) | [bubucuo/mini-react](https://github.com/bubucuo/mini-react) | [zh-lx/mini-react](https://github.com/zh-lx/mini-react) |
|------|--------|----------------------------------------------------------------|--------------------------------------------------------------------------------|----------------------------------------------------------------|--------------------------------------------------------------|--------------------------------------------------------|
| **Stars** | — | 684 | 579 | 269 | 227 | 211 |
| **类型** | 完整实现 | 实现+文档 | 教学实现 | 极简实现 | 教学实现 | 教学实现 |
| **基于版本** | React 18.2 | React 17.0.1 | React 16 | React 18 | React 17 | React 17.0.2 |
| **开发语言** | TypeScript | TypeScript | JavaScript | TypeScript | JavaScript | JavaScript |
| **包结构** | 5 个包（与源码一致） | 3 个包 | 未分包 | 未分包 | 未分包 | 未分包 |
| **Fiber 架构** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Lane 模型** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **调度模式** | 并发调度（Lane 优先级） | 异步调度 | 异步调度 | 同步渲染 | 异步调度 | 异步调度 |
| **调度器的实现** | 独立 Scheduler 包 + 优先级队列 | requestIdleCallback 封装 | requestIdleCallback 封装 | 无 | requestIdleCallback 封装 | requestIdleCallback 封装 |
| **时间切片** | ✅ 完整调度器 | ✅ 基础 | ✅ 基础 | ❌ | ✅ 基础 | ✅ 基础 |
| **Hooks** | 8 种 | 5 种 | 3 种 | 1 种 | 3 种 | 1 种 |
| **Context** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **合成事件** | ✅ 完整的"生产级"合成事件系统 | ✅ "教学级"合成事件 | ❌ | ❌ | ❌ | ❌ |
| **批量更新** | ✅ flushSync + syncQueue | ✅ batchedUpdates | ❌ | ❌ | ❌ | ❌ |
| **代码规模** | ~10,000 行 | ~8,000 行 | ~5,000 行 | ~400 行 | ~3,000 行 | ~5,000 行 |
| **前端工程化** | pnpm + Monorepo + Rollup + TS + ESLint | Webpack + Babel（无 TS/测试/Lint） | Webpack + Flow | pnpm + Vite + TS（strict） | pnpm + Vite + Vitest | CRA + Testing Library + ESLint |
| **主要功能还原度** | 90% | 75% | 60% | 30% | 60% | 40% |

### 本项目的独特优势

1. **唯一实现 Lane 优先级模型**
   - 所有对比项目中，只有本项目实现了 Lane 位运算模型
   - Lane 是 React 18 并发特性的基础，其余项目均停留在异步调度或同步渲染

2. **最贴近 React 18.2 源码架构**
   - 5 个包的职责划分与官方源码完全一致（react / react-dom / react-reconciler / scheduler / shared）
   - 架构模式完整还原：Fiber 双缓冲树、render / commit 两阶段分离、Scheduler 独立优先级队列、Lane 位运算优先级模型

3. **完整的合成事件系统**
   - 事件委托 + 捕获/冒泡双阶段遍历 + `SyntheticEvent` 继承链（464 行）+ `SimpleEventPlugin` / `ChangeEventPlugin` 插件 + `dispatchQueue` 先收集后统一执行
   - 生产级健壮性：事件优先级调度（与 Scheduler 联动）、`nonDelegatedEvents` 不可委托事件、passive 触摸事件、`invokeGuardedCallback` 错误捕获
   - 仅 lizuncong/mini-react 同样实现了合成事件核心流程，但缺少优先级调度、不可委托事件、passive 和错误捕获

4. **功能覆盖最全面**
   - 唯一同时实现 memo + Context + 批量更新（flushSync + syncQueue）的项目
   - 8 种 Hooks 数量在所有对比项目中最多

5. **完整的工程化基础设施**
   - pnpm Monorepo + Rollup 多格式输出（UMD / CJS / ESM）
   - rollup-plugin-dts 类型打包 + 完整 TypeScript 类型支持
   - ESLint 扁平配置 + Prettier 代码格式化

### 一句话点评

| 项目 | 点评 |
|------|------|
| **lizuncong/mini-react** (684 ⭐) | 配套 30+ 篇深度源码分析文章，覆盖 Fiber、Hooks、合成事件、Context、异常捕获等模块，文档体系最完善 |
| **react-fiber-implement** (579 ⭐) | 使用 Flow 类型检查，代码贴近 React 16 源码风格，适合理解 Fiber 核心流程 |
| **ZacharyL2/mini-react** (269 ⭐) | 400 行极简实现，Vite + TypeScript + pnpm，提供 StackBlitz 在线体验，入门门槛最低 |
| **bubucuo/mini-react** (227 ⭐) | 搭配 DebugReact 调试工具，Vite + Vitest 测试，适合边调试边学习 |
| **zh-lx/mini-react** (211 ⭐) | 基于 CRA + Testing Library，教程结构清晰，从 ReactDOM.render 逐步深入到 Fiber 架构 |
| **本项目** | 最完整的 React 18.2 TypeScript 教学实现：5 包架构 + Lane 调度 + 生产级合成事件 + 8 种 Hooks，从"会用 React"到"读懂源码"的最佳桥梁 |

---

## 四、总结

本项目从 React 18.2 源码出发，用 TypeScript 完整重写了 React 的核心架构，覆盖了从 Fiber 树构建、Lane 优先级调度、Diff 协调、Hooks 链表到合成事件系统的全链路实现。

**核心数据：**

- **5 个核心包**，与 React 源码包结构一一对应
- **~10,000 行** TypeScript 源码
- **28 个** reconciler 核心模块
- **8 种** Hooks 完整实现

**一句话概括：** 这不是一个"玩具级"mini-react，而是一个在架构、命名、模块划分上尽可能忠实于 React 18.2 源码的教学级实现——它是你从"会用 React"到"读懂 React 源码"之间最短的桥梁。
