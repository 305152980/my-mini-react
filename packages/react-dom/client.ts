import { createRoot as createRootImpl } from './index'
import type { RootType, CreateRootOptions } from './src/client/ReactDOMRoot'

export function createRoot(
  container: Element | Document | DocumentFragment,
  options?: CreateRootOptions
): RootType {
  return createRootImpl(container, options)
}
