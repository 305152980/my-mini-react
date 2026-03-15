import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { createFiberRoot } from '@my-mini-react/react-reconciler/src/ReactFiberRoot'
import type {
  Container,
  FiberRoot,
} from '@my-mini-react/react-reconciler/src/ReactInternalTypes'
import { updateContainer } from '@my-mini-react/react-reconciler/src/ReactFiberReconciler'

type RootType = {
  _internalRoot: FiberRoot
  render: (children: ReactNodeList) => void
}

type ReactDOMRootCtor = new (_internalRoot: FiberRoot) => RootType
const ReactDOMRoot: ReactDOMRootCtor = function (
  this: RootType,
  _internalRoot: FiberRoot
): void {
  this._internalRoot = _internalRoot
} as unknown as ReactDOMRootCtor
ReactDOMRoot.prototype.render = function (children: ReactNodeList): void {
  updateContainer(children, this._internalRoot)
}

export function createRoot(container: Container): RootType {
  const root: FiberRoot = createFiberRoot(container)
  return new ReactDOMRoot(root)
}

export default {
  createRoot,
}
