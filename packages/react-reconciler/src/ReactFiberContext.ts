// 当组件没有使用任何 Context 时，传入构造函数的 context 参数。
// 避免每次创建空对象，复用同一个对象节省内存。
export const emptyContextObject = {}
