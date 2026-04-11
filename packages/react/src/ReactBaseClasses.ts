// export function Component(this: any, props: any, context: any) {
//   this.props = props
//   this.context = context
// }

// Component.prototype.isReactComponent = {}

export interface Component {
  isReactComponent: any
}

export abstract class Component<P = {}, S = {}> {
  props: P
  state: S
  refs: { [key: string]: any }
  context: any

  constructor(props: P) {
    this.props = props
    this.state = {} as S
    this.refs = {}
  }

  setState(
    partialState: Partial<S> | ((prevState: S, props: P) => Partial<S>)
  ): void {
    // TODO: 实现 setState 逻辑：这里通常会调用 this.updater.enqueueSetState。
    console.log('setState called', partialState)
  }

  forceUpdate(): void {
    // TODO: 实现 forceUpdate 逻辑。
    console.log('forceUpdate called')
  }

  abstract render(): any
}

Component.prototype.isReactComponent = {}
