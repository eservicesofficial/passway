import { createHash } from 'crypto'
import { QR_PAYLOAD_PREFIX } from './pairing-shared'

export const PAIRING_TTL_MS = 3 * 60 * 1000 // QR codes expire after 3 minutes

export function sha256Hex(v: string): string {
  return createHash('sha256').update(v, 'utf8').digest('hex')
}

export function pairingExpiry(): Date {
  return new Date(Date.now() + PAIRING_TTL_MS)
}

export { QR_PAYLOAD_PREFIX, parsePairingPayload } from './pairing-shared'
