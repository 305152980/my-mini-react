import invokeGuardedCallbackImpl from './invokeGuardedCallbackImpl'

let hasError: boolean = false
let caughtError: any = null

let hasRethrowError: boolean = false
let rethrowError: any = null

const reporter = {
  onError(error: any): void {
    hasError = true
    caughtError = error
  },
}

export function invokeGuardedCallback<A, B, C, D, E, F, Context>(
  name: string | null, // 用于调试或错误日志的函数名称
  func: (a: A, b: B, c: C, d: D, e: E, f: F) => any, // 需要受保护执行的回调函数
  context: Context, // 回调函数执行时的 this 上下文
  a: A,
  b: B,
  c: C,
  d: D,
  e: E,
  f: F
): void {
  hasError = false
  caughtError = null
  invokeGuardedCallbackImpl.apply(
    reporter,
    arguments as unknown as Parameters<typeof invokeGuardedCallbackImpl>
  )
}

/**
 * 这是一个高层包装函数。它的作用是执行受保护的回调，并在执行结束后立即检查是否有错误。
 * 如果有错误，它会提取错误并将其标记为“待重新抛出”，以便 React 能够稍后处理（例如触发 Error Boundary）。
 */
export function invokeGuardedCallbackAndCatchFirstError<
  A,
  B,
  C,
  D,
  E,
  F,
  Context,
>(
  this: any,
  name: string | null, // 用于调试或错误日志的函数名称
  func: (a: A, b: B, c: C, d: D, e: E, f: F) => void, // 需要受保护执行的回调函数
  context: Context, // 回调函数执行时的 this 上下文
  a: A,
  b: B,
  c: C,
  d: D,
  e: E,
  f: F
): void {
  // arguments 是 JavaScript 函数内部的一个内置的、类数组的局部变量。你不需要声明它，它会自动存在。
  // 在这个代码片段中，arguments 包含了调用 invokeGuardedCallbackAndCatchFirstError 时传入的所有参数。
  invokeGuardedCallback.apply(
    this,
    arguments as unknown as Parameters<typeof invokeGuardedCallback>
  )
  // invokeGuardedCallback 在执行时如果捕获到错误，会将 hasError 标记为 true，并将错误对象存储在 caughtError 中。
  if (hasError) {
    const error = clearCaughtError()
    // 确保在一个事件处理流程中，只抛出第一个被捕获的异常，而忽略后续可能产生的其他异常。
    if (!hasRethrowError) {
      hasRethrowError = true
      rethrowError = error
    }
  }
}

export function clearCaughtError(): any | void {
  if (hasError) {
    const error = caughtError
    hasError = false
    caughtError = null
    return error
  } else {
    throw new Error(
      'clearCaughtError was called but no error was captured. This error ' +
        'is likely caused by a bug in React. Please file an issue.'
    )
  }
}
