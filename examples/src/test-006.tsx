import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

import { useState } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count, setCount] = useState(0)

  setTimeout(() => {
    setCount(value => value + 1)
  }, 3000)

  return (
    <div>
      {count % 2 === 0 ? <h1>null</h1> : null}
      {count % 2 === 0 ? <h2>undefined</h2> : undefined}
      {count % 2 === 0 ? <h3>false</h3> : false}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
