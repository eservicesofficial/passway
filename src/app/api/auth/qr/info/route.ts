import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { sha256Hex } from '@/lib/pairing'

/**
 * GET /api/auth/qr/info?token=...
 * Mobile side (authenticated): inspect a scanned pairing code before deciding.
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const token = (req.nextUrl.searchParams.get('token') ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ message: 'Invalid pairing code' }, { status: 400 })
  }

  const row = await db.loginPairing.findUnique({ where: { tokenHash: sha256Hex(token) } })
  if (!row || row.status !== 'pending' || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ message: 'This pairing code is no longer valid' }, { status: 410 })
  }

  return NextResponse.json({
    deviceLabel: row.deviceLabel,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  })
}
