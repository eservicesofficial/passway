import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'

// GET /api/notes/attachments/[id] — download (owner only)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const att = await db.attachment.findUnique({ where: { id }, include: { note: true } })
  if (!att || att.note.ownerId !== session.userId) {
    return NextResponse.json({ message: 'Attachment not found' }, { status: 404 })
  }

  const buf = Buffer.from(att.dataB64, 'base64')
  const safeName = att.name.replace(/["\\\r\n]/g, '_')
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': att.mime,
      'content-length': String(buf.length),
      // force download; never render attacker HTML inline in our origin
      'content-disposition': `attachment; filename="${safeName}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  })
}

// DELETE /api/notes/attachments/[id] — remove
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await ctx.params

  const att = await db.attachment.findUnique({ where: { id }, include: { note: true } })
  if (!att || att.note.ownerId !== session.userId) {
    return NextResponse.json({ message: 'Attachment not found' }, { status: 404 })
  }
  await db.attachment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
