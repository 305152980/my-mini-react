import { type ReactNodeList } from '@my-mini-react/shared/ReactTypes'
import { type FiberRoot } from './ReactInternalTypes'
import { scheduleUpdateOnFiber } from './ReactFiberWorkLoop'

export function updateContainer(
  element: ReactNodeList,
  container: FiberRoot
): void {
  // 1、获取 current。
  const current = container.current
  current.memoizedState = { element }
  // 2、调度更新。
  scheduleUpdateOnFiber(container, current)
}
