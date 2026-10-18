import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { shareCreateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { ShareDTO } from '@/lib/types'

// GET /api/shares — grants the caller owns + grants given to the caller
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const me = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  if (!me) return NextResponse.json({ message: 'Account not found' }, { status: 404 })

  const grantedByMe = await db.shareGrant.findMany({
    where: { ownerId: session.userId },
    include: { grantee: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const sharedWithMe = await db.shareGrant.findMany({
    where: { granteeId: session.userId },
    include: { owner: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const mapOwned = (g: (typeof grantedByMe)[number]): ShareDTO => ({
    id: g.id,
    canWrite: g.canWrite,
    createdAt: g.createdAt.toISOString(),
    owner: { id: session.userId, email: me.email },
    grantee: { id: g.grantee.id, email: g.grantee.email },
  })
  const mapReceived = (g: (typeof sharedWithMe)[number]): ShareDTO => ({
    id: g.id,
    canWrite: g.canWrite,
    createdAt: g.createdAt.toISOString(),
    owner: { id: g.owner.id, email: g.owner.email },
    grantee: { id: session.userId, email: me.email },
  })

  return NextResponse.json({
    grantedByMe: grantedByMe.map(mapOwned),
    sharedWithMe: sharedWithMe.map(mapReceived),
  })
}

// POST /api/shares — grant the caller's vault to another account
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
  const parsed = shareCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { granteeEmail, canWrite } = parsed.data

  const me = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  if (!me) return NextResponse.json({ message: 'Account not found' }, { status: 404 })

  const grantee = await db.user.findUnique({ where: { email: granteeEmail.toLowerCase() } })
  if (!grantee) {
    return NextResponse.json({ message: 'No account found with that login ID' }, { status: 404 })
  }
  if (grantee.id === session.userId) {
    return NextResponse.json({ message: 'This vault already belongs to you' }, { status: 400 })
  }

  const grant = await db.shareGrant.upsert({
    where: { ownerId_granteeId: { ownerId: session.userId, granteeId: grantee.id } },
    create: { ownerId: session.userId, granteeId: grantee.id, canWrite },
    update: { canWrite },
  })
  await logActivity(
    session.userId,
    'share.granted',
    `Shared vault with ${grantee.email}${canWrite ? ' (can edit)' : ' (view only)'}`,
  )

  return NextResponse.json({
    grant: {
      id: grant.id,
      canWrite: grant.canWrite,
      createdAt: grant.createdAt.toISOString(),
      owner: { id: session.userId, email: me.email },
      grantee: { id: grantee.id, email: grantee.email },
    } satisfies ShareDTO,
  })
}
