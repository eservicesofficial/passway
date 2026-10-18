import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { createAccountSchema } from '@/lib/validation'
import { deriveSecret, kekFromPassword } from '@/lib/argon2'
import { encryptBytes, generateDek, getMasterKey, randomHex } from '@/lib/crypto'
import { logActivity } from '@/lib/activity'
import { AccountDTO } from '@/lib/types'

// GET /api/accounts — accounts directory for sharing flows
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const users = await db.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const grants = await db.shareGrant.findMany({
    where: { OR: [{ ownerId: session.userId }, { granteeId: session.userId }] },
    select: { ownerId: true, granteeId: true },
  })

  const accounts: AccountDTO[] = users.map((u) => {
    const isSelf = u.id === session.userId
    const grantedToMe = grants.some((g) => g.ownerId === u.id && g.granteeId === session.userId)
    const iGranted = grants.some((g) => g.ownerId === session.userId && g.granteeId === u.id)
    return {
      id: u.id,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      isSelf,
      // A user may delegate vaults they can already access: their own, or ones shared with them.
      shareable: isSelf || grantedToMe,
      iGranted,
      grantedToMe,
    }
  })

  return NextResponse.json({ accounts })
}

// POST /api/accounts — create a new login account, optionally sharing selected vaults with it
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
  const parsed = createAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { loginId, password, shareWith, canWrite } = parsed.data
  const email = loginId.toLowerCase()

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ message: 'An account with that login ID already exists' }, { status: 409 })
  }

  // Authorize each requested vault: caller must own it or already have access to it.
  const me = await db.user.findUnique({ where: { id: session.userId } })
  if (!me) return NextResponse.json({ message: 'Account not found' }, { status: 404 })

  const myGrants = await db.shareGrant.findMany({ where: { granteeId: session.userId } })
  const accessibleOwnerIds = new Set([session.userId, ...myGrants.map((g) => g.ownerId)])
  const authorizedTargets = shareWith.filter((id) => accessibleOwnerIds.has(id))
  const denied = shareWith.length - authorizedTargets.length

  const authSalt = randomHex(16)
  const kekSalt = randomHex(16)
  const authHash = await deriveSecret(password, authSalt)
  const dek = generateDek()
  const kek = await kekFromPassword(password, kekSalt)

  const created = await db.user.create({
    data: {
      email,
      authSalt,
      kekSalt,
      authHash,
      wrappedDekUser: encryptBytes(dek, kek),
      wrappedDekServer: encryptBytes(dek, getMasterKey()),
      mustChangePassword: false,
    },
  })

  if (authorizedTargets.length) {
    await db.shareGrant.createMany({
      data: authorizedTargets.map((ownerId) => ({
        ownerId,
        granteeId: created.id,
        canWrite,
      })),
    })
  }

  await logActivity(session.userId, 'account.created', `Created account "${created.email}"`)
  if (authorizedTargets.length) {
    await logActivity(
      session.userId,
      'share.granted',
      `Linked ${authorizedTargets.length} vault${authorizedTargets.length === 1 ? '' : 's'} to ${created.email}`,
    )
  }

  return NextResponse.json(
    {
      account: {
        id: created.id,
        email: created.email,
        createdAt: created.createdAt.toISOString(),
        isSelf: false,
        shareable: false,
        iGranted: false,
        grantedToMe: false,
      } satisfies AccountDTO,
      granted: authorizedTargets.length,
      denied,
    },
    { status: 201 },
  )
}
