import type { Fiber } from '@my-mini-react/react-reconciler'
import assign from '@my-mini-react/shared/assign'
import getEventCharCode from './getEventCharCode'

// 事件接口类型定义
type EventInterfaceType = {
  [propName: string]: 0 | ((event: { [propName: string]: any }) => any)
}

// 合成事件构造函数类型
type SyntheticEventConstructor = new (
  reactName: string | null,
  reactEventType: string,
  targetInst: Fiber | null,
  nativeEvent: { [propName: string]: any },
  nativeEventTarget: null | EventTarget
) => any

function functionThatReturnsTrue(): boolean {
  return true
}

function functionThatReturnsFalse(): boolean {
  return false
}

// 使用工厂函数创建不同的合成事件构造函数，避免引擎优化问题
function createSyntheticEvent(
  Interface: EventInterfaceType
): SyntheticEventConstructor {
  function SyntheticBaseEvent(
    this: any,
    reactName: string | null,
    reactEventType: string,
    targetInst: Fiber | null,
    nativeEvent: { [propName: string]: any },
    nativeEventTarget: null | EventTarget
  ) {
    this._reactName = reactName
    this._targetInst = targetInst
    this.type = reactEventType
    this.nativeEvent = nativeEvent
    this.target = nativeEventTarget
    this.currentTarget = null

    // 标准化事件属性
    for (const propName in Interface) {
      if (!Interface.hasOwnProperty(propName)) {
        continue
      }
      const normalize = Interface[propName]
      if (normalize) {
        this[propName] = normalize(nativeEvent)
      } else {
        this[propName] = nativeEvent[propName]
      }
    }

    // 处理默认阻止状态
    const defaultPrevented =
      nativeEvent.defaultPrevented != null
        ? nativeEvent.defaultPrevented
        : nativeEvent.returnValue === false
    if (defaultPrevented) {
      this.isDefaultPrevented = functionThatReturnsTrue
    } else {
      this.isDefaultPrevented = functionThatReturnsFalse
    }
    this.isPropagationStopped = functionThatReturnsFalse
    return this
  }

  // 添加原型方法
  assign(SyntheticBaseEvent.prototype, {
    // 阻止默认行为
    preventDefault: function (this: any) {
      this.defaultPrevented = true
      const event = this.nativeEvent
      if (!event) {
        return
      }

      if (event.preventDefault) {
        event.preventDefault()
      } else if ((event as any).returnValue !== undefined) {
        ;(event as any).returnValue = false
      }
      this.isDefaultPrevented = functionThatReturnsTrue
    },

    // 阻止事件传播
    stopPropagation: function (this: any) {
      const event = this.nativeEvent
      if (!event) {
        return
      }

      if (event.stopPropagation) {
        event.stopPropagation()
      } else if ((event as any).cancelBubble !== undefined) {
        // IE 特定处理
        ;(event as any).cancelBubble = true
      }

      this.isPropagationStopped = functionThatReturnsTrue
    },

    // 持久化事件（现代事件系统不使用池化）
    persist: function () {},

    // 检查事件是否应该被释放回池
    isPersistent: functionThatReturnsTrue,
  })

  return SyntheticBaseEvent as unknown as SyntheticEventConstructor
}

// 基础事件接口
const EventInterface: EventInterfaceType = {
  eventPhase: 0,
  bubbles: 0,
  cancelable: 0,
  timeStamp: function (event: { [propName: string]: any }) {
    return event.timeStamp || Date.now()
  },
  defaultPrevented: 0,
  isTrusted: 0,
}
export const SyntheticEvent = createSyntheticEvent(EventInterface)

// UI 事件接口
const UIEventInterface: EventInterfaceType = {
  ...EventInterface,
  view: 0,
  detail: 0,
}
export const SyntheticUIEvent = createSyntheticEvent(UIEventInterface)

// 鼠标移动距离的 polyfill 状态
let lastMovementX = 0
let lastMovementY = 0
let lastMouseEvent: { [propName: string]: any } | undefined

