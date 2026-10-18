import type { Note } from '@prisma/client'
import type { NoteDTO } from '@/lib/types'

/**
 * Extract #tags from note content (Memos-style inline tags).
 * A tag is `#` followed by letters/digits/underscore/hyphen, not preceded by a word char.
 */
export function extractNoteTags(content: string): string[] {
  const tags = new Set<string>()
  const re = /(?:^|[^A-Za-z0-9_])#([A-Za-z0-9_-]{1,32})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    tags.add(m[1].toLowerCase())
    if (tags.size >= 12) break
  }
  return [...tags]
}

type NoteWithAttachments = Note & {
  attachments: { id: string; name: string; mime: string; size: number }[]
}

export function serializeNote(row: NoteWithAttachments): NoteDTO {
  return {
    id: row.id,
    content: row.content,
    pinned: row.pinned,
    tags: extractNoteTags(row.content),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachments: row.attachments.map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size })),
  }
}

/** Snippet: first line of markdown without syntax noise (for compact previews). */
export function notePreview(content: string, max = 220): string {
  const line =
    content
      .split('\n')
      .map((l) => l.replace(/^[#>\-*\s\[\]x]+/, '').trim())
      .find((l) => l.length > 0) ?? ''
  return line.length > max ? line.slice(0, max) + '…' : line
}
