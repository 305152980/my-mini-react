import { createRoot } from '@my-mini-react/react-dom/client'
import React from 'react'

function clickHandler(e: React.MouseEvent<HTMLButtonElement>) {
  console.log('clickHandler', e)
}

function FunctionComponent(): React.ReactNode {
  return <button onClick={clickHandler}>点我查看合成事件对象</button>
}

createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as any
)
