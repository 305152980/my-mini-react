export type Flags = number

export const NoFlags = /*                      */ 0b0000000000000000000000000000

export const Placement = /*                    */ 0b0000000000000000000000000010
export const Update = /*                       */ 0b0000000000000000000000000100
export const ChildDeletion = /*                */ 0b0000000000000000000000010000
export const Passive = /*                      */ 0b0000000000000000100000000000

// 定义 Mutation 阶段需要处理的所有副作用类型。
export const MutationMask = Placement | Update | ChildDeletion
