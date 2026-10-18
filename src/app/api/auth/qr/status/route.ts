import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp } from '@/lib/auth'
import { checkRate } from '@/lib/rate-limit'
import { sha256Hex } from '@/lib/pairing'
import { getSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'
import { cookies } from 'next/headers'
import { requestIsHttps } from '@/lib/auth'

/**
 * GET /api/auth/qr/status?token=...
 * PC side: poll the pairing state. When approved, the pre-created PC session
 * is attached to this response exactly once (single consumption), then the
 * pairing is marked consumed.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  const rate = checkRate(`qrs:${ip}`, 400, 5 * 60 * 1000)
  if (!rate.ok) {
    return NextResponse.json({ message: 'Too many polls. Slow down.' }, { status: 429 })
  }

  const token = (req.nextUrl.searchParams.get('token') ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ status: 'expired' }, { status: 400 })
  }

  const row = await db.loginPairing.findUnique({ where: { tokenHash: sha256Hex(token) } })
  if (!row || (row.status !== 'approved' && row.expiresAt.getTime() < Date.now())) {
    // Expire stale pending pairings lazily
    if (row && row.status === 'pending' && row.expiresAt.getTime() < Date.now()) {
      await db.loginPairing.update({ where: { id: row.id }, data: { status: 'expired' } }).catch(() => undefined)
    }
    return NextResponse.json({ status: 'expired' })
  }

  if (row.status === 'denied') {
    return NextResponse.json({ status: 'denied' })
  }

  if (row.status === 'approved' && row.sessionToken) {
    const session = getSession(row.sessionToken)
    if (!session) {
      // Server restarted and the in-memory session is gone — invalidate pairing
      await db.loginPairing.update({ where: { id: row.id }, data: { status: 'expired' } }).catch(() => undefined)
      return NextResponse.json({ status: 'expired' })
    }
    // Atomically consume the approval (single use)
    const consumed = await db.loginPairing.updateMany({
      where: { id: row.id, status: 'approved' },
      data: { status: 'consumed' },
    })
    if (consumed.count === 0) {
      return NextResponse.json({ status: 'expired' })
    }
    const jar = await cookies()
    jar.set(SESSION_COOKIE, row.sessionToken, sessionCookieOptions(requestIsHttps(req)))
    return NextResponse.json({
      status: 'approved',
      user: {
        id: session.userId,
        // email resolved by /api/auth/me on the client after redirect
      },
    })
  }

  return NextResponse.json({ status: 'pending', expiresAt: row.expiresAt.toISOString() })
}
