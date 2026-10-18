/** Client-safe pairing constants (no Node APIs) — shared by PC and mobile UI. */

export const QR_PAYLOAD_PREFIX = 'PASSWAY-LOGIN'

/** Accepts the scanned payload or a manually typed token. */
export function parsePairingPayload(raw: string): string | null {
  const s = raw.trim()
  const m = s.match(new RegExp(`^${QR_PAYLOAD_PREFIX}:([0-9a-f]{64})$`, 'i'))
  if (m) return m[1].toLowerCase()
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase() // manual code entry
  return null
}
