import { NextResponse, type NextRequest } from 'next/server'

const CSRF_COOKIE = 'passway_csrf'

/**
 * Issues the CSRF double-submit cookie on page loads so that every subsequent
 * mutating API request can echo it back in the `x-csrf-token` header. This
 * keeps the CSRF check reliable behind reverse proxies that rewrite Host.
 */
export function proxy(req: NextRequest) {
  const res = NextResponse.next()
  if (!req.cookies.get(CSRF_COOKIE)?.value) {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const https = proto ? proto === 'https' : req.nextUrl.protocol === 'https:'
    res.cookies.set(CSRF_COOKIE, token, {
      httpOnly: false,
      // SameSite=None keeps the cookie usable inside cross-site preview iframes
      sameSite: https ? 'none' : 'lax',
      secure: https,
      path: '/',
      maxAge: 12 * 60 * 60,
    })
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)'],
}
