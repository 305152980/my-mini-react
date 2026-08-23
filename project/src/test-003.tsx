import { createRoot } from '@my-mini-react/react-dom/client'
import React from 'react'
import { useState } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count, setCount] = useState(0)

  if (count === 0) {
    setTimeout(() => {
      setCount(1)
    }, 3000)
  }

  return <div>{count ? <h2>{count}</h2> : <h1>{count}</h1>}</div>
}

createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as any
)
