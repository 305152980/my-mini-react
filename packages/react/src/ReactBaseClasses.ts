// 写法一：最原始版本。
// export function Component(this: any, props: any, context: any) {
//   this.props = props
//   this.context = context
// }
// Component.prototype.isReactComponent = {}

// 写法二：使用 TypeScript 定义抽象类。
// const emptyObject = {}
// export interface Component {
//   isReactComponent: any
// }
// export abstract class Component<P = {}, S = {}> {
//   props: P
//   state: S
//   refs: { [key: string]: any }
//   context: any
//   constructor(props: P, context?: any) {
//     this.props = props
//     this.state = {} as S
//     this.refs = emptyObject
//     this.context = context
//   }
//   setState(
//     partialState: Partial<S> | ((prevState: S, props: P) => Partial<S>)
//   ): void {
//     // TODO: 实现 setState 逻辑：这里通常会调用 this.updater.enqueueSetState。
//     console.log('setState called', partialState)
//   }
//   forceUpdate(): void {
//     // TODO: 实现 forceUpdate 逻辑。
//     console.log('forceUpdate called')
//   }
//   abstract render(): any
// }
// Component.prototype.isReactComponent = {}

// 写法三：仿写源码版。
import ReactNoopUpdateQueue from './ReactNoopUpdateQueue'
const emptyObject: Record<string, any> = {}
function Component(this: any, props: any, context?: any, updater?: any) {
  this.props = props
  this.context = context
  this.refs = emptyObject
  this.updater = updater || ReactNoopUpdateQueue
}
Component.prototype.isReactComponent = {}
Component.prototype.setState = function (
  this: any,
  partialState: any,
  callback?: Function
) {
  if (
    typeof partialState !== 'object' &&
    typeof partialState !== 'function' &&
    partialState != null
  ) {
    throw new Error(
      'setState(...): takes an object of state variables to update or a ' +
        'function which returns an object of state variables.'
    )
  }
  this.updater.enqueueSetState(this, partialState, callback, 'setState')
}
Component.prototype.forceUpdate = function (this: any, callback?: Function) {
  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate')
}
export { Component }
