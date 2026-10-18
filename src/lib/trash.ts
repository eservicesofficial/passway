import { db } from '@/lib/db'

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const g = globalThis as unknown as { __passwayLastPurge?: number; __passwayPurgeTimer?: boolean }

/** Permanently delete credentials and notes that have been in Trash for more than 30 days. */
export async function purgeExpiredTrash(): Promise<number> {
  const creds = await db.credential.deleteMany({
    where: { deletedAt: { lt: new Date(Date.now() - TRASH_RETENTION_MS) } },
  })
  const notes = await db.note.deleteMany({
    where: { deletedAt: { lt: new Date(Date.now() - TRASH_RETENTION_MS) } },
  })
  return creds.count + notes.count
}

/** Lazy purge: at most once every 10 minutes, triggered by API traffic. */
export async function purgeExpiredTrashLazy(): Promise<void> {
  const now = Date.now()
  if (g.__passwayLastPurge && now - g.__passwayLastPurge < 10 * 60 * 1000) return
  g.__passwayLastPurge = now
  try {
    await purgeExpiredTrash()
  } catch {
    // non-fatal
  }
}

// Background sweeper as a safety net for the 30-day automatic deletion.
if (!g.__passwayPurgeTimer) {
  g.__passwayPurgeTimer = true
  const timer = setInterval(() => {
    purgeExpiredTrash().catch(() => undefined)
  }, 60 * 60 * 1000)
  timer.unref?.()
}

export function daysLeftInTrash(deletedAt: Date): number {
  const remaining = TRASH_RETENTION_MS - (Date.now() - deletedAt.getTime())
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
}

export { TRASH_RETENTION_MS }
