import ReactDOM from '@my-mini-react/react-dom/client'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

ReactDOM.createRoot(document.getElementById('root')!).render(
  (
    <h1>
      <h2>hello world</h2>
      <h2>hello world</h2>
    </h1>
  ) as unknown as ReactNodeList
)
