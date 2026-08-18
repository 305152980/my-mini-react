import type { Fiber } from './ReactInternalTypes'

export type Transition = {
  name: string
  startTime: number
}

export type BatchConfigTransition = {
  name?: string
  startTime?: number
  _updatedFibers?: Set<Fiber>
}
