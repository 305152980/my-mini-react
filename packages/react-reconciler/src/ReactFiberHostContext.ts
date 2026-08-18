import type { Fiber } from './ReactInternalTypes'
import { createCursor, push, pop, type StackCursor } from './ReactFiberStack'
import {
  type Container,
  type HostContext,
  getChildHostContext,
  getRootHostContext,
} from 'ReactFiberHostConfig'

// 用于表示"没有上下文"的特殊标记。
// 当栈为空或没有上下文时，使用这个标记。
declare class NoContextT {}
const NO_CONTEXT: NoContextT = {} as NoContextT

// 上下文栈游标。
//   存储 HostContext（宿主上下文）。
//   例如：命名空间（SVG、MathML 等）。
// 在 beginWork 处理 HostComponent 时压入。
// 在 completeWork 处理 HostComponent 时弹出。
const contextStackCursor: StackCursor<HostContext | NoContextT> =
  createCursor(NO_CONTEXT)
// Fiber 栈游标。
//   存储与 HostContext 关联的 Fiber 节点。
//   用于追踪上下文是由哪个 Fiber 创建的。与 contextStackCursor 配对使用。
const contextFiberStackCursor: StackCursor<Fiber | NoContextT> =
  createCursor(NO_CONTEXT)
// 根容器栈游标。
//   存储根容器信息（如 document.getElementById('root')）。
//   用于知道当前渲染到哪个容器。
// 在 beginWork 处理 HostRoot 时压入。
// 在 completeWork 处理 HostRoot 时弹出。
const rootInstanceStackCursor: StackCursor<Container | NoContextT> =
  createCursor(NO_CONTEXT)

/**
 * 将根容器的上下文压入栈中
 *
 * 作用：
 * - 将根容器信息压入 rootInstanceStackCursor 栈
 * - 将 fiber 压入 contextFiberStackCursor 栈（记录上下文来源）
 * - 获取并压入根容器的命名空间到 contextStackCursor 栈
 *
 * @param fiber - 当前 Fiber 节点
 * @param nextRootInstance - 根容器实例（如 document.getElementById('root')）
 */
export function pushHostContainer(
  fiber: Fiber,
  nextRootInstance: Container
): void {
  // 将根容器压入 rootInstanceStackCursor 栈。
  push(rootInstanceStackCursor, nextRootInstance, fiber)
  // 将 fiber 压入 contextFiberStackCursor 栈。
  push(contextFiberStackCursor, fiber, fiber)
  // 先压入 NO_CONTEXT 占位。
  push(contextStackCursor, NO_CONTEXT, fiber)
  // 获取根容器的实际命名空间。
  //   例如：'http://www.w3.org/1999/xhtml'（HTML）。
  //   或：'http://www.w3.org/2000/svg'（SVG）。
  const nextRootContext = getRootHostContext(nextRootInstance)
  // 弹出占位的 NO_CONTEXT。
  pop(contextStackCursor, fiber)
  // 替换为实际的命名空间。
  push(contextStackCursor, nextRootContext, fiber)
}

/**
 * 获取必需的上下文
 *
 * 作用：
 * - 确保上下文存在
 * - 如果上下文不存在，抛出错误
 * - 用于类型断言，将 Value | NoContextT 转换为 Value
 *
 * 使用场景：
 * - 在需要上下文的地方调用
 * - 例如：getRootHostContainer()
 *
 * @param c - 上下文值（可能是 NoContextT）
 * @returns 上下文值（确保不是 NoContextT）
 * @throws 如果上下文不存在，抛出错误
 */
function requiredContext<Value>(c: Value | NoContextT): Value {
  if (c === NO_CONTEXT) {
    throw new Error(
      'Expected host context to exist. This error is likely caused by a bug ' +
        'in React. Please file an issue.'
    )
  }

  return c as Value
}

/**
 * 将宿主上下文压入栈中
 *
 * 作用：
 * - 获取当前上下文
 * - 根据当前上下文和元素类型，计算子上下文
 * - 如果子上下文与当前上下文不同，压入栈中
 * - 用于追踪命名空间的变化（如从 HTML 进入 SVG）
 *
 * 为什么只在上下文唯一时才压入？
 * - 避免不必要的栈操作
 * - 只有命名空间真正变化时才需要压入
 * - 在 completeWork 时，只弹出有变化的上下文
 *
 * @param fiber - 当前 Fiber 节点
 */
