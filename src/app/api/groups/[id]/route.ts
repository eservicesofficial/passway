import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { groupUpdateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { Prisma } from '@prisma/client'

// PATCH /api/groups/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ message: 'Group not found' }, { status: 404 })
  if (group.ownerId !== session.userId) {
    return NextResponse.json({ message: 'Not your group' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  const parsed = groupUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  try {
    const updated = await db.group.update({ where: { id }, data: parsed.data })
    await logActivity(session.userId, 'group.updated', `Renamed group to "${updated.name}"`)
    return NextResponse.json({
      group: {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ message: 'A group with that name already exists' }, { status: 409 })
    }
    throw e
  }
}

// DELETE /api/groups/[id] — credentials are kept and become ungrouped
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ message: 'Group not found' }, { status: 404 })
  if (group.ownerId !== session.userId) {
    return NextResponse.json({ message: 'Not your group' }, { status: 403 })
  }

  await db.group.delete({ where: { id } })
  await logActivity(session.userId, 'group.deleted', `Deleted group "${group.name}"`)
  return NextResponse.json({ ok: true })
}
