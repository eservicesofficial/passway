import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { destroySession, SESSION_COOKIE, CSRF_COOKIE, clearCookieOptions } from '@/lib/session'
import { csrfOk, requestIsHttps } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const https = requestIsHttps(req)
  const jar = await cookies()
  destroySession(jar.get(SESSION_COOKIE)?.value)
  jar.set(SESSION_COOKIE, '', clearCookieOptions(https))
  jar.set(CSRF_COOKIE, '', clearCookieOptions(https))
  return NextResponse.json({ ok: true })
}
