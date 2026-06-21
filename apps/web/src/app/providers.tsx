'use client'

import { PrimeReactProvider } from 'primereact/api'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ApiException, api } from '@/lib/api'

// Module-level guard so the many concurrent 401s (me + videos + …) trigger one redirect.
let redirecting = false

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // Any 401 → session is gone/stale: clear the cookie and bounce to login (once).
        queryCache: new QueryCache({
          onError: (err) => {
            if (
              err instanceof ApiException &&
              err.status === 401 &&
              typeof window !== 'undefined' &&
              !redirecting
            ) {
              const p = window.location.pathname
              if (p !== '/login' && p !== '/register') {
                redirecting = true
                // Clear the (possibly invalid) cookie so /login won't be sent back here.
                api.logout().catch(() => {}).finally(() => {
                  window.location.href = '/login'
                })
              }
            }
          },
        }),
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  )
  return (
    <PrimeReactProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PrimeReactProvider>
  )
}
