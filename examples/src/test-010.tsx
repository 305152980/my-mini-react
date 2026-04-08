import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

import { useState, useEffect, useLayoutEffect } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count1, setCount1] = useState(0)
  const [count2, setCount2] = useState(0)

  setTimeout(() => {
    setCount1(value => value + 1)
    // setCount2(value => value + 1)
  }, 1000)

  useEffect(() => {
    console.log('useEffect')
  }, [count1])

  useLayoutEffect(() => {
    console.log('useLayoutEffect')
  }, [count2])

  return (
    <div>
      <h1>count1: {count1}</h1>
      <h1>count2: {count2}</h1>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
