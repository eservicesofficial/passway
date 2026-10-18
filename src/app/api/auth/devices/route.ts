import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { csrfOk, requireAuth } from '@/lib/auth'
import { destroySession, listUserSessions, sessionHandle } from '@/lib/session'
import { logActivity } from '@/lib/activity'

// GET /api/auth/devices — active sessions for the current user (revocable devices)
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const currentHandle = sessionHandle(session.token)
  const devices = listUserSessions(session.userId).map((s) => ({
    id: sessionHandle(s.token),
    deviceLabel: s.deviceLabel,
    via: s.via,
    lastSeen: new Date(s.lastSeen).toISOString(),
    createdAt: new Date(s.createdAt).toISOString(),
    current: sessionHandle(s.token) === currentHandle,
  }))

  return NextResponse.json({ devices })
}

// POST /api/auth/devices — revoke a device session { id }
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) {
    return NextResponse.json({ message: 'Blocked: cross-origin request' }, { status: 403 })
  }
  const { session, error } = await requireAuth()
  if (error) return error

  let body: { id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!/^[0-9a-f]{16}$/.test(id)) {
    return NextResponse.json({ message: 'Invalid device id' }, { status: 400 })
  }

  const currentHandle = sessionHandle(session.token)
  if (id === currentHandle) {
    return NextResponse.json({ message: 'Use sign out to end the current session' }, { status: 400 })
  }

  const target = listUserSessions(session.userId).find((s) => sessionHandle(s.token) === id)
  if (!target) {
    return NextResponse.json({ message: 'Device session not found' }, { status: 404 })
  }

  destroySession(target.token)
  await logActivity(session.userId, 'device.revoked', `Revoked device session (${target.deviceLabel})`)
  return NextResponse.json({ ok: true })
}
