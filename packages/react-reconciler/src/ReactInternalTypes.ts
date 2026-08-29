import type { WorkTag } from './ReactWorkTags'
import type { Flags } from './ReactFiberFlags'
import type { Lane, Lanes } from './ReactFiberLane'
import type { ReactContext } from '@my-mini-react/shared/ReactTypes'
import type { Container } from 'ReactFiberHostConfig'

export type Dependencies = {
  lanes: Lanes
  firstContext: ContextDependency<any> | null
  [key: string]: any
}

export type ContextDependency<T> = {
  context: ReactContext<T>
  next: ContextDependency<unknown> | null
  memoizedValue: T
  [key: string]: any
}

// React Fiber 节点核心类型定义（Fiber 树的最小单元）
export type Fiber = {
  // 标识 Fiber 节点类型（如函数组件、类组件、原生DOM、Fragment、Portal等）
  tag: WorkTag
  // 元素原始类型（大部分情况与 type 一致，如 memo、lazy 包装组件时会区分）
  elementType: any
  // 组件/元素类型（如 div、函数组件、类组件、Symbol等）
  type: any

  // 对应真实 DOM 节点 或 类组件实例
  stateNode: any

  // 子 Fiber 节点（第一个子节点）
  child: Fiber | null
  // 兄弟 Fiber 节点（同级下一个节点）
  sibling: Fiber | null
  // 父 Fiber 节点（指向树结构的父级）
  return: Fiber | null
  // 双缓存机制：指向另一棵 Fiber 树的对应节点（current <-> workInProgress）
  alternate: Fiber | null

  // React 元素的 key 属性，用于列表 Diff 优化
  key: null | string
  // 在父节点所有子节点中的索引位置
  index: number

  // 新传入的 Props（待处理、待更新）
  pendingProps: any
  // 已生效的 Props（上一次渲染完成后确定的 props）
  memoizedProps: any

  // 副作用标记（标记节点需要执行的操作：插入、更新、删除、挂载、卸载等）
  flags: Flags
  // 记录了当前 Fiber 节点的所有后代节点中，是否存在需要执行的副作用（如插入、更新、删除等）。
  // 在提交（commit）阶段，React 会根据这个标记来快速判断是否需要遍历当前节点的子树。
  subtreeFlags: Flags
  // 【当前节点的优先级车道】
  // 1. 它是一个位掩码（Bitmask），用来标记当前 Fiber 节点自身有哪些待处理的更新任务，以及这些任务的优先级。
  // 2. 不同的“车道”代表不同的优先级，比如：用户输入（点击、打字）走高优先级车道，数据加载或过渡动画走低优先级车道。
  // 3. 在渲染（Render）阶段，React 会根据这个属性判断当前节点是否需要被更新。
  lanes: Lanes
  // 【子树优先级车道集合】
  // 1. 它是当前 Fiber 节点所有后代（子树）中，待处理更新任务优先级的集合。
  // 2. 作用是“向上汇报”和“快速剪枝”：
  //    - 向上汇报：子节点有更新时，会把优先级合并到父节点的 childLanes，一路传递到根节点。
  //    - 快速剪枝：在遍历 Fiber 树时，如果父节点的 childLanes 与当前渲染的优先级没有交集，React 就可以直接跳过整个庞大的子树，无需继续向下遍历，极大提升性能。
  childLanes: Lanes

  // 已生效的状态（类组件的 state / 函数组件的 Hooks 链表）
  memoizedState: any
  // 存储待处理的更新（如 setState 产生的更新对象链表）。
  // 20260407 在 useLayoutEffect 和 useEffect 中用到过 updateQueue。
  updateQueue: any

  // 删除的子节点列表（仅在协调阶段使用，标记需要删除的节点，提交阶段会根据它们执行删除操作）
  deletions: Array<Fiber> | null

  // 存储当前 Fiber 节点依赖的 Context 依赖链表，用于 Context 更新时判断是否需要重新渲染。
  dependencies: Dependencies | null

  [key: string]: any
}

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

  // 未处理的 Lanes。
  pendingLanes: Lanes
  // 已处理的 Lanes。
  finishedLanes: Lanes

  // 当前正在运行的调度回调（用于中断）
  callbackNode: any
  // 当前回调的优先级
  callbackPriority: Lane

  [key: string]: any
}

export type Dispatcher = {
  // TODO: 暂时这样写。
  [key: string]: any
}
