import { db } from '@/lib/db'
import { deriveSecret } from '@/lib/argon2'
import { encryptBytes, generateDek, getMasterKey, randomHex } from '@/lib/crypto'

/**
 * Idempotent bootstrap: creates the initial admin account on first run.
 *   Login ID: admin@es.com
 *   Password: 741504  (forced change on first login)
 */

const g = globalThis as unknown as { __passwaySeeded?: boolean }

export async function ensureSeeded(): Promise<void> {
  if (g.__passwaySeeded) return
  try {
    const count = await db.user.count()
    if (count === 0) {
      const authSalt = randomHex(16)
      const kekSalt = randomHex(16)
      const password = '741504'
      const authHash = await deriveSecret(password, authSalt)
      const dek = generateDek()
      const kek = Buffer.from(await deriveSecret(password, kekSalt), 'hex')
      await db.user.create({
        data: {
          email: 'admin@es.com',
          authSalt,
          kekSalt,
          authHash,
          wrappedDekUser: encryptBytes(dek, kek),
          wrappedDekServer: encryptBytes(dek, getMasterKey()),
          mustChangePassword: true,
        },
      })
    }
    g.__passwaySeeded = true
  } catch {
    // Swallow transient DB errors; next request retries.
  }
}
