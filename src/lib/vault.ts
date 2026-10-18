import { db } from '@/lib/db'
import { decryptBytes, getMasterKey } from '@/lib/crypto'

/**
 * Resolve the vault DEK for a given owner.
 * - Own vault: the DEK already lives in the session.
 * - Shared vault: unwrap the owner's server-wrapped DEK with the master key
 *   (which lives outside the database).
 */
export async function resolveVaultDek(
  ownerId: string,
  sessionUserId: string,
  sessionDek: Buffer,
): Promise<Buffer> {
  if (ownerId === sessionUserId) return sessionDek
  const ownerUser = await db.user.findUnique({ where: { id: ownerId } })
  if (!ownerUser) throw new Error('Vault owner not found')
  return decryptBytes(ownerUser.wrappedDekServer, getMasterKey())
}
