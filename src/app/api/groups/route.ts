import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { groupCreateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { Prisma } from '@prisma/client'

// GET /api/groups — caller's groups with item counts
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const groups = await db.group.findMany({
    where: { ownerId: session.userId },
    orderBy: { name: 'asc' },
  })

  const counts = await db.credential.groupBy({
    by: ['groupId'],
    where: { ownerId: session.userId, deletedAt: null, groupId: { not: null } },
    _count: { _all: true },
  })
  const countMap = new Map(counts.map((c) => [c.groupId, c._count._all]))

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      count: countMap.get(g.id) ?? 0,
      createdAt: g.createdAt.toISOString(),
    })),
  })
}

// POST /api/groups
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
  const parsed = groupCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  try {
    const group = await db.group.create({
      data: {
        ownerId: session.userId,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    })
    await logActivity(session.userId, 'group.created', `Created group "${group.name}"`)
    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          color: group.color,
          count: 0,
          createdAt: group.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ message: 'A group with that name already exists' }, { status: 409 })
    }
    throw e
  }
}
