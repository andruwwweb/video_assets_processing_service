import Link from 'next/link'

// Wordmark: an ink glyph framed by a single amber crop-mark — the framing motif
// that runs through the product. Display face (Sora) for the name.
export function Brand({ href = '/videos' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 select-none group">
      <span className="relative grid place-items-center w-8 h-8 rounded-md bg-surface-900 text-surface-0 font-display font-bold leading-none">
        M
        {/* amber crop corner, bottom-right */}
        <span className="absolute -bottom-[3px] -right-[3px] w-2 h-2 border-b-2 border-r-2 border-brand" />
      </span>
      <span className="font-display font-semibold tracking-tight text-surface-900 leading-none">
        Media Platform
      </span>
    </Link>
  )
}
