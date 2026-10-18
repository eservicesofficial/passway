import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

// POST /api/trash/empty — permanently delete everything in the caller's Trash
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error

  const result = await db.credential.deleteMany({
    where: { ownerId: session.userId, deletedAt: { not: null } },
  })
  await logActivity(session.userId, 'trash.emptied', `Emptied Trash (${result.count} item${result.count === 1 ? '' : 's'})`)
  return NextResponse.json({ ok: true, deleted: result.count })
}
