export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5
export const NoPriority = 0
export const ImmediatePriority = 1
export const UserBlockingPriority = 2
export const NormalPriority = 3
export const LowPriority = 4
export const IdlePriority = 5

// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
const maxSigned31BitInt = 1073741823
export const IMMEDIATE_PRIORITY_TIMEOUT = -1
export const USER_BLOCKING_PRIORITY_TIMEOUT = 250
export const NORMAL_PRIORITY_TIMEOUT = 5000
export const LOW_PRIORITY_TIMEOUT = 10000
export const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt
