const ReactNoopUpdateQueue = {
  isMounted: function (publicInstance: any): boolean {
    return false
  },

  enqueueForceUpdate: function (
    publicInstance: any,
    callback?: Function | null,
    callerName?: string
  ): void {},

  enqueueReplaceState: function (
    publicInstance: any,
    completeState: any,
    callback?: Function | null,
    callerName?: string
  ): void {},

  enqueueSetState: function (
    publicInstance: any,
    partialState: any,
    callback?: Function | null,
    callerName?: string
  ): void {},
}

export default ReactNoopUpdateQueue
