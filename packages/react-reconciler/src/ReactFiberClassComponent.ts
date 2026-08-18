import type { Fiber } from './ReactInternalTypes'
import { emptyContextObject } from './ReactFiberContext'
import { readContext } from './ReactFiberNewContext'
import { set as setInstance } from '@my-mini-react/shared/ReactInstanceMap'
import { type Lanes } from './ReactFiberLane'
import {
  initializeUpdateQueue,
  processUpdateQueue,
  cloneUpdateQueue,
} from './ReactFiberClassUpdateQueue'
import shallowEqual from '@my-mini-react/shared/shallowEqual'
import { type Flags, Update, LayoutStatic, Snapshot } from './ReactFiberFlags'

/**
 * 绑定 Fiber 节点和类组件实例
 *
 * 作用：
 * - 建立 Fiber 节点和实例之间的双向关联
 * - Fiber 节点保存实例引用（workInProgress.stateNode = instance）
 * - 实例保存 Fiber 节点引用（instance._reactInternals = workInProgress）
 *
 * 为什么要双向关联？
 * - Fiber → 实例：在渲染时访问实例的 state、props 等
 * - 实例 → Fiber：在 setState/forceUpdate 时访问 Fiber 节点，触发更新
 *
 * @param workInProgress - 当前 Fiber 节点
 * @param instance - 类组件实例
 */
export function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  // // 给组件实例注入真正的 updater，让 setState 和 forceUpdate 能够正常工作。
  // instance.updater = classComponentUpdater

  // 让 Fiber 节点保存组件实例，建立 Fiber 到实例的引用。
  workInProgress.stateNode = instance

  // 让组件实例能够找到对应的 Fiber 节点，建立实例到 Fiber 的映射。
  setInstance(instance, workInProgress)
}

/**
 * 构造类组件实例
 *
 * 组件使用新版 Context API 的方式。
 * const ThemeContext = React.createContext('light')
 * class ThemedButton extends React.Component {
 *   static contextType = ThemeContext
 *   render() {
 *     const theme = this.context
 *     return <button className={theme}>按钮</button>
 *   }
 * }
 *
 * 作用：
 * - 创建类组件的实例
 * - 获取 context（支持新版 Context API）
 * - 将实例与 Fiber 节点绑定
 * - 保存初始 state 到 Fiber 节点
 *
 * @param workInProgress - 当前 Fiber 节点
 * @param ctor - 类组件构造函数
 * @param props - 属性
 * @returns 类组件实例
 */
export function constructClassInstance(
  workInProgress: Fiber,
  ctor: any,
  props: any
): any {
  // 处理新版 Context API（React.createContext）。
  let context = emptyContextObject
  const contextType = ctor.contextType

  // 检查组件是否使用了新版 Context API。
  // 如果声明了 static contextType = MyContext，则读取 Context 值。
  if (typeof contextType === 'object' && contextType !== null) {
    // 从 Context 对象中读取当前值。
    context = readContext(contextType as any)
  }

  // 创建 Class 组件实例。
  // 传入 props 和 context，让构造函数可以访问 this.props 和 this.context。
  // React.Component 基类会将它们赋值到 this.props 和 this.context。
  let instance = new ctor(props, context)

  // 保存组件的初始 state 到 Fiber 节点上。
  workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null

  // 这个函数是在将 Fiber 节点和 Class 组件实例互相绑定，建立双向关联。
  adoptClassInstance(workInProgress, instance)

  return instance
}

/**
 * 挂载类组件实例
 *
 * 作用：
 * - 初始化实例的 props、state、refs、context
 * - 初始化更新队列
 * - 处理更新队列
 *
 * 注意：
 * - 这是简化版本，删除了旧版 Context API 和旧版生命周期
 * - 只保留新版 Context API（static contextType）
 * - 只保留新版生命周期（getDerivedStateFromProps）
 *
 * @param workInProgress - 当前 Fiber 节点
 * @param ctor - 类组件构造函数
 * @param newProps - 新的属性
 * @param renderLanes - 渲染车道
 */
