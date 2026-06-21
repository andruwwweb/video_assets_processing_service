import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = ['/login', '/register', '/docs']

/** Cookie-based route guard: no JWT → bounce to /login; logged-in → skip auth pages. */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  const hasToken = req.cookies.has('token')
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Protect app routes by cookie *presence* only (validity is enforced by the
  // API; an invalid cookie 401s a query and the client clears it + redirects).
  // No /login→/videos bounce here — it would loop against that client redirect.
  if (!hasToken && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

// Run on app routes only; skip API proxy, Next internals and static files
// (themes/ are public theme stylesheets fetched before auth, must stay open).
export const config = {
  matcher: ['/((?!_next/|themes/|v1/|openapi\\.json|favicon\\.ico).*)'],
}
