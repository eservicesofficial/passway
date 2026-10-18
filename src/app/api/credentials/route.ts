import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, getVaultAccess, requireAuth } from '@/lib/auth'
import { encryptText, passwordHmac } from '@/lib/crypto'
import { serializeCredential } from '@/lib/serialize'
import { credentialCreateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { purgeExpiredTrashLazy } from '@/lib/trash'
import { resolveVaultDek } from '@/lib/vault'
import { SortKey } from '@/lib/types'

function sortRows<T extends { favorite: boolean; title: string; updatedAt: string; createdAt: string }>(
  rows: T[],
  sort: SortKey,
): T[] {
  const sorted = [...rows]
  switch (sort) {
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      break
    case 'titleDesc':
      sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }))
      break
    case 'created':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    default:
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  return sorted
}

// GET /api/credentials?scope=all|favorites|trash|group&groupId=&shared=&q=&sort=&tag=&status=
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  await purgeExpiredTrashLazy()

  const sp = req.nextUrl.searchParams
  const scope = sp.get('scope') ?? 'all'
  const sharedOwner = sp.get('shared')
  const q = (sp.get('q') ?? '').trim().toLowerCase()
  const sort = (sp.get('sort') ?? 'updated') as SortKey
  const tagFilter = (sp.get('tag') ?? '').trim().toLowerCase()
  const statusFilter = sp.get('status')

  let ownerId = session.userId
  let canWrite = true
  if (sharedOwner) {
    const access = await getVaultAccess(session.userId, sharedOwner)
    if (!access) {
      return NextResponse.json({ message: 'You do not have access to this vault' }, { status: 403 })
    }
    ownerId = sharedOwner
    canWrite = access.canWrite
  }

  const trashed = scope === 'trash'
  const groupId = sp.get('groupId') || null

  // Use the vault owner's DEK (own vault -> session DEK; shared vault -> owner's server-wrapped DEK)
  const vaultDek = await resolveVaultDek(ownerId, session.userId, session.dek)

  const rows = await db.credential.findMany({
    where: {
      ownerId,
      deletedAt: trashed ? { not: null } : null,
      ...(scope === 'favorites' && !trashed ? { favorite: true } : {}),
      ...(scope === 'group' && groupId ? { groupId } : {}),
      ...(statusFilter && ['in_process', 'complete', 'transferred'].includes(statusFilter)
        ? { status: statusFilter }
        : {}),
    },
    include: { group: true },
    orderBy: { updatedAt: 'desc' },
  })

  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { email: true } })

  // Duplicate-password detection within this vault (keyed HMAC, never plaintext)
  const hmacCounts = new Map<string, number>()
  if (!trashed) {
    for (const row of rows) {
      if (row.passwordHmac) {
        hmacCounts.set(row.passwordHmac, (hmacCounts.get(row.passwordHmac) ?? 0) + 1)
      }
    }
  }

  const groupIdSet = new Set(rows.map((r) => r.groupId).filter(Boolean) as string[])
  const groups = groupIdSet.size
    ? await db.group.findMany({ where: { id: { in: [...groupIdSet] } } })
    : []
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  let credentials = rows.map((row) =>
    serializeCredential(row, {
      dek: vaultDek,
      group: row.group ?? (row.groupId ? groupMap.get(row.groupId) ?? null : null),
      // Surface the owner email only for shared vaults (own vault would be noise)
      ownerEmail: sharedOwner ? owner?.email : undefined,
      dupCounts: hmacCounts,
    }),
  )

  if (q) {
    credentials = credentials.filter((c) =>
      [c.title, c.url ?? '', c.username ?? '', c.email ?? '', c.notes ?? '', c.groupName ?? '', c.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }
  if (tagFilter) {
    credentials = credentials.filter((c) => c.tags.some((t) => t.toLowerCase() === tagFilter))
  }

  credentials = sortRows(credentials, sort)

  return NextResponse.json({ credentials, canWrite, ownerId })
}

// POST /api/credentials — create in own vault or a writable shared vault
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
  const parsed = credentialCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const input = parsed.data

  const ownerId = input.ownerId || session.userId
  const access = await getVaultAccess(session.userId, ownerId)
  if (!access) {
    return NextResponse.json({ message: 'You do not have access to this vault' }, { status: 403 })
  }
  if (!access.canWrite) {
    return NextResponse.json({ message: 'This vault is read-only for you' }, { status: 403 })
  }

  if (input.groupId) {
    const group = await db.group.findUnique({ where: { id: input.groupId } })
    if (!group || group.ownerId !== ownerId) {
      return NextResponse.json({ message: 'Invalid group' }, { status: 400 })
    }
  }

  const vaultDek = await resolveVaultDek(ownerId, session.userId, session.dek)

  const created = await db.credential.create({
    data: {
      ownerId,
      title: input.title,
      url: input.url || null,
      usernameEnc: input.username ? encryptText(input.username, vaultDek) : null,
      emailEnc: input.email ? encryptText(input.email, vaultDek) : null,
      passwordEnc: input.password ? encryptText(input.password, vaultDek) : null,
      notesEnc: input.notes ? encryptText(input.notes, vaultDek) : null,
      passwordHmac: input.password ? passwordHmac(input.password) : null,
      groupId: input.groupId ?? null,
      tags: JSON.stringify(input.tags ?? []),
      favorite: input.favorite ?? false,
      status: input.status === 'delete' ? 'in_process' : (input.status ?? 'in_process'),
      statusRemarks: input.status === 'transferred' && input.statusRemarks ? input.statusRemarks : null,
    },
    include: { group: true },
  })

  await logActivity(session.userId, 'credential.created', `Saved "${created.title}"`)

  return NextResponse.json(
    {
      credential: serializeCredential(created, {
        dek: vaultDek,
        group: created.group,
        dupCounts: new Map(),
      }),
    },
    { status: 201 },
  )
}
