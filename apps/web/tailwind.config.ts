import type { Config } from 'tailwindcss'
import primeui from 'tailwindcss-primeui'

// Map Tailwind color utilities to the PrimeReact (Lara v10) CSS variables, which
// are UN-prefixed (--surface-*, --primary-*). The tailwindcss-primeui plugin
// targets v11 tokens (--p-*), so we override surface/primary here. Result: one
// theme.css swap (light <-> dark) recolors both PrimeReact components and our
// own chrome at once. The brand layer (globals.css) then retints --primary-* to
// amber, so these all pick up the signature accent.
const surface = Object.fromEntries(
  [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [
    `surface-${s}`,
    `var(--surface-${s})`,
  ]),
)
const primary = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => [
    `primary-${s}`,
    `var(--primary-${s})`,
  ]),
)

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Inter for UI/body, Sora for display/headings, IBM Plex Mono for data.
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        primary: 'var(--primary-color)',
        'primary-contrast': 'var(--primary-color-text)',
        ...primary,
        ...surface,
        'text-color': 'var(--text-color)',
        'text-muted': 'var(--text-color-secondary)',
        'surface-border': 'var(--surface-border)',
        // Brand accent split: readable amber for text/links, soft tint for
        // backgrounds. Kept separate from --primary (the bright fill) so amber
        // stays accessible on light surfaces.
        brand: 'var(--brand-accent)',
        'brand-emphasis': 'var(--brand-emphasis)',
        'brand-soft': 'var(--brand-soft)',
      },
    },
  },
  plugins: [primeui],
}

export default config
