import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Envelope encryption utilities.
 *
 * - Every account owns a random 32-byte Data Encryption Key (DEK).
 * - Secret vault fields are encrypted with the DEK using AES-256-GCM.
 * - The DEK is stored twice, always wrapped (never in plaintext):
 *     1. wrappedDekUser   -> wrapped with a KEK derived from the login
 *                            password via Argon2id (zero-trust at rest)
 *     2. wrappedDekServer -> wrapped with the server master key, which
 *                            lives OUTSIDE the database (env or key file)
 *                            and is what makes vault sharing possible
 *                            without ever exposing plaintext DEKs in the DB.
 */

const KEY_FILE = path.join(process.cwd(), 'db', 'master.key')

let cachedMasterKey: Buffer | null = null

export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey

  const fromEnv = process.env.VAULT_MASTER_KEY
  if (fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv.trim())) {
    cachedMasterKey = Buffer.from(fromEnv.trim(), 'hex')
    return cachedMasterKey
  }

  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
  if (fs.existsSync(KEY_FILE)) {
    const stored = fs.readFileSync(KEY_FILE, 'utf8').trim()
    if (/^[0-9a-f]{64}$/i.test(stored)) {
      cachedMasterKey = Buffer.from(stored, 'hex')
      return cachedMasterKey
    }
  }

  cachedMasterKey = crypto.randomBytes(32)
  fs.writeFileSync(KEY_FILE, cachedMasterKey.toString('hex') + '\n', { mode: 0o600 })
  return cachedMasterKey
}

export function randomHex(byteLength: number): string {
  return crypto.randomBytes(byteLength).toString('hex')
}

export function generateDek(): Buffer {
  return crypto.randomBytes(32)
}

/** AES-256-GCM encrypt arbitrary bytes. Output: v1.<iv>.<ciphertext>.<tag> (base64) */
export function encryptBytes(plain: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), ct.toString('base64'), tag.toString('base64')].join('.')
}

/** AES-256-GCM decrypt. Throws if the ciphertext or tag was tampered with. */
export function decryptBytes(payload: string, key: Buffer): Buffer {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Invalid ciphertext envelope')
  const iv = Buffer.from(parts[1], 'base64')
  const ct = Buffer.from(parts[2], 'base64')
  const tag = Buffer.from(parts[3], 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

export function encryptText(plain: string, key: Buffer): string {
  return encryptBytes(Buffer.from(plain, 'utf8'), key)
}

export function decryptText(payload: string, key: Buffer): string {
  return decryptBytes(payload, key).toString('utf8')
}

/** Irreversible keyed digest of a password, used for duplicate detection. */
export function passwordHmac(password: string): string {
  return crypto.createHmac('sha256', getMasterKey()).update(password, 'utf8').digest('hex')
}

/** Constant-time hex string comparison. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}
