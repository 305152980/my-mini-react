import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import {
  createContainer,
  updateContainer,
  type FiberRoot,
} from '@my-mini-react/react-reconciler'
import { markContainerAsRoot } from './ReactDOMComponentTree'
import { listenToAllSupportedEvents } from '../events/DOMPluginEventSystem'
import { type Container } from './ReactDOMHostConfig'

export type CreateRootOptions = {
  [key: string]: any
}

export type RootType = {
  _internalRoot: FiberRoot | null
  render: (children: ReactNodeList) => void
  unmount: () => void
  [key: string]: any
}

type ReactDOMRootCtor = new (_internalRoot: FiberRoot) => RootType
const ReactDOMRoot: ReactDOMRootCtor = function (
  this: RootType,
  _internalRoot: FiberRoot
): void {
  this._internalRoot = _internalRoot
} as unknown as ReactDOMRootCtor
ReactDOMRoot.prototype.render = function (children: ReactNodeList): void {
  updateContainer(children, this._internalRoot)
}
ReactDOMRoot.prototype.unmount = function (): void {
  // TODO: 暂不实现。
}

/**
 * 创建 React 应用的根节点实例 (RootType)
 * @param container - 用于挂载 React 应用的真实 DOM 容器元素
 * @returns 返回一个包含 render 和 unmount 方法的 RootType 实例
 */
function createRoot(
  container: Container,
  options?: CreateRootOptions
): RootType {
  // 1. 创建 React 内部的 Fiber 根节点 (FiberRoot)
  // 调用协调器(Reconciler)的 createContainer 方法，在内存中初始化整个应用的 Fiber 架构
  const root = createContainer(container)

  // 2. 在真实 DOM 容器上标记为 React 根节点
  // 将 Fiber 根节点挂载到 DOM 元素的内部属性上，建立 DOM 与 React 内部的强关联，
  // 以便后续通过 DOM 节点快速反向查找对应的 Fiber 实例
  markContainerAsRoot(root.current, container)

  // 3. 确定事件委托的宿主元素
  // 正常情况下直接使用传入的 container。
  // (注：在 SSR 水合等特殊场景中，如果 container 是注释节点，这里通常会取其父元素作为真正的宿主)
  const rootContainerElement: Document | Element | DocumentFragment = container
  // 4. 初始化全局事件委托系统
  // 将 React 支持的所有合成事件（如 onClick, onChange 等）通过事件委托机制，
  // 统一绑定到宿主元素上，由 React 内部统一拦截和分发处理
  listenToAllSupportedEvents(rootContainerElement)

  // 5. 返回面向开发者的根节点操作实例
  // 实例化 ReactDOMRoot 并返回，开发者后续将通过该实例调用 root.render() 进行渲染
  return new ReactDOMRoot(root)
}

export { createRoot }
