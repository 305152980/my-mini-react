// import ReactDOM from '@my-mini-react/react-dom/client'
// import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'

// ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
//   (
//     <h1>
//       <h2>hello world</h2>
//       <h2>hello world</h2>
//     </h1>
//   ) as unknown as ReactNodeList
// )

import ReactDOM from '@my-mini-react/react-dom/client'
import type { ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { FunctionComponent } from './FunctionComponent.jsx'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  (<FunctionComponent />) as unknown as ReactNodeList
)