function updateMouseMovementPolyfillState(event: { [propName: string]: any }) {
  if (event !== lastMouseEvent) {
    if (lastMouseEvent && event.type === 'mousemove') {
      lastMovementX = event.screenX - lastMouseEvent.screenX
      lastMovementY = event.screenY - lastMouseEvent.screenY
    } else {
      lastMovementX = 0
      lastMovementY = 0
    }
    lastMouseEvent = event
  }
}

// 修饰键状态获取器
const modifierKeyToProp: { [key: string]: string } = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Meta: 'metaKey',
  Shift: 'shiftKey',
}

function modifierStateGetter(this: any, keyArg: string): boolean {
  const syntheticEvent = this
  const nativeEvent = syntheticEvent.nativeEvent
  if (nativeEvent.getModifierState) {
    return nativeEvent.getModifierState(keyArg)
  }
  const keyProp = modifierKeyToProp[keyArg]
  return keyProp ? !!nativeEvent[keyProp] : false
}

function getEventModifierState(nativeEvent: { [propName: string]: any }) {
  return modifierStateGetter
}

// 鼠标事件接口
const MouseEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  pageX: 0,
  pageY: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  getModifierState: getEventModifierState,
  button: 0,
  buttons: 0,
  relatedTarget: function (event: { [propName: string]: any }) {
    if (event.relatedTarget === undefined)
      return event.fromElement === event.srcElement
        ? event.toElement
        : event.fromElement
    return event.relatedTarget
  },
  movementX: function (event: { [propName: string]: any }) {
    if ('movementX' in event) {
      return event.movementX
    }
    updateMouseMovementPolyfillState(event)
    return lastMovementX
  },
  movementY: function (event: { [propName: string]: any }) {
    if ('movementY' in event) {
      return event.movementY
    }
    return lastMovementY
  },
}

export const SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface)

// 拖拽事件接口
const DragEventInterface: EventInterfaceType = {
  ...MouseEventInterface,
  dataTransfer: 0,
}
export const SyntheticDragEvent = createSyntheticEvent(DragEventInterface)

// 焦点事件接口
const FocusEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  relatedTarget: 0,
}
export const SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface)

// 动画事件接口
const AnimationEventInterface: EventInterfaceType = {
  ...EventInterface,
  animationName: 0,
  elapsedTime: 0,
  pseudoElement: 0,
}
export const SyntheticAnimationEvent = createSyntheticEvent(
  AnimationEventInterface
)

// 剪贴板事件接口
const ClipboardEventInterface: EventInterfaceType = {
  ...EventInterface,
  clipboardData: function (event: { [propName: string]: any }) {
    return 'clipboardData' in event
      ? event.clipboardData
      : (window as any).clipboardData
  },
}
export const SyntheticClipboardEvent = createSyntheticEvent(
  ClipboardEventInterface
)

// 组合事件接口
const CompositionEventInterface: EventInterfaceType = {
  ...EventInterface,
  data: 0,
}
export const SyntheticCompositionEvent = createSyntheticEvent(
  CompositionEventInterface
)

// 输入事件（复用组合事件）
export const SyntheticInputEvent = SyntheticCompositionEvent

// 键盘按键标准化
const normalizeKey: { [key: string]: string } = {
  Esc: 'Escape',
  Spacebar: ' ',
  Left: 'ArrowLeft',
  Up: 'ArrowUp',
  Right: 'ArrowRight',
  Down: 'ArrowDown',
  Del: 'Delete',
  Win: 'OS',
  Menu: 'ContextMenu',
  Apps: 'ContextMenu',
  Scroll: 'ScrollLock',
  MozPrintableKey: 'Unidentified',
}

