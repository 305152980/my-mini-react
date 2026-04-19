/**
 * 支持 onChange 立即触发的 input 类型
 * 这些类型的 input 在用户输入时会立即触发 change 事件
 */
const supportedInputTypes: { [key: string]: true | void } = {
  color: true,
  date: true,
  datetime: true,
  'datetime-local': true,
  email: true,
  month: true,
  number: true,
  password: true,
  range: true,
  search: true,
  tel: true,
  text: true,
  time: true,
  url: true,
  week: true,
}

/**
 * 判断元素是否为文本输入元素
 *
 * 文本输入元素包括：
 * - <input> 元素中支持文本输入的类型（text, email, password 等）
 * - <textarea> 元素
 *
 * @param elem - 要检查的 DOM 元素
 * @returns 如果是文本输入元素返回 true，否则返回 false
 */
function isTextInputElement(elem: HTMLElement | null): boolean {
  const nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase()

  if (nodeName === 'input') {
    // 检查 input 的 type 是否在支持的类型列表中
    return !!supportedInputTypes[(elem as HTMLInputElement).type]
  }

  if (nodeName === 'textarea') {
    // textarea 始终返回 true
    return true
  }

  return false
}

export default isTextInputElement
