'use client'

import '@scalar/api-reference-react/style.css'
import dynamic from 'next/dynamic'

// Client-only: Scalar uses browser APIs. As a React component it mounts/unmounts
// with the route — no leftover DOM overlay when navigating away. Its CSS is
// imported statically above so Next loads it as route CSS (the dynamic chunk's
// own CSS import isn't reliably applied).
const ApiReferenceReact = dynamic(
  () => import('@scalar/api-reference-react').then((m) => m.ApiReferenceReact),
  { ssr: false },
)

export default function DocsPage() {
  return <ApiReferenceReact configuration={{ url: '/openapi.json' }} />
}
