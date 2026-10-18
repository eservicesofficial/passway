/**
 * Fixed-window in-memory rate limiter.
 * Used for login brute-force protection (per IP and per login ID).
 */

interface Bucket {
  count: number
  resetAt: number
}

const g = globalThis as unknown as {
  __passwayRateBuckets?: Map<string, Bucket>
  __passwayRateSweeper?: NodeJS.Timeout
}
const buckets: Map<string, Bucket> = (g.__passwayRateBuckets ??= new Map())

if (!g.__passwayRateSweeper) {
  g.__passwayRateSweeper = setInterval(() => {
    const now = Date.now()
    for (const [key, b] of buckets) {
      if (now > b.resetAt) buckets.delete(key)
    }
  }, 60 * 1000)
  g.__passwayRateSweeper.unref?.()
}

export interface RateResult {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

export function checkRate(key: string, max: number, windowMs: number): RateResult {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1, retryAfterSec: 0 }
  }
  bucket.count += 1
  if (bucket.count > max) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, remaining: max - bucket.count, retryAfterSec: 0 }
}

export function resetRate(key: string): void {
  buckets.delete(key)
}
