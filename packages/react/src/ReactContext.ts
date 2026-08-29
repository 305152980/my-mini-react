import {
  REACT_CONTEXT_TYPE,
  REACT_PROVIDER_TYPE,
} from '@my-mini-react/shared/ReactSymbols'
import type {
  ReactContext,
  ReactProviderType,
} from '@my-mini-react/shared/ReactTypes'

// 这种看似“危险”的循环引用，恰恰是 React Context 能够高效工作的关键。它建立了一个双向的连接：
// 从 Context 到 Provider/Consumer：context.Provider 和 context.Consumer 让我们可以在 JSX 中方便地使用 <MyContext.Provider> 和 <MyContext.Consumer>。
// 从 Provider/Consumer 到 Context：当 React 在渲染过程中遇到 <MyContext.Provider> 组件时，它可以通过组件的 _context 属性，立刻找到它所属的 context 对象，从而更新 context._currentValue 这个全局状态。
export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    Provider: null as unknown as ReactProviderType<T>,
    Consumer: null as unknown as ReactContext<T>,
  }
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  }
  context.Consumer = context
  return context
}
