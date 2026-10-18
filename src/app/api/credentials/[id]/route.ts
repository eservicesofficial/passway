import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, getVaultAccess, requireAuth } from '@/lib/auth'
import { encryptText, passwordHmac } from '@/lib/crypto'
import { serializeCredential } from '@/lib/serialize'
import { credentialUpdateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { resolveVaultDek } from '@/lib/vault'

// PATCH /api/credentials/[id] — field updates or actions (trash / restore / favorite)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const cred = await db.credential.findUnique({ where: { id }, include: { group: true } })
  if (!cred) return NextResponse.json({ message: 'Credential not found' }, { status: 404 })

  const access = await getVaultAccess(session.userId, cred.ownerId)
  if (!access) {
    return NextResponse.json({ message: 'You do not have access to this vault' }, { status: 403 })
  }
  if (!access.canWrite) {
    return NextResponse.json({ message: 'This vault is read-only for you' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  const parsed = credentialUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const input = parsed.data

  // ---- simple actions ----
  if (input.action === 'trash') {
    if (!cred.deletedAt) {
      await db.credential.update({ where: { id }, data: { deletedAt: new Date() } })
      await logActivity(session.userId, 'credential.trashed', `Moved "${cred.title}" to Trash`)
    }
    return NextResponse.json({ ok: true })
  }
  if (input.action === 'restore') {
    await db.credential.update({ where: { id }, data: { deletedAt: null, status: 'in_process', statusRemarks: null } })
    await logActivity(session.userId, 'credential.restored', `Restored "${cred.title}"`)
    return NextResponse.json({ ok: true })
  }
  if (input.action === 'favorite') {
    const favorite = input.value ?? !cred.favorite
    await db.credential.update({ where: { id }, data: { favorite } })
    return NextResponse.json({ ok: true, favorite })
  }

  // ---- field updates ----
  if (input.groupId) {
    const group = await db.group.findUnique({ where: { id: input.groupId } })
    if (!group || group.ownerId !== cred.ownerId) {
      return NextResponse.json({ message: 'Invalid group' }, { status: 400 })
    }
  }

  // ---- status transition: selecting "Delete" moves the item to Trash ----
  if (input.status === 'delete') {
    if (!cred.deletedAt) {
      await db.credential.update({ where: { id }, data: { deletedAt: new Date(), status: 'in_process' } })
      await logActivity(session.userId, 'credential.trashed', `"${cred.title}" moved to Trash (status set to Delete)`)
    }
    return NextResponse.json({ ok: true, trashed: true })
  }

  // ---- status transition: Transferred requires remarks ----
  if (input.status === 'transferred') {
    const remarks = (input.statusRemarks ?? cred.statusRemarks ?? '').trim()
    if (!remarks) {
      return NextResponse.json(
        { message: 'Remarks are required when marking a credential as Transferred' },
        { status: 400 },
      )
    }
  }

  const vaultDek = await resolveVaultDek(cred.ownerId, session.userId, session.dek)
  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = input.title
  if (input.url !== undefined) data.url = input.url || null
  if (input.username !== undefined)
    data.usernameEnc = input.username ? encryptText(input.username, vaultDek) : null
  if (input.password !== undefined) {
    data.passwordEnc = input.password ? encryptText(input.password, vaultDek) : null
    data.passwordHmac = input.password ? passwordHmac(input.password) : null
  }
  if (input.notes !== undefined)
    data.notesEnc = input.notes ? encryptText(input.notes, vaultDek) : null
  if (input.groupId !== undefined) data.groupId = input.groupId ?? null
  if (input.tags !== undefined) data.tags = JSON.stringify(input.tags)
  if (input.favorite !== undefined) data.favorite = input.favorite
  if (input.status !== undefined) {
    data.status = input.status
    // Remarks are only meaningful for Transferred; cleared otherwise
    data.statusRemarks =
      input.status === 'transferred'
        ? (input.statusRemarks ?? cred.statusRemarks ?? '').trim() || null
        : null
  } else if (input.statusRemarks !== undefined && cred.status === 'transferred') {
    data.statusRemarks = input.statusRemarks ? input.statusRemarks : null
  }

  const updated = await db.credential.update({
    where: { id },
    data,
    include: { group: true },
  })
  await logActivity(
    session.userId,
    input.status !== undefined ? 'credential.status' : 'credential.updated',
    input.status !== undefined
      ? `"${updated.title}" marked ${input.status === 'in_process' ? 'In Process' : input.status === 'complete' ? 'Complete' : 'Transferred'}`
      : `Edited "${updated.title}"`,
  )

  return NextResponse.json({
    credential: serializeCredential(updated, { dek: vaultDek, group: updated.group }),
  })
}

// DELETE /api/credentials/[id]?permanent=1
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params
  const permanent = req.nextUrl.searchParams.get('permanent') === '1'

  const cred = await db.credential.findUnique({ where: { id } })
  if (!cred) return NextResponse.json({ message: 'Credential not found' }, { status: 404 })

  const access = await getVaultAccess(session.userId, cred.ownerId)
  if (!access) {
    return NextResponse.json({ message: 'You do not have access to this vault' }, { status: 403 })
  }
  if (!access.canWrite) {
    return NextResponse.json({ message: 'This vault is read-only for you' }, { status: 403 })
  }

  if (permanent) {
    if (!cred.deletedAt) {
      return NextResponse.json(
        { message: 'Move the item to Trash before permanent deletion' },
        { status: 400 },
      )
    }
    await db.credential.delete({ where: { id } })
    await logActivity(session.userId, 'credential.purged', `Permanently deleted "${cred.title}"`)
  } else {
    if (!cred.deletedAt) {
      await db.credential.update({ where: { id }, data: { deletedAt: new Date() } })
      await logActivity(session.userId, 'credential.trashed', `Moved "${cred.title}" to Trash`)
    }
  }
  return NextResponse.json({ ok: true })
}
