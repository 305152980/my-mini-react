import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { memo, useState } from '@my-mini-react/react'

// 子组件：使用 memo 包裹，只有在 props 改变时才会重新渲染
const ChildComponent = memo<{ name: string; count: number }>(
  function ChildComponent({
    name,
    count,
  }: {
    name: string
    count: number
  }): React.ReactNode {
    console.log(`ChildComponent 渲染: ${name}, count: ${count}`)
    return (
      <div
        style={{ padding: '10px', margin: '10px', border: '1px solid #ccc' }}
      >
        <h3>子组件: {name}</h3>
        <p>Count: {count}</p>
      </div>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.count === nextProps.count
  }
)

function FunctionComponent(): React.ReactNode {
  const [count1, setCount1] = useState(0)
  const [count2, setCount2] = useState(0)

  console.log('父组件渲染')

  return (
    <div style={{ padding: '20px' }}>
      <h1>测试 memo 组件</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>计数器 1</h2>
        <p>Count: {count1}</p>
        <button onClick={() => setCount1(count1 + 1)}>增加 Count 1</button>
        {/* 这个组件会重新渲染，因为 count1 改变了 */}
        <ChildComponent name="组件 1" count={count1} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>计数器 2</h2>
        <p>Count: {count2}</p>
        <button onClick={() => setCount2(count2 + 1)}>增加 Count 2</button>
        {/* 这个组件不会重新渲染，因为 props 没变 */}
        <ChildComponent name="组件 2" count={count1} />
      </div>

      <div style={{ padding: '10px', background: '#f0f0f0' }}>
        <h3>测试说明：</h3>
        <ul>
          <li>
            点击"增加 Count 1"：组件 1 和组件 2 都会重新渲染（因为都依赖
            count1）
          </li>
          <li>
            点击"增加 Count 2"：只有父组件重新渲染，子组件都不会重新渲染（因为
            memo 组件的 props 没变）
          </li>
          <li>查看控制台，观察 ChildComponent 的渲染次数</li>
        </ul>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
