'use client'

import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const THEME_NAME: Record<Theme, string> = {
  light: 'lara-light-indigo',
  dark: 'lara-dark-indigo',
}

export const themeHref = (t: Theme) => `/themes/${THEME_NAME[t]}/theme.css`

// Swap the active theme stylesheet WITHOUT a flash. PrimeReact's changeTheme
// removes the old <link> and inserts the new (unloaded) one in one step, leaving
// a brief unstyled gap. Instead we load the new sheet first — inserted right
// after the current one so it wins the cascade the instant it's ready — and only
// then drop the old one. Result: a clean cross-fade, never an unstyled frame.
function swapThemeStylesheet(next: Theme): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve()
    // Cancel any in-flight swap (e.g. rapid double-toggle) before starting.
    document.querySelectorAll('link[data-theme-pending]').forEach((el) => el.remove())

    const current = document.getElementById('app-theme') as HTMLLinkElement | null
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = themeHref(next)
    link.setAttribute('data-theme-pending', '')

    const done = () => {
      link.removeAttribute('data-theme-pending')
      if (current && current !== link) current.remove()
      link.id = 'app-theme'
      resolve()
    }
    link.addEventListener('load', done, { once: true })
    link.addEventListener('error', done, { once: true })

    if (current?.parentNode) current.parentNode.insertBefore(link, current.nextSibling)
    else document.head.appendChild(link)
  })
}

// Apply a theme: swap the stylesheet, then flip <html> dataset/color-scheme in
// the same paint so native chrome (scrollbars, form controls) matches.
export function applyTheme(next: Theme): Promise<void> {
  return swapThemeStylesheet(next).then(() => {
    const d = document.documentElement
    d.dataset.theme = next
    d.style.colorScheme = next
  })
}

// Initial value is 'light' so SSR and first client render agree (avoids a
// hydration mismatch). ThemeToggle syncs the real value from the <html> dataset
// — set by the pre-paint no-flash script — right after mount.
type ThemeState = { theme: Theme; set: (t: Theme) => void }

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  set: (theme) => set({ theme }),
}))