export function pushHostContext(fiber: Fiber): void {
  // 获取根容器。
  //   从 rootInstanceStackCursor 栈中获取根容器。
  //   例如：document.getElementById('root')。
  const rootInstance: Container = requiredContext(
    rootInstanceStackCursor.current
  )
  // 获取当前上下文。
  //   从 contextStackCursor 栈中获取当前命名空间。
  //   例如：'http://www.w3.org/1999/xhtml'（HTML）。
  const context: HostContext = requiredContext(contextStackCursor.current)

  // 计算子上下文。
  //   根据当前上下文、元素类型和根容器，计算子命名空间。
  //   例如：
  //     当前是 HTML，元素是 <svg> → 子上下文是 SVG_NAMESPACE。
  //     当前是 HTML，元素是 <div> → 子上下文是 HTML_NAMESPACE。
  const nextContext = getChildHostContext(context, fiber.type, rootInstance)

  // 检查是否需要压入。
  //   如果子上下文与当前上下文相同，不需要压入。避免不必要的栈操作。
  if (context === nextContext) {
    return
  }

  // 压入新的上下文。
  //   记录上下文是由哪个 Fiber 提供的，这样在 completeWork 时，只弹出有变化的上下文。
  //   压入新的命名空间。
  push(contextFiberStackCursor, fiber, fiber)
  push(contextStackCursor, nextContext, fiber)
}

/**
 * 弹出宿主容器上下文
 *
 * 作用：
 * - 在 completeWork 中，弹出宿主容器上下文
 * - 恢复父节点的宿主容器
 *
 * 实现：
 * - 从栈中弹出三个上下文：
 *   1. contextStackCursor：宿主上下文（命名空间）
 *   2. contextFiberStackCursor：宿主 Fiber 节点
 *   3. rootInstanceStackCursor：根宿主容器
 *
 * 使用场景：
 * - 在 HostRoot 的 completeWork 中调用
 * - 完成根节点的渲染后，弹出宿主容器
 */
export function popHostContainer(fiber: Fiber): void {
  // 弹出宿主上下文。
  pop(contextStackCursor, fiber)
  // 弹出宿主 Fiber 节点。
  pop(contextFiberStackCursor, fiber)
  // 弹出根宿主容器。
  pop(rootInstanceStackCursor, fiber)
}

/**
 * 弹出宿主上下文
 *
 * 作用：
 * - 在 completeWork 中，弹出宿主上下文
 * - 恢复父节点的宿主上下文
 *
 * 实现：
 * - 检查当前宿主 Fiber 节点是否是当前 Fiber
 * - 如果不是，直接返回（不弹出）
 * - 如果是，弹出两个上下文：
 *   1. contextStackCursor：宿主上下文（命名空间）
 *   2. contextFiberStackCursor：宿主 Fiber 节点
 *
 * 为什么检查 contextFiberStackCursor.current !== fiber？
 * - 因为 pushHostContext 只有在命名空间变化时才 push
 * - 如果命名空间没有变化，不会 push
 * - 所以 pop 时也要检查
 *
 * 使用场景：
 * - 在 HostComponent 的 completeWork 中调用
 * - 完成原生组件的渲染后，弹出宿主上下文
 */
export function popHostContext(fiber: Fiber): void {
  // 检查当前宿主 Fiber 节点是否是当前 Fiber。
  if (contextFiberStackCursor.current !== fiber) {
    // 如果不是，直接返回（不弹出）。
    return
  }

  // 弹出宿主上下文。
  pop(contextStackCursor, fiber)
  // 弹出宿主 Fiber 节点。
  pop(contextFiberStackCursor, fiber)
}

/**
 * 获取根宿主容器
 *
 * 作用：
 * - 获取当前渲染的根宿主容器
 * - 例如：ReactDOM.render 的容器（如 document.getElementById('root')）
 *
 * 实现：
 * - 从栈中获取根宿主容器
 * - 使用 requiredContext 确保容器存在
 *
 * 返回值：
 * - 根宿主容器（Container 类型）
 *
 * 使用场景：
 * - 在 completeWork 中创建 DOM 节点时
 * - 需要知道根容器，用于创建正确的 DOM 节点
 */
export function getRootHostContainer(): Container {
  const rootInstance = requiredContext(rootInstanceStackCursor.current)
  return rootInstance
}

/**
 * 获取宿主上下文
 *
 * 作用：
 * - 获取当前 Fiber 节点的宿主上下文
 * - 例如：命名空间（HTML、SVG、MathML）
 *
 * 实现：
 * - 从栈中获取宿主上下文
 * - 使用 requiredContext 确保上下文存在
 *
 * 返回值：
 * - 宿主上下文（HostContext 类型）
 *
 * 使用场景：
 * - 在 completeWork 中创建 DOM 节点时
 * - 需要知道当前的命名空间，用于创建正确的 DOM 节点
 * - 例如：创建 SVG 元素需要 SVG 命名空间
 */
export function getHostContext(): HostContext {
  const context = requiredContext(contextStackCursor.current)
  return context
}
