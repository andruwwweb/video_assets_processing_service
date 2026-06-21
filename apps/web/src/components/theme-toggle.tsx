'use client'

import { useEffect } from 'react'
import { Button } from 'primereact/button'
import { applyTheme, themeHref, useThemeStore, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const { theme, set } = useThemeStore()

  useEffect(() => {
    // Adopt the theme the pre-paint script already resolved onto <html>.
    const current = document.documentElement.dataset.theme
    if (current === 'light' || current === 'dark') set(current)

    // Warm the other theme so the first toggle swaps instantly from cache.
    const other: Theme = current === 'dark' ? 'light' : 'dark'
    const pre = document.createElement('link')
    pre.rel = 'prefetch'
    pre.as = 'style'
    pre.href = themeHref(other)
    document.head.appendChild(pre)
  }, [set])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const d = document.documentElement

    d.classList.add('theme-anim') // animate only this switch
    set(next) // responsive icon
    try {
      localStorage.setItem('mpp-theme', next)
    } catch {
      // private mode / storage disabled — non-fatal, just won't persist.
    }
    applyTheme(next).finally(() => {
      window.setTimeout(() => d.classList.remove('theme-anim'), 300)
    })
  }

  return (
    <Button
      type="button"
      rounded
      text
      severity="secondary"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      icon={`pi ${theme === 'dark' ? 'pi-sun' : 'pi-moon'}`}
      onClick={toggle}
    />
  )
}
