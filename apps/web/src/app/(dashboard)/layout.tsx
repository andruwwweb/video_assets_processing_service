'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'primereact/button'
import { api } from '@/lib/api'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

const NAV = [
  { href: '/videos', label: 'Videos', icon: 'pi-video' },
  { href: '/keys', label: 'API keys', icon: 'pi-key' },
  { href: '/webhooks', label: 'Webhooks', icon: 'pi-send' },
  { href: '/docs', label: 'Docs', icon: 'pi-book' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me })

  async function logout() {
    try {
      await api.logout()
    } catch {
      // clear client state regardless
    }
    // Hard navigation: tears down the page so mounted queries can't refetch
    // (and 401) after the cookie is cleared.
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-6 px-6 h-16 border-b border-surface-border bg-surface-0">
        <Brand />
        <span className="h-5 w-px bg-surface-border" />
        <nav className="flex gap-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-brand-soft text-brand font-medium'
                    : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                }`}
              >
                <i className={`pi ${n.icon} text-xs`} />
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden sm:inline text-sm text-surface-600 px-2">{me?.email}</span>
          <Button
            label="Sign out"
            icon="pi pi-sign-out"
            text
            severity="secondary"
            size="small"
            onClick={logout}
          />
        </div>
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  )
}
