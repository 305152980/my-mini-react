import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

import { useState, useEffect, useLayoutEffect } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count, setCount] = useState(0)

  // 测试 useEffect 的销毁函数。
  useEffect(() => {
    console.log('useEffect create - count:', count)
    return () => {
      console.log('useEffect destroy - count:', count)
    }
  }, [count])

  // 测试 useLayoutEffect 的销毁函数。
  useLayoutEffect(() => {
    console.log('useLayoutEffect create - count:', count)
    return () => {
      console.log('useLayoutEffect destroy - count:', count)
    }
  }, [count])

  return (
    <div>
      <h1>count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>Increase Count</button>
    </div>
  )
}

// 父组件，用于控制 FunctionComponent 的挂载和卸载。
function App(): React.ReactNode {
  const [show, setShow] = useState(true)

  return (
    <div>
      {show && <FunctionComponent />}
      <button onClick={() => setShow(prev => !prev)}>
        {show ? 'Unmount Component' : 'Mount Component'}
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<App />) as unknown as ReactNodeList
)