// keyCode 到 key 的映射
const translateToKey: { [key: string]: string } = {
  '8': 'Backspace',
  '9': 'Tab',
  '12': 'Clear',
  '13': 'Enter',
  '16': 'Shift',
  '17': 'Control',
  '18': 'Alt',
  '19': 'Pause',
  '20': 'CapsLock',
  '27': 'Escape',
  '32': ' ',
  '33': 'PageUp',
  '34': 'PageDown',
  '35': 'End',
  '36': 'Home',
  '37': 'ArrowLeft',
  '38': 'ArrowUp',
  '39': 'ArrowRight',
  '40': 'ArrowDown',
  '45': 'Insert',
  '46': 'Delete',
  '112': 'F1',
  '113': 'F2',
  '114': 'F3',
  '115': 'F4',
  '116': 'F5',
  '117': 'F6',
  '118': 'F7',
  '119': 'F8',
  '120': 'F9',
  '121': 'F10',
  '122': 'F11',
  '123': 'F12',
  '144': 'NumLock',
  '145': 'ScrollLock',
  '224': 'Meta',
}

// 获取标准化的按键值
function getEventKey(nativeEvent: { [propName: string]: any }): string {
  if (nativeEvent.key) {
    const key = normalizeKey[nativeEvent.key] || nativeEvent.key
    if (key !== 'Unidentified') {
      return key
    }
  }

  // 浏览器不支持 key 属性时的 polyfill
  if (nativeEvent.type === 'keypress') {
    const charCode = getEventCharCode(nativeEvent as KeyboardEvent)
    return charCode === 13 ? 'Enter' : String.fromCharCode(charCode)
  }
  if (nativeEvent.type === 'keydown' || nativeEvent.type === 'keyup') {
    return translateToKey[nativeEvent.keyCode] || 'Unidentified'
  }
  return ''
}

// 键盘事件接口
const KeyboardEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  key: getEventKey,
  code: 0,
  location: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  repeat: 0,
  locale: 0,
  getModifierState: getEventModifierState,
  charCode: function (event: { [propName: string]: any }) {
    if (event.type === 'keypress') {
      return getEventCharCode(event as KeyboardEvent)
    }
    return 0
  },
  keyCode: function (event: { [propName: string]: any }) {
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode
    }
    return 0
  },
  which: function (event: { [propName: string]: any }) {
    if (event.type === 'keypress') {
      return getEventCharCode(event as KeyboardEvent)
    }
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode
    }
    return 0
  },
}

export const SyntheticKeyboardEvent = createSyntheticEvent(
  KeyboardEventInterface
)

// 指针事件接口
const PointerEventInterface: EventInterfaceType = {
  ...MouseEventInterface,
  pointerId: 0,
  width: 0,
  height: 0,
  pressure: 0,
  tangentialPressure: 0,
  tiltX: 0,
  tiltY: 0,
  twist: 0,
  pointerType: 0,
  isPrimary: 0,
}
export const SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface)

// 提交事件接口
const SubmitEventInterface: EventInterfaceType = {
  ...EventInterface,
  submitter: 0,
}
export const SyntheticSubmitEvent = createSyntheticEvent(SubmitEventInterface)

// 触摸事件接口
const TouchEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  touches: 0,
  targetTouches: 0,
  changedTouches: 0,
  altKey: 0,
  metaKey: 0,
  ctrlKey: 0,
  shiftKey: 0,
  getModifierState: getEventModifierState,
}
export const SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface)

// 过渡事件接口
const TransitionEventInterface: EventInterfaceType = {
  ...EventInterface,
  propertyName: 0,
  elapsedTime: 0,
  pseudoElement: 0,
}
export const SyntheticTransitionEvent = createSyntheticEvent(
  TransitionEventInterface
)

// 滚轮事件接口
const WheelEventInterface: EventInterfaceType = {
  ...MouseEventInterface,
  deltaX: function (event: { [propName: string]: any }) {
    return 'deltaX' in event
      ? event.deltaX
      : 'wheelDeltaX' in event
        ? -event.wheelDeltaX
        : 0
  },
  deltaY: function (event: { [propName: string]: any }) {
    return 'deltaY' in event
      ? event.deltaY
      : 'wheelDeltaY' in event
        ? -event.wheelDeltaY
        : 'wheelDelta' in event
          ? -event.wheelDelta
          : 0
  },
  deltaZ: 0,
  deltaMode: 0,
}
export const SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface)

// 切换事件接口
const ToggleEventInterface: EventInterfaceType = {
  ...EventInterface,
  newState: 0,
  oldState: 0,
}
export const SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface)
