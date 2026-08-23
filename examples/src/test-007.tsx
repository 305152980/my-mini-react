import { createRoot } from '@my-mini-react/react-dom/client'
import React from 'react'

function FunctionComponent(): React.ReactNode {
  return <div>FunctionComponent</div>
}

// createRoot(document.getElementById('root')!).render(
//   (<FunctionComponent />) as any
// )

createRoot(document.getElementById('root')!).render(
  (
    <div>
      <div>div</div>
      <FunctionComponent />
    </div>
  ) as any
)
