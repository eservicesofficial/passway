import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024 // 1.5 MB per file

// POST /api/notes/attachments — multipart upload (file + noteId)
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ message: 'Invalid form data' }, { status: 400 })
  }

  const noteId = String(form.get('noteId') ?? '')
  const file = form.get('file')
  if (!noteId || !(file instanceof File)) {
    return NextResponse.json({ message: 'noteId and file are required' }, { status: 400 })
  }

  const note = await db.note.findUnique({ where: { id: noteId } })
  if (!note || note.ownerId !== session.userId) {
    return NextResponse.json({ message: 'Note not found' }, { status: 404 })
  }
  if (note.deletedAt) {
    return NextResponse.json({ message: 'Restore the note before attaching files' }, { status: 400 })
  }

  const count = await db.attachment.count({ where: { noteId } })
  if (count >= 10) {
    return NextResponse.json({ message: 'A note can hold at most 10 attachments' }, { status: 400 })
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ message: 'Attachments are limited to 1.5 MB' }, { status: 400 })
  }
  const mime = file.type || 'application/octet-stream'
  if (mime.startsWith('text/html')) {
    return NextResponse.json({ message: 'HTML attachments are not allowed' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const name = file.name.slice(0, 120) || 'attachment'
  const att = await db.attachment.create({
    data: { noteId, name, mime, size: buf.length, dataB64: buf.toString('base64') },
    select: { id: true, name: true, mime: true, size: true },
  })
  await logActivity(session.userId, 'note.attachment', `Attached "${name}" to a note`)

  return NextResponse.json({ attachment: att }, { status: 201 })
}
