import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { serializeNote } from '@/lib/notes'
import { noteCreateSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { purgeExpiredTrashLazy } from '@/lib/trash'
import type { SortKey } from '@/lib/types'

function sortNotes<T extends { pinned: boolean; updatedAt: string; createdAt: string }>(rows: T[], sort: SortKey): T[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    switch (sort) {
      case 'created':
        return b.createdAt.localeCompare(a.createdAt)
      case 'title':
      case 'titleDesc':
      default:
        return b.updatedAt.localeCompare(a.updatedAt)
    }
  })
  return sorted
}

// GET /api/notes?scope=all|trash&q=&tag=&sort=
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  await purgeExpiredTrashLazy()

  const sp = req.nextUrl.searchParams
  const scope = sp.get('scope') ?? 'all'
  const q = (sp.get('q') ?? '').trim().toLowerCase()
  const tag = (sp.get('tag') ?? '').trim().toLowerCase()
  const sort = (sp.get('sort') ?? 'updated') as SortKey
  const trashed = scope === 'trash'

  const rows = await db.note.findMany({
    where: { ownerId: session.userId, deletedAt: trashed ? { not: null } : null },
    include: { attachments: { select: { id: true, name: true, mime: true, size: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  let notes = rows.map(serializeNote)
  if (q) {
    notes = notes.filter((n) => n.content.toLowerCase().includes(q))
  }
  if (tag) {
    notes = notes.filter((n) => n.tags.includes(tag))
  }
  notes = sortNotes(notes, sort)

  return NextResponse.json({ notes })
}

// POST /api/notes — create
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
  const parsed = noteCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const created = await db.note.create({
    data: {
      ownerId: session.userId,
      content: parsed.data.content,
      pinned: parsed.data.pinned ?? false,
    },
    include: { attachments: { select: { id: true, name: true, mime: true, size: true } } },
  })
  await logActivity(session.userId, 'note.created', 'Created a note')

  return NextResponse.json({ note: serializeNote(created) }, { status: 201 })
}
