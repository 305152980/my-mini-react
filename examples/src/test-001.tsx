import { createRoot } from '@my-mini-react/react-dom/client'

createRoot(document.getElementById('root')!).render(
  (
    <h1>
      <h2>hello world</h2>
      <h2>hello world</h2>
    </h1>
  ) as any
)
