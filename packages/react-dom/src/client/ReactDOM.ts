import {
  createRoot as createRootImpl,
  type RootType,
  type CreateRootOptions,
} from './ReactDOMRoot'

function createRoot(
  container: Element | Document | DocumentFragment,
  options?: CreateRootOptions
): RootType {
  return createRootImpl(container, options)
}

export { createRoot }
