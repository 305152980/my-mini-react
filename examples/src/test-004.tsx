import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

import { useState } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [count, setCount] = useState(0)
  const arr = count % 2 === 0 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]

  setTimeout(() => {
    setCount(value => value + 1)
  }, 3000)

  return (
    <ul>
      {arr.map(item => (
        <li key={'li' + item}>{item}</li>
      ))}
    </ul>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
