import { randomHex } from './crypto'
import { createHash } from 'crypto'

/**
 * Server-side session store (in-memory).
 * A session holds the unwrapped vault DEK for the logged-in account so that
 * vault APIs can encrypt/decrypt. DEKs never leave the server process and are
 * never persisted in plaintext. Cookies are HttpOnly; tokens are 48-byte random.
 */

export const SESSION_COOKIE = 'passway_session'
export const CSRF_COOKIE = 'passway_csrf'

const SESSION_IDLE_MS = 2 * 60 * 60 * 1000 // 2h inactivity -> expired
const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000 // 12h absolute cap

export interface Session {
  token: string
  userId: string
  dek: Buffer
  deviceLabel: string
  via: string // how the session was created: password | qr
  createdAt: number
  lastSeen: number
  expiresAt: number
}

const g = globalThis as unknown as {
  __passwaySessions?: Map<string, Session>
  __passwaySessionSweeper?: NodeJS.Timeout
}
const sessions: Map<string, Session> = (g.__passwaySessions ??= new Map())

if (!g.__passwaySessionSweeper) {
  g.__passwaySessionSweeper = setInterval(() => {
    const now = Date.now()
    for (const [token, s] of sessions) {
      if (now > s.expiresAt || now > s.createdAt + SESSION_ABSOLUTE_MS) sessions.delete(token)
    }
  }, 10 * 60 * 1000)
  g.__passwaySessionSweeper.unref?.()
}

export function createSession(
  userId: string,
  dek: Buffer,
  meta?: { deviceLabel?: string; via?: string },
): Session {
  const now = Date.now()
  const session: Session = {
    token: randomHex(48),
    userId,
    dek,
    deviceLabel: meta?.deviceLabel ?? 'Unknown device',
    via: meta?.via ?? 'password',
    createdAt: now,
    lastSeen: now,
    expiresAt: now + SESSION_IDLE_MS,
  }
  sessions.set(session.token, session)
  return session
}

/** Stable public handle for a session token (safe to expose to the client). */
export function sessionHandle(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
}

export function listUserSessions(userId: string): Session[] {
  const out: Session[] = []
  for (const s of sessions.values()) {
    if (s.userId === userId) out.push(s)
  }
  return out.sort((a, b) => b.lastSeen - a.lastSeen)
}

export function getSession(token: string | undefined | null): Session | null {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  const now = Date.now()
  if (now > session.expiresAt || now > session.createdAt + SESSION_ABSOLUTE_MS) {
    sessions.delete(token)
    return null
  }
  session.lastSeen = now
  session.expiresAt = Math.min(session.createdAt + SESSION_ABSOLUTE_MS, now + SESSION_IDLE_MS)
  return session
}

export function destroySession(token: string | undefined | null): void {
  if (token) sessions.delete(token)
}

export function destroyUserSessions(userId: string, exceptToken?: string): void {
  for (const [token, s] of sessions) {
    if (s.userId === userId && token !== exceptToken) sessions.delete(token)
  }
}

export function sessionCookieOptions(https = false) {
  return {
    httpOnly: true,
    // SameSite=None lets the session work inside cross-site preview iframes;
    // Chrome requires the Secure attribute for None, so it is always set
    // behind HTTPS. Direct HTTP access keeps classic Lax.
    sameSite: (https ? 'none' : 'lax') as 'none' | 'lax',
    secure: https || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  }
}

export function clearCookieOptions(https = false) {
  return { ...sessionCookieOptions(https), maxAge: 0 }
}

/**
 * CSRF double-submit cookie. Readable by the client (NOT HttpOnly) so the
 * frontend can echo it back in the `x-csrf-token` header. Unreachable by
 * third-party origins, so it cannot be forged cross-site.
 */
export function csrfCookieOptions(https = false, maxAgeSec = Math.floor(SESSION_ABSOLUTE_MS / 1000)) {
  return {
    httpOnly: false,
    sameSite: (https ? 'none' : 'lax') as 'none' | 'lax',
    secure: https || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSec,
  }
}
