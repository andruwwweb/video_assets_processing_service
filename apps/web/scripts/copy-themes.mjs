// Copy the PrimeReact theme CSS we switch between into public/, so they can be
// served as <link> stylesheets and hot-swapped at runtime (changeTheme).
// Runs on predev/prebuild; public/themes is gitignored (vendored, not committed).
import { createRequire } from 'node:module'
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pkgRoot = dirname(dirname(require.resolve('primereact/api'))) // .../primereact
const themesSrc = join(pkgRoot, 'resources', 'themes')
const dest = join(process.cwd(), 'public', 'themes')

const THEMES = ['lara-light-indigo', 'lara-dark-indigo']
for (const name of THEMES) {
  mkdirSync(join(dest, name), { recursive: true })
  cpSync(join(themesSrc, name, 'theme.css'), join(dest, name, 'theme.css'))
}
console.log(`[copy-themes] copied ${THEMES.length} theme(s) to public/themes`)
