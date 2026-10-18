import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { deriveSecret, kekFromPassword } from '@/lib/argon2'
import { decryptBytes, safeEqualHex } from '@/lib/crypto'
import { createSession, SESSION_COOKIE, CSRF_COOKIE, sessionCookieOptions, csrfCookieOptions } from '@/lib/session'
import { checkRate, resetRate } from '@/lib/rate-limit'
import { csrfOk, clientIp, requestIsHttps } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { logActivity } from '@/lib/activity'
import { loginSchema } from '@/lib/validation'
import { deviceLabelFromUA } from '@/lib/device'

const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  await ensureSeeded()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { loginId, password } = parsed.data
  const email = loginId.toLowerCase()

  const ip = clientIp(req)
  const ipRate = checkRate(`ip:${ip}`, MAX_ATTEMPTS * 2, WINDOW_MS)
  const idRate = checkRate(`id:${email}`, MAX_ATTEMPTS, WINDOW_MS)
  if (!ipRate.ok || !idRate.ok) {
    const retry = Math.max(ipRate.retryAfterSec, idRate.retryAfterSec)
    return NextResponse.json(
      { message: `Too many failed attempts. Try again in ${Math.ceil(retry / 60)} minute(s).` },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    )
  }

  const user = await db.user.findUnique({ where: { email } })
  if (user) {
    const computed = await deriveSecret(password, user.authSalt)
    if (!safeEqualHex(computed, user.authHash)) {
      return NextResponse.json({ message: 'Invalid login ID or password' }, { status: 401 })
    }
    // Unwrap the vault DEK with the password-derived KEK
    try {
      const kek = await kekFromPassword(password, user.kekSalt)
      const dek = decryptBytes(user.wrappedDekUser, kek)
      const session = createSession(user.id, dek, {
        deviceLabel: deviceLabelFromUA(req.headers.get('user-agent')),
        via: 'password',
      })
      const https = requestIsHttps(req)
      const jar = await cookies()
      jar.set(SESSION_COOKIE, session.token, sessionCookieOptions(https))
      if (!jar.get(CSRF_COOKIE)?.value) {
        jar.set(CSRF_COOKIE, crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''), csrfCookieOptions(https))
      }
      resetRate(`id:${email}`)
      resetRate(`ip:${ip}`)
      await logActivity(user.id, 'login', 'Signed in to vault')
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          mustChangePassword: user.mustChangePassword,
          createdAt: user.createdAt.toISOString(),
        },
      })
    } catch {
      return NextResponse.json(
        { message: 'Vault decryption failed. Check your password and try again.' },
        { status: 401 },
      )
    }
  }

  // Constant-ish response regardless of user existence (no enumeration)
  await deriveSecret(password, '0123456789abcdef0123456789abcdef')
  return NextResponse.json({ message: 'Invalid login ID or password' }, { status: 401 })
}
