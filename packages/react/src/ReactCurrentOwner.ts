import type { Fiber } from '@my-mini-react/react-reconciler'

const ReactCurrentOwner = {
  current: null as null | Fiber,
}

export default ReactCurrentOwner
