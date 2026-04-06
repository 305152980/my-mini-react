import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

import { useState, useMemo } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count1, setCount1] = useState(0)
  const [count2, setCount2] = useState(0)

  setTimeout(() => {
    // setCount1(value => value + 1)
    setCount2(value => value + 1)
  }, 1000)

  const expensive = useMemo(() => {
    console.log('计算 expensive')
    let result = 0
    for (let i = 0; i < count2; i++) {
      result += i
    }
    return result
  }, [count2])

  return (
    <div>
      <h1>count1: {count1}</h1>
      <h1>count2: {count2}</h1>
      <h1>expensive: {expensive}</h1>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
