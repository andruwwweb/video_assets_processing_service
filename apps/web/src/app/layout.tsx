import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Sora, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import { Providers } from './providers'

// UI/body, display, and data faces — exposed as CSS variables for Tailwind and
// for the PrimeReact --font-family override (see globals.css).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
})
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Media Processing Platform',
  description: 'Dashboard, docs and API sandbox',
}

// Runs before first paint: pick light/dark from localStorage (falling back to the
// OS preference) and inject the matching PrimeReact theme <link>. Avoids a flash
// of the wrong theme. The link id "app-theme" is what changeTheme() hot-swaps.
const NO_FLASH = `(function(){try{
var t=localStorage.getItem('mpp-theme');
if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
var name=t==='dark'?'lara-dark-indigo':'lara-light-indigo';
var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;
var l=document.createElement('link');l.id='app-theme';l.rel='stylesheet';l.href='/themes/'+name+'/theme.css';
document.head.appendChild(l);
}catch(e){
var f=document.createElement('link');f.id='app-theme';f.rel='stylesheet';f.href='/themes/lara-light-indigo/theme.css';
document.head.appendChild(f);
}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
