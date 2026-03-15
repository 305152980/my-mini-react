import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { createFiberRoot } from '@my-mini-react/react-reconciler/src/ReactFiberRoot'
import { type Container } from '@my-mini-react/react-reconciler/src/ReactInternalTypes'

type RootType = {
  render: (children: ReactNodeList) => void
}

type ReactDOMRootCtor = new () => RootType
const ReactDOMRoot: ReactDOMRootCtor =
  function (): void {} as unknown as ReactDOMRootCtor
ReactDOMRoot.prototype.render = function (children: ReactNodeList): void {}

export function createRoot(container: Container): RootType {
  const root: RootType = createFiberRoot(container)
  return new ReactDOMRoot()
}

export default {
  createRoot,
}
