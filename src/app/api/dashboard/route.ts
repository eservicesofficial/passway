import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { purgeExpiredTrashLazy } from '@/lib/trash'
import { DashboardDTO } from '@/lib/types'

// GET /api/dashboard — stats, security signals and recent activity for the caller
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  await purgeExpiredTrashLazy()

  const [passwords, favorites, trashed, groups, sharedWithMe, grantedTo] = await Promise.all([
    db.credential.count({ where: { ownerId: session.userId, deletedAt: null } }),
    db.credential.count({ where: { ownerId: session.userId, deletedAt: null, favorite: true } }),
    db.credential.count({ where: { ownerId: session.userId, deletedAt: { not: null } } }),
    db.group.count({ where: { ownerId: session.userId } }),
    db.shareGrant.count({ where: { granteeId: session.userId } }),
    db.shareGrant.count({ where: { ownerId: session.userId } }),
  ])

  const rows = await db.credential.findMany({
    where: { ownerId: session.userId, deletedAt: null },
    select: { passwordHmac: true, passwordEnc: true },
  })

  // Reused passwords (keyed HMAC counts — never exposing plaintext)
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.passwordHmac) counts.set(r.passwordHmac, (counts.get(r.passwordHmac) ?? 0) + 1)
  }
  let reused = 0
  for (const n of counts.values()) if (n > 1) reused += n - 1

  // Weak password heuristic (runs on decrypted values in memory only)
  let weak = 0
  for (const r of rows) {
    if (!r.passwordEnc) continue
    try {
      const { decryptText } = await import('@/lib/crypto')
      const pw = decryptText(r.passwordEnc, session.dek)
      const hasLower = /[a-z]/.test(pw)
      const hasUpper = /[A-Z]/.test(pw)
      const hasDigit = /[0-9]/.test(pw)
      const hasSymbol = /[^A-Za-z0-9]/.test(pw)
      const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
      if (pw.length < 8 || variety <= 1) weak += 1
    } catch {
      // ignore undecryptable
    }
  }

  const recent = await db.activity.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const body: DashboardDTO = {
    totals: { passwords, groups, favorites, trashed, sharedWithMe, grantedTo },
    security: { reused, weak },
    recent: recent.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    })),
  }
  return NextResponse.json(body)
}
