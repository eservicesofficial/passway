import type { Credential } from '@prisma/client'
import { decryptText } from '@/lib/crypto'
import type { CredentialDTO } from '@/lib/types'

interface GroupInfo {
  id: string
  name: string
  color: string
}

interface SerializeOptions {
  dek: Buffer
  group?: GroupInfo | null
  ownerEmail?: string
  dupCounts?: Map<string, number>
}

export function serializeCredential(row: Credential, opts: SerializeOptions): CredentialDTO {
  const decrypt = (enc: string | null): string | null => {
    if (!enc) return null
    try {
      return decryptText(enc, opts.dek)
    } catch {
      return null // ciphertext tampered / key mismatch -> never leak
    }
  }

  let tags: string[] = []
  try {
    const parsed = JSON.parse(row.tags)
    if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === 'string')
  } catch {
    tags = []
  }

  const dup = opts.dupCounts?.get(row.passwordHmac ?? '') ?? 0

  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerEmail: opts.ownerEmail,
    title: row.title,
    url: row.url,
    username: decrypt(row.usernameEnc),
    email: decrypt(row.emailEnc),
    password: decrypt(row.passwordEnc),
    notes: decrypt(row.notesEnc),
    groupId: row.groupId,
    groupName: opts.group?.name ?? null,
    groupColor: opts.group?.color ?? null,
    tags,
    favorite: row.favorite,
    status: (row.status === 'complete' || row.status === 'transferred' ? row.status : 'in_process') as CredentialDTO['status'],
    statusRemarks: row.statusRemarks,
    dupCount: row.passwordHmac ? Math.max(0, dup - 1) : 0,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
