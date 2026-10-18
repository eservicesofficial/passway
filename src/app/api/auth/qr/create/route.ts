import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp } from '@/lib/auth'
import { checkRate } from '@/lib/rate-limit'
import { randomHex } from '@/lib/crypto'
import { deviceLabelFromUA } from '@/lib/device'
import { sha256Hex, pairingExpiry } from '@/lib/pairing'

/**
 * POST /api/auth/qr/create
 * PC side: mint a short-lived, single-use pairing token. The QR payload
 * contains ONLY this opaque token — never credentials or session secrets.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rate = checkRate(`qrc:${ip}`, 30, 15 * 60 * 1000)
  if (!rate.ok) {
    return NextResponse.json({ message: 'Too many pairing attempts. Try again later.' }, { status: 429 })
  }

  // Opportunistic cleanup of stale pairings
  await db.loginPairing.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
  })

  const token = randomHex(32) // 64 hex chars
  const row = await db.loginPairing.create({
    data: {
      tokenHash: sha256Hex(token),
      deviceLabel: deviceLabelFromUA(req.headers.get('user-agent')),
      ip,
      expiresAt: pairingExpiry(),
    },
  })

  return NextResponse.json(
    { token, expiresAt: row.expiresAt.toISOString(), deviceLabel: row.deviceLabel },
    { status: 201 },
  )
}
