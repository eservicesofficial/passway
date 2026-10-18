import { argon2id } from 'hash-wasm'

/**
 * Argon2id password hashing & key derivation.
 * Parameters follow current OWASP guidance (m >= 19 MiB, t >= 2, p = 1).
 */
const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 32768, // 32 MiB
  hashLength: 32,
} as const

/** Derive a 32-byte secret (hex) from a password + salt. Used for both the
 *  authentication digest and the key-encryption-key (with separate salts). */
export async function deriveSecret(password: string, saltHex: string): Promise<string> {
  return argon2id({
    ...ARGON2_PARAMS,
    password,
    salt: Buffer.from(saltHex, 'hex'),
    outputType: 'hex',
  })
}

export function kekFromPassword(password: string, saltHex: string): Promise<Buffer> {
  return deriveSecret(password, saltHex).then((hex) => Buffer.from(hex, 'hex'))
}
