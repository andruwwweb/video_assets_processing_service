import type { ReactNode } from 'react'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-surface-50 to-surface-100">
      <header className="flex items-center justify-between px-6 h-16">
        <Brand href="/login" />
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="crop-frame w-full max-w-md">
          <span className="crop-tr" />
          <span className="crop-bl" />
          {children}
        </div>
      </main>
    </div>
  )
}
