import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { qrApproveSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { sha256Hex } from '@/lib/pairing'
import { createSession } from '@/lib/session'

/**
 * POST /api/auth/qr/approve
 * Mobile side (authenticated): explicitly approve or deny a scanned pairing.
 * Approval pre-creates the PC session server-side; the PC picks it up by
 * polling /api/auth/qr/status. The pairing token itself is single-use.
 */
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
  const parsed = qrApproveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { token, action } = parsed.data

  const row = await db.loginPairing.findUnique({ where: { tokenHash: sha256Hex(token) } })
  if (!row || row.status !== 'pending') {
    return NextResponse.json({ message: 'This pairing code is no longer valid' }, { status: 410 })
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.loginPairing.update({ where: { id: row.id }, data: { status: 'expired' } }).catch(() => undefined)
    return NextResponse.json({ message: 'This pairing code has expired' }, { status: 410 })
  }

  if (action === 'deny') {
    await db.loginPairing.update({ where: { id: row.id }, data: { status: 'denied' } })
    await logActivity(session.userId, 'qr.denied', `Denied login request from ${row.deviceLabel}`)
    return NextResponse.json({ ok: true, action: 'deny' })
  }

  // Approve: pre-create the PC session bound to the requesting computer's label
  const pcSession = createSession(session.userId, session.dek, {
    deviceLabel: row.deviceLabel,
    via: 'qr',
  })
  const consumed = await db.loginPairing.updateMany({
    where: { id: row.id, status: 'pending' },
    data: { status: 'approved', sessionToken: pcSession.token, approvedById: session.userId },
  })
  if (consumed.count === 0) {
    return NextResponse.json({ message: 'This pairing code is no longer valid' }, { status: 410 })
  }
  await logActivity(session.userId, 'qr.approved', `Approved PC login for ${row.deviceLabel}`)

  return NextResponse.json({ ok: true, action: 'approve' })
}
