import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

import { useState } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count, setCount] = useState(0)

  if (count === 0) {
    setTimeout(() => {
      setCount(1)
    }, 3000)
  }

  return (
    <div>
      <button>{count}</button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
