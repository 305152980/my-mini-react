import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

function clickHandler(e: React.MouseEvent<HTMLDivElement>) {
  console.log('clickHandler', e)
}

function FunctionComponent(): React.ReactNode {
  return <div onClick={clickHandler}>合成事件</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
