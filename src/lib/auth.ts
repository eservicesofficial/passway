import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getSession, SESSION_COOKIE, CSRF_COOKIE, Session } from '@/lib/session'
import { ensureSeeded } from '@/lib/seed'

export type AuthResult = { session: Session; error?: never } | { session?: never; error: NextResponse }

/** Read + validate the session cookie. Returns the session or a 401 response. */
export async function requireAuth(): Promise<AuthResult> {
  const jar = await cookies()
  const session = getSession(jar.get(SESSION_COOKIE)?.value)
  if (!session) {
    return {
      error: NextResponse.json({ message: 'Not authenticated' }, { status: 401 }),
    }
  }
  return { session }
}

/**
 * CSRF defense-in-depth for mutating requests. Accepts when ANY of:
 *  1. Fetch Metadata: `Sec-Fetch-Site` is same-origin/same-site/none. Modern
 *     browsers assert the initiator on every request and it CANNOT be forged
 *     by page scripts (forbidden header). This works behind reverse proxies,
 *     inside cross-origin preview iframes, and without any cookies.
 *  2. Origin host matches `Host` or `X-Forwarded-Host` (legacy same-origin).
 *  3. Double-submit token: `x-csrf-token` header equals the `passway_csrf`
 *     cookie (older browsers without Fetch Metadata).
 */
export function csrfOk(req: NextRequest): boolean {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return true

  // 1) Browser-asserted request initiator — the primary signal.
  const site = req.headers.get('sec-fetch-site')
  if (site === 'same-origin' || site === 'same-site' || site === 'none') return true

  // 2) Legacy Origin/Host comparison (proxy-aware).
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      const originHost = new URL(origin).host
      const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
      if (forwardedHost && originHost === forwardedHost) return true
      const host = req.headers.get('host')
      if (host && originHost === host) return true
    } catch {
      return false // malformed Origin header
    }
  }

  // 3) Double-submit fallback for old browsers without Fetch Metadata.
  const header = req.headers.get('x-csrf-token')
  const cookie = req.cookies.get(CSRF_COOKIE)?.value
  if (header && cookie && header === cookie) return true

  console.warn(
    '[csrf] blocked mutation:',
    req.method,
    req.nextUrl.pathname,
    JSON.stringify({
      site,
      origin: origin ?? null,
      host: req.headers.get('host'),
      xfh: req.headers.get('x-forwarded-host'),
      proto: req.headers.get('x-forwarded-proto'),
      hadToken: !!header,
      hadCookie: !!cookie,
    }),
  )
  return false
}

/** True when the request reached us over HTTPS (directly or via proxy). */
export function requestIsHttps(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (proto) return proto === 'https'
  return req.nextUrl.protocol === 'https:'
}

export interface VaultAccess {
  canWrite: boolean
}

/**
 * Server-side authorization for every vault operation:
 * a user may touch a vault if it is their own, or a grant exists.
 */
export async function getVaultAccess(userId: string, ownerId: string): Promise<VaultAccess | null> {
  if (userId === ownerId) return { canWrite: true }
  const grant = await db.shareGrant.findUnique({
    where: { ownerId_granteeId: { ownerId, granteeId: userId } },
  })
  return grant ? { canWrite: grant.canWrite } : null
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'local'
}
