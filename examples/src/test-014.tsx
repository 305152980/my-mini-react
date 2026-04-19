import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { useState } from '@my-mini-react/react'

function FunctionComponent(): React.ReactNode {
  const [text, setText] = useState('hello input')
  const [textarea, setTextarea] = useState('hello textarea')

  function inputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    console.log('inputChange', e.target.value)
    setText(e.target.value)
  }

  function textareaChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    console.log('textareaChange', e.target.value)
    setTextarea(e.target.value)
  }

  return (
    <div>
      <h1>受控组件事件</h1>
      <input value={text} onChange={inputChange} />
      <p>{text}</p>
      <textarea value={textarea} onChange={textareaChange} />
      <p>{textarea}</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
