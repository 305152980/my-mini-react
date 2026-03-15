import type { WorkTag } from './ReactWorkTags'
import type { Flags } from './ReactFiberFlags'

// React Fiber 节点核心类型定义（Fiber 树的最小单元）
export type Fiber = {
  // 标识 Fiber 节点类型（如函数组件、类组件、原生DOM、Fragment、Portal等）
  tag: WorkTag

  // React 元素的 key 属性，用于列表 Diff 优化
  key: null | string

  // 元素原始类型（大部分情况与 type 一致，如 memo、lazy 包装组件时会区分）
  elementType: any

  // 组件/元素类型（如 div、函数组件、类组件、Symbol等）
  type: any

  // 对应真实 DOM 节点 或 类组件实例
  stateNode: any

  // 父 Fiber 节点（指向树结构的父级）
  return: Fiber | null

  // 子 Fiber 节点（第一个子节点）
  child: Fiber | null

  // 兄弟 Fiber 节点（同级下一个节点）
  sibling: Fiber | null

  // 在父节点所有子节点中的索引位置
  index: number

  // 新传入的 Props（待处理、待更新）
  pendingProps: any

  // 已生效的 Props（上一次渲染完成后确定的 props）
  memoizedProps: any

  // 已生效的状态（类组件的 state / 函数组件的 Hooks 链表）
  memoizedState: any

  // 副作用标记（标记节点需要执行的操作：插入、更新、删除、挂载、卸载等）
  flags: Flags

  // 双缓存机制：指向另一棵 Fiber 树的对应节点（current <-> workInProgress）
  alternate: Fiber | null
}

// 挂载容器类型：React 应用挂载的 DOM 根节点
// 对应 createRoot(rootNode) 中的 rootNode
export type Container = Element | Document | DocumentFragment

// Fiber 树根节点
// 全局唯一，管理整个应用的 Fiber 树、更新队列、渲染状态
export type FiberRoot = {
  // 挂载的 DOM 容器（应用渲染到哪个 DOM 节点上）
  containerInfo: Container

  // 当前页面【正在渲染/已渲染】的 Fiber 树 根节点
  current: Fiber

  // 【刚构建完成、等待提交】的 Fiber 树 根节点
  // 提交后会将 current 指向它
  finishedWork: Fiber | null
}
