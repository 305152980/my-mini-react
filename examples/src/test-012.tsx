import ReactDOM from '@my-mini-react/react-dom/client'
import React from 'react'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { Component } from '@my-mini-react/react'

import { useState, createContext, useContext } from '@my-mini-react/react'

const CountContext = createContext(100)

function FunctionComponent(): React.ReactNode {
  const [count, setCount] = useState(0)

  setTimeout(() => {
    setCount(value => value + 1)
  }, 2000)

  return (
    <div>
      <CountContext.Provider value={count}>
        <CountContext.Provider value={count + 1}>
          <div>第一种消费方式：</div>
          <CountContext.Consumer>
            {value => <div>{value}</div>}
          </CountContext.Consumer>
          <div>第二种消费方式：</div>
          <FunctionChild />
          <div>第三种消费方式（只能消费单一的 context 来源。）：</div>
          <ClassChild />
        </CountContext.Provider>
      </CountContext.Provider>
    </div>
  )
}

function FunctionChild(): React.ReactNode {
  const count = useContext(CountContext)
  return <div>{count}</div>
}

class ClassChild extends Component {
  static contextType = CountContext
  render(): React.ReactNode {
    return <div>{this.context}</div>
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
