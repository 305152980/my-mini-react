// @ts-nocheck
import { createRoot } from '@my-mini-react/react-dom/client'
import React from 'react'
import {
  useState,
  createContext,
  useContext,
  Component,
} from '@my-mini-react/react'

// ========== 创建 Context ==========
const ThemeContext = createContext('light')
const CountContext = createContext(0)

// ========== 测试 1：useContext（函数组件消费） ==========
function ThemeDisplay() {
  const theme = useContext(ThemeContext)
  console.log('[ThemeDisplay] 渲染，theme =', theme)
  return (
    <div
      style={{
        padding: '8px',
        background: theme === 'dark' ? '#333' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
      }}
    >
      useContext 读取的 theme：{theme}
    </div>
  )
}

// ========== 测试 2：Context.Consumer（render props 消费） ==========
function ConsumerDisplay() {
  console.log('[ConsumerDisplay] 渲染')
  return (
    <ThemeContext.Consumer>
      {theme => (
        <div style={{ padding: '8px', border: '1px dashed #999' }}>
          Consumer 读取的 theme：{theme}
        </div>
      )}
    </ThemeContext.Consumer>
  )
}

// ========== 测试 3：嵌套 Provider（内层覆盖外层） ==========
function NestedProviderTest() {
  console.log('[NestedProviderTest] 渲染')
  return (
    <div>
      <p>外层 theme = "light"，内层 theme = "dark"：</p>
      <ThemeContext.Provider value="light">
        <ThemeDisplay />
        <ThemeContext.Provider value="dark">
          <ThemeDisplay />
          <ConsumerDisplay />
        </ThemeContext.Provider>
      </ThemeContext.Provider>
    </div>
  )
}

// ========== 测试 4：动态值更新 ==========
function DynamicUpdateTest() {
  const [count, setCount] = useState(0)
  console.log('[DynamicUpdateTest] 渲染，count =', count)
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <button onClick={() => setCount(0)}>重置</button>
      <CountContext.Provider value={count}>
        <CountDisplay />
      </CountContext.Provider>
    </div>
  )
}

function CountDisplay() {
  const count = useContext(CountContext)
  console.log('[CountDisplay] 渲染，count =', count)
  return <div>Context 中的 count：{count}</div>
}

// ========== 测试 5：多个 Context 同时使用 ==========
function MultiContextTest() {
  const [theme, setTheme] = useState('light')
  const [count, setCount] = useState(0)
  return (
    <div>
      <button onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}>
        切换 theme
      </button>
      <button onClick={() => setCount(c => c + 1)}>count +1</button>
      <ThemeContext.Provider value={theme}>
        <CountContext.Provider value={count}>
          <MultiContextDisplay />
        </CountContext.Provider>
      </ThemeContext.Provider>
    </div>
  )
}

function MultiContextDisplay() {
  const theme = useContext(ThemeContext)
  const count = useContext(CountContext)
  console.log(`[MultiContextDisplay] 渲染，theme=${theme}, count=${count}`)
  return (
    <div style={{ padding: '8px', border: '1px solid #4CAF50' }}>
      <div>theme：{theme}</div>
      <div>count：{count}</div>
    </div>
  )
}

// ========== 主组件 ==========
function App(): React.ReactNode {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Context 功能测试</h1>

      <section style={{ marginBottom: '24px' }}>
        <h2>测试 1：嵌套 Provider（内层覆盖外层）</h2>
        <NestedProviderTest />
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>测试 2：动态值更新</h2>
        <DynamicUpdateTest />
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>测试 3：多个 Context 同时使用</h2>
        <MultiContextTest />
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render((<App />) as any)
