import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

function FunctionComponent(): React.ReactNode {
  return <div>FunctionComponent</div>
}

// ReactDOM.createRoot(document.getElementById('root')!).render(
//   (<FunctionComponent />) as unknown as ReactNodeList
// )

ReactDOM.createRoot(document.getElementById('root')!).render(
  (
    <div>
      <div>div</div>
      <FunctionComponent />
    </div>
  ) as unknown as ReactNodeList
)
