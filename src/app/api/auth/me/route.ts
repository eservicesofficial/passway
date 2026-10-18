import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requestIsHttps } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { CSRF_COOKIE, csrfCookieOptions } from '@/lib/session'

export async function GET(req: NextRequest) {
  await ensureSeeded()
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })

  // Backfill the CSRF cookie for sessions created before it existed
  if (!req.cookies.get(CSRF_COOKIE)?.value) {
    const jar = await import('next/headers').then((m) => m.cookies())
    jar.set(CSRF_COOKIE, crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''), csrfCookieOptions(requestIsHttps(req)))
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
    },
  })
}
