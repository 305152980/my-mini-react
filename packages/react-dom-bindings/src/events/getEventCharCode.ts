/**
 * 获取键盘事件的字符码
 * charCode 表示实际的字符码，可与 String.fromCharCode 一起使用
 * 只有可打印字符才会产生有效的 charCode，Enter 键是例外
 *
 * @param nativeEvent - 原生键盘事件
 * @returns 标准化后的 charCode 值
 */
function getEventCharCode(nativeEvent: KeyboardEvent): number {
  let charCode: number
  const keyCode = nativeEvent.keyCode

  // 如果事件包含 charCode 属性
  if ('charCode' in nativeEvent) {
    charCode = nativeEvent.charCode

    // Firefox 对 Enter 键不设置 charCode，需要通过 keyCode 判断
    if (charCode === 0 && keyCode === 13) {
      charCode = 13
    }
  } else {
    // IE8 没有 charCode 属性，使用 keyCode 代替
    charCode = keyCode
  }

  // IE、Edge、Chrome、Safari 在按下 Ctrl 时会把 Enter 键报告为 charCode 10
  if (charCode === 10) {
    charCode = 13
  }

  // 过滤掉非可打印字符，但保留 Enter 键
  if (charCode >= 32 || charCode === 13) {
    return charCode
  }

  return 0
}

export default getEventCharCode
