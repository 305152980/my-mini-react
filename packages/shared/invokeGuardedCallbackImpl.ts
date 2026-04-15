export default function invokeGuardedCallbackImpl(
  this: {
    onError: (error: any) => void
  },
  name: string | null,
  func: (...args: any[]) => any,
  context: any
): void {
  // 1. 提取参数
  // `arguments` 是类数组对象，包含了调用本函数的所有参数。
  // 因为 `func` 的参数是从第 4 个位置开始的（索引为 3），所以我们需要从索引 3 开始截取。
  // 这里利用 Array.prototype.slice 将 arguments 的一部分转换为真正的数组。
  const funcArgs = Array.prototype.slice.call(arguments, 3)
  // 2. 安全执行
  try {
    // 使用 apply 执行用户传入的函数。
    // - context: 指定函数执行时的 this 指向。
    // - funcArgs: 将提取出的参数数组展开传给 func。
    func.apply(context, funcArgs)
  } catch (error) {
    // 3. 错误捕获
    // 如果 func 执行过程中抛出异常，这里会捕获它。
    // 然后调用 `this.onError` 将错误传递出去（通常会被存入全局变量，供后续逻辑处理）。
    this.onError(error)
  }
}
