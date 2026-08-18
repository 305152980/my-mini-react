import type { BatchConfigTransition } from '@my-mini-react/react-reconciler'

type BatchConfig = {
  transition: BatchConfigTransition | null
}

const ReactCurrentBatchConfig: BatchConfig = {
  transition: null,
}

export default ReactCurrentBatchConfig