export function mountClassInstance(
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes
): void {
  // 获取实例。
  //   实例已经在 constructClassInstance 中创建。
  const instance = workInProgress.stateNode
  // 初始化实例的基本属性。
  //   设置 props。
  instance.props = newProps
  //   设置 state（初始 state）。
  instance.state = workInProgress.memoizedState
  // TODO: 待实现。
  // instance.refs = emptyRefsObject

  // 初始化更新队列。
  //   创建 updateQueue，用于存储 setState 等更新的队列。
  initializeUpdateQueue(workInProgress)

  // 获取 context（新版 Context API）。
  const contextType = ctor.contextType
  if (typeof contextType === 'object' && contextType !== null) {
    instance.context = readContext(contextType)
  } else {
    // 没有使用 Context API，使用空上下文。
    instance.context = emptyContextObject
  }

  // 更新 state。
  instance.state = workInProgress.memoizedState

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps
  if (typeof getDerivedStateFromProps === 'function') {
    // 实现，略。
    // // 根据 props 计算新的 state。更新 workInProgress.memoizedState。更新 instance.state。
    // applyDerivedStateFromProps(
    //   workInProgress,
    //   ctor,
    //   getDerivedStateFromProps,
    //   newProps
    // )
    // instance.state = workInProgress.memoizedState
  }

  // 处理更新队列。
  //   如果没有 getDerivedStateFromProps 和 getSnapshotBeforeUpdate。
  //   处理更新队列（setState 等）。
  if (
    typeof ctor.getDerivedStateFromProps !== 'function' &&
    typeof instance.getSnapshotBeforeUpdate !== 'function'
  ) {
    // 处理更新队列，可能会更新 state。
    processUpdateQueue(workInProgress, newProps, instance, renderLanes)
    // 更新实例的 state。
    instance.state = workInProgress.memoizedState
  }

  if (typeof instance.componentDidMount === 'function') {
    // 给 Fiber 节点添加 Update 标志，表示需要在 commit 阶段调用 componentDidUpdate 生命周期。
    let fiberFlags: Flags = Update
    fiberFlags |= LayoutStatic
    workInProgress.flags |= fiberFlags
  }
}

/**
 * 检查组件是否应该更新
 *
 * 作用：
 * - 判断组件是否需要重新渲染
 * - 用于优化性能，避免不必要的渲染
 *
 * 判断逻辑：
 * 1. 如果组件定义了 shouldComponentUpdate，使用组件自己的判断
 * 2. 如果是 PureComponent，使用浅比较
 * 3. 默认需要更新
 *
 * @param workInProgress - 当前 Fiber 节点
 * @param ctor - 类组件构造函数
 * @param oldProps - 旧的属性
 * @param newProps - 新的属性
 * @param oldState - 旧的状态
 * @param newState - 新的状态
 * @param nextContext - 新的上下文
 * @returns 是否应该更新
 */
function checkShouldComponentUpdate(
  workInProgress: Fiber,
  ctor: any,
  oldProps: any,
  newProps: any,
  oldState: any,
  newState: any,
  nextContext: any
): boolean {
  const instance = workInProgress.stateNode

  // 如果组件定义了 shouldComponentUpdate，使用组件自己的判断。
  if (typeof instance.shouldComponentUpdate === 'function') {
    let shouldUpdate = instance.shouldComponentUpdate(
      newProps,
      newState,
      nextContext
    )
    return shouldUpdate
  }

  // 如果是 PureComponent，使用浅比较。
  //   class MyComponent extends React.PureComponent {
  //     render() {
  //       return <div>{this.props.value}</div>
  //     }
  //   }
  //   // React 内部会设置：
  //   MyComponent.prototype.isPureReactComponent = true
  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return (
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    )
  }

  // 默认需要更新。
  return true
}

/**
 * 更新类组件实例
 *
 * 作用：
 * - 更新类组件的实例
 * - 处理更新队列
 * - 调用生命周期方法
 * - 判断是否需要重新渲染
 *
 * 主要流程：
 * 1. 克隆更新队列
 * 2. 获取 context
 * 3. 处理更新队列
 * 4. 检查是否可以 bailout（跳过渲染）
 * 5. 调用 getDerivedStateFromProps
 * 6. 调用 shouldComponentUpdate
 * 7. 标记生命周期方法
 * 8. 同步 props、state、context
 *
 * @param current - 当前 Fiber 节点（旧的）
 * @param workInProgress - 新 Fiber 节点
 * @param ctor - 类组件构造函数
 * @param newProps - 新的属性
 * @param renderLanes - 渲染车道
 * @returns 是否应该更新（是否需要重新渲染）
 */
