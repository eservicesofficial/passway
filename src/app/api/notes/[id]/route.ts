import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { serializeNote } from '@/lib/notes'
import { noteUpdateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'

async function loadOwnedNote(id: string, userId: string) {
  const note = await db.note.findUnique({ where: { id } })
  if (!note || note.ownerId !== userId) return null
  return note
}

// PATCH /api/notes/[id] — content edit (autosave), pin, trash, restore, purge
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const note = await loadOwnedNote(id, session.userId)
  if (!note) return NextResponse.json({ message: 'Note not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  const parsed = noteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const input = parsed.data

  if (input.action === 'trash') {
    if (!note.deletedAt) {
      await db.note.update({ where: { id }, data: { deletedAt: new Date(), pinned: false } })
      await logActivity(session.userId, 'note.trashed', 'Moved a note to Trash')
    }
    return NextResponse.json({ ok: true })
  }
  if (input.action === 'restore') {
    await db.note.update({ where: { id }, data: { deletedAt: null } })
    await logActivity(session.userId, 'note.restored', 'Restored a note from Trash')
    return NextResponse.json({ ok: true })
  }
  if (input.action === 'purge') {
    if (!note.deletedAt) {
      return NextResponse.json({ message: 'Move the note to Trash first' }, { status: 400 })
    }
    await db.note.delete({ where: { id } }) // attachments cascade
    await logActivity(session.userId, 'note.purged', 'Permanently deleted a note')
    return NextResponse.json({ ok: true })
  }
  if (input.action === 'pin') {
    const pinned = input.value ?? !note.pinned
    await db.note.update({ where: { id }, data: { pinned } })
    return NextResponse.json({ ok: true, pinned })
  }

  const data: Record<string, unknown> = {}
  if (input.content !== undefined) {
    if (note.deletedAt) {
      return NextResponse.json({ message: 'Restore the note before editing' }, { status: 400 })
    }
    data.content = input.content
  }
  const updated = await db.note.update({
    where: { id },
    data,
    include: { attachments: { select: { id: true, name: true, mime: true, size: true } } },
  })
  return NextResponse.json({ note: serializeNote(updated) })
}

// DELETE /api/notes/[id]?permanent=1 — soft delete to Trash (or purge)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params
  const permanent = req.nextUrl.searchParams.get('permanent') === '1'

  const note = await loadOwnedNote(id, session.userId)
  if (!note) return NextResponse.json({ message: 'Note not found' }, { status: 404 })

  if (permanent) {
    if (!note.deletedAt) {
      return NextResponse.json({ message: 'Move the note to Trash first' }, { status: 400 })
    }
    await db.note.delete({ where: { id } })
    await logActivity(session.userId, 'note.purged', 'Permanently deleted a note')
  } else if (!note.deletedAt) {
    await db.note.update({ where: { id }, data: { deletedAt: new Date(), pinned: false } })
    await logActivity(session.userId, 'note.trashed', 'Moved a note to Trash')
  }
  return NextResponse.json({ ok: true })
}
