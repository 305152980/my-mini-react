import { useState } from '@my-mini-react/react'
export function FunctionComponent() {
  const [count, setCount] = useState(0)

  if (count === 0) {
    setTimeout(() => {
      setCount(1)
    }, 3000)
  }

  return (
    <div>
      <button>{count}</button>
    </div>
  )
}