export function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes
): boolean {
  const instance = workInProgress.stateNode

  cloneUpdateQueue(current, workInProgress)

  const oldProps = workInProgress.memoizedProps
  instance.props = oldProps

  const oldContext = instance.context
  const contextType = ctor.contextType
  let nextContext = emptyContextObject
  if (typeof contextType === 'object' && contextType !== null) {
    nextContext = readContext(contextType)
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function'

  // // 重置 forceUpdate 标记，为当前组件更新周期做准备。
  // resetHasForceUpdateBeforeProcessing()

  const oldState = workInProgress.memoizedState
  let newState = (instance.state = oldState)
  processUpdateQueue(workInProgress, newProps, instance, renderLanes)
  newState = workInProgress.memoizedState

  // 这里的 if 条件被简化了。
  // 当 props、state、context 都没变化时，跳过不必要的渲染。
  // updateClassInstance 被调用时，current 一定不为 null。
  if (oldProps === newProps && oldState === newState) {
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        // 给 Fiber 节点添加 Update 标志，表示需要在 commit 阶段调用 componentDidUpdate 生命周期。
        workInProgress.flags |= Update
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        // 给 Fiber 节点添加 Snapshot 标志，表示需要在 commit 阶段调用 getSnapshotBeforeUpdate 生命周期。
        workInProgress.flags |= Snapshot
      }
    }
    return false
  }

  if (typeof getDerivedStateFromProps === 'function') {
    // 实现，略。
    // applyDerivedStateFromProps(
    //   workInProgress,
    //   ctor,
    //   getDerivedStateFromProps,
    //   newProps
    // )
    // newState = workInProgress.memoizedState
  }

  // 为 true 的情况（任意一个）：
  //   调用了 forceUpdate；
  //   shouldComponentUpdate 返回 true；
  //   props/state 有变化（PureComponent）；
  //   没有 shouldComponentUpdate（默认更新）；
  //   Context 变化了。
  // 为 false 的情况（必须全部满足）：
  //   没有调用 forceUpdate；
  //   shouldComponentUpdate 返回 false；
  //   或者 PureComponent，props/state 都没变；
  //   Context 没有变化。
  // 常见场景：
  //   forceUpdate() → true；
  //   shouldComponentUpdate 返回 true → true；
  //   shouldComponentUpdate 返回 false → false；
  //   PureComponent, props 变化 → true；
  //   PureComponent, props 没变 → false；
  //   普通组件，没有 shouldComponentUpdate → true。

  // 这里的 shouldUpdate 赋值被简化了。
  const shouldUpdate = checkShouldComponentUpdate(
    workInProgress,
    ctor,
    oldProps,
    newProps,
    oldState,
    newState,
    nextContext
  )
  if (shouldUpdate) {
    // 当组件需要重新渲染时：
    //   在 updateClassInstance 函数中：只负责标记生命周期（Update、Snapshot 标志），不同步 memoizedProps 和 memoizedState。
    // 返回后，执行 finishClassComponent 函数：
    //   调用 instance.render() 执行渲染。
    //   渲染完成后，在第 1253 行同步：workInProgress.memoizedState = instance.state。
    //   注意：这里只同步了 memoizedState，没有同步 memoizedProps。
    //   继续执行 performUnitOfWork 函数（在 ReactFiberWorkLoop.new.js 中）：
    //     在第 1853 行统一同步：unitOfWork.memoizedProps = unitOfWork.pendingProps。
    //     这行代码在 beginWork 之后执行，无论什么组件都会执行。
    // 所以：shouldUpdate = true 时，不需要在 updateClassInstance 中同步，因为后续会在两个地方分别同步 memoizedState 和 memoizedProps。

    if (typeof instance.componentDidUpdate === 'function') {
      workInProgress.flags |= Update
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      workInProgress.flags |= Snapshot
    }
  } else {
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Update
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Snapshot
      }
    }

    // 即使 shouldComponentUpdate 返回 false（跳过渲染），也要同步 props/state。
    workInProgress.memoizedProps = newProps
    workInProgress.memoizedState = newState
  }

  // 同步组件实例的 props、state、context 指针，确保实例访问到的是最新的值。
  instance.props = newProps
  instance.state = newState
  instance.context = nextContext

  return shouldUpdate
}
