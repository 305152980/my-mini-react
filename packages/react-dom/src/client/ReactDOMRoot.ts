import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'

type RootType = {
  render: (children: ReactNodeList) => void
}

type ReactDOMRootCtor = new () => RootType
const ReactDOMRoot: ReactDOMRootCtor =
  function (): void {} as unknown as ReactDOMRootCtor
ReactDOMRoot.prototype.render = function (children: ReactNodeList): void {}

export function createRoot(): RootType {
  return new ReactDOMRoot()
}

export default {
  createRoot,
}
