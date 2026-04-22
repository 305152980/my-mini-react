import { type Fiber } from '@my-mini-react/react-reconciler'
import { getFiberCurrentPropsFromNode } from '../client/ReactDOMComponentTree'

function isInteractive(tag: string): boolean {
  return (
    tag === 'button' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea'
  )
}
/**
 * 判断是否应该阻止（忽略）当前的鼠标/点击事件
 *
 * @param name - 事件注册名称，例如 "onClick", "onMouseOver"
 * @param type - Fiber 节点的 type 属性。对于原生 DOM 节点（HostComponent），它是标签名的字符串（如 'button', 'input'）。
 *               在此函数中，主要用于获取 DOM 标签名以判断是否支持 disabled 属性。
 * @param props - 当前 DOM 节点上实际生效的属性集合 (Props)
 * @returns boolean - 如果返回 true，表示事件应被拦截，不执行用户的回调函数
 */
function shouldPreventMouseEvent(
  name: string,
  type: string,
  props: any
): boolean {
  switch (name) {
    case 'onClick':
    case 'onClickCapture':
    case 'onDoubleClick':
    case 'onDoubleClickCapture':
    case 'onMouseDown':
    case 'onMouseDownCapture':
    case 'onMouseMove':
    case 'onMouseMoveCapture':
    case 'onMouseUp':
    case 'onMouseUpCapture':
    case 'onMouseEnter':
      // 禁用的元素不能触发鼠标事件
      return !!(props.disabled && isInteractive(type))
    default:
      return false
  }
}
export function getListener(
  inst: Fiber,
  registrationName: string
): Function | null {
  const stateNode = inst.stateNode
  if (stateNode === null) {
    return null
  }
  // React 不直接从 inst 获取属性，是因为 Fiber 节点是“虚拟”的且可能处于“构建中”，而 stateNode（真实 DOM）及其挂载的属性代表了“已提交”的确定性状态。
  // 通过 getFiberCurrentPropsFromNode(inst.stateNode)，React 确保了事件系统看到的 Props 永远与用户肉眼看到的 UI 保持一致。
  const props = getFiberCurrentPropsFromNode(stateNode)
  if (props === null) {
    return null
  }
  const listener = props[registrationName]
  if (listener === undefined) {
    return null
  }
  if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
    return null
  }
  if (listener && typeof listener !== 'function') {
    throw Error(
      `Expected ${registrationName} listener to be a function, instead got a value of ${typeof listener} type.`
    )
  }
  return listener
}
