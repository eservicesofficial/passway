import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { shareUpdateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'

// PATCH /api/shares/[id] — owner toggles write permission
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  const parsed = shareUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
  }

  const grant = await db.shareGrant.findUnique({ where: { id } })
  if (!grant) return NextResponse.json({ message: 'Share not found' }, { status: 404 })
  if (grant.ownerId !== session.userId) {
    return NextResponse.json({ message: 'Only the vault owner can change permissions' }, { status: 403 })
  }

  const updated = await db.shareGrant.update({ where: { id }, data: { canWrite: parsed.data.canWrite } })
  await logActivity(
    session.userId,
    'share.updated',
    `${parsed.data.canWrite ? 'Granted edit' : 'Set view-only'} access for a shared vault`,
  )
  return NextResponse.json({ grant: { id: updated.id, canWrite: updated.canWrite } })
}

// DELETE /api/shares/[id] — owner revokes, or grantee removes themselves
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const grant = await db.shareGrant.findUnique({
    where: { id },
    include: {
      owner: { select: { email: true } },
      grantee: { select: { email: true } },
    },
  })
  if (!grant) return NextResponse.json({ message: 'Share not found' }, { status: 404 })

  if (grant.ownerId !== session.userId && grant.granteeId !== session.userId) {
    return NextResponse.json({ message: 'Not allowed' }, { status: 403 })
  }

  await db.shareGrant.delete({ where: { id } })
  await logActivity(
    session.userId,
    'share.revoked',
    grant.ownerId === session.userId
      ? `Revoked vault access for ${grant.grantee.email}`
      : `Removed own access to ${grant.owner.email}'s vault`,
  )
  return NextResponse.json({ ok: true })
}
