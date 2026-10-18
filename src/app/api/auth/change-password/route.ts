import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { deriveSecret, kekFromPassword } from '@/lib/argon2'
import { encryptBytes, randomHex, safeEqualHex } from '@/lib/crypto'
import {
  destroyUserSessions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/session'
import { csrfOk, requireAuth } from '@/lib/auth'
import { logActivity } from '@/lib/activity'
import { changePasswordSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { currentPassword, newLoginId, newPassword } = parsed.data

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return NextResponse.json({ message: 'Account not found' }, { status: 404 })

  const computed = await deriveSecret(currentPassword, user.authSalt)
  if (!safeEqualHex(computed, user.authHash)) {
    return NextResponse.json({ message: 'Current password is incorrect' }, { status: 401 })
  }

  if (!newPassword && !newLoginId) {
    return NextResponse.json(
      { message: 'Provide a new password and/or a new login ID' },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = { mustChangePassword: false }

  if (newLoginId && newLoginId.toLowerCase() !== user.email) {
    const email = newLoginId.toLowerCase()
    const existing = await db.user.findUnique({ where: { email } })
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ message: 'That login ID is already taken' }, { status: 409 })
    }
    data.email = email
  }

  if (newPassword) {
    // Re-wrap the existing vault DEK with a fresh password-derived KEK.
    const kekSalt = randomHex(16)
    const kek = await kekFromPassword(newPassword, kekSalt)
    const authSalt = randomHex(16)
    const authHash = await deriveSecret(newPassword, authSalt)
    data.kekSalt = kekSalt
    data.wrappedDekUser = encryptBytes(session.dek, kek)
    data.authSalt = authSalt
    data.authHash = authHash
  }

  await db.user.update({ where: { id: user.id }, data })
  // Invalidate every other session; re-issue the current one to refresh lifetime.
  destroyUserSessions(user.id, session.token)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, session.token, sessionCookieOptions())

  await logActivity(
    user.id,
    'password.changed',
    newPassword && newLoginId ? 'Login ID and password updated' : newPassword ? 'Password updated' : 'Login ID updated',
  )

  return NextResponse.json({
    user: {
      id: user.id,
      email: (data.email as string) ?? user.email,
      mustChangePassword: false,
      createdAt: user.createdAt.toISOString(),
    },
  })
}
