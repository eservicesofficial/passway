'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { Check, Copy, Loader2, MonitorSmartphone, QrCode, RefreshCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, copyToClipboard } from '@/lib/client'
import { QR_PAYLOAD_PREFIX } from '@/lib/pairing-shared'
import type { UserInfo } from '@/lib/types'

type PollState = 'idle' | 'waiting' | 'approved' | 'denied' | 'expired'

/**
 * PC side of QR login: displays an expiring, single-use pairing QR and polls
 * for approval from an already-authenticated device. The QR payload contains
 * only the opaque pairing token — never credentials or session secrets.
 */
export function QrLoginPanel({
  onApproved,
  onBack,
}: {
  onApproved: (user: UserInfo) => void
  onBack: () => void
}) {
  const [token, setToken] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [state, setState] = useState<PollState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  async function copyCode() {
    if (!token) return
    const ok = await copyToClipboard(token)
    if (ok) {
      setCopied(true)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
      toast.success('Manual code copied', { description: 'Paste it into the Passway app to approve this login.' })
    } else {
      toast.error('Could not copy — select the code and copy it manually')
    }
  }

  const stopTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    pollRef.current = null
    tickRef.current = null
  }, [])

  const createPairing = useCallback(async () => {
    stopTimers()
    setState('idle')
    setError(null)
    setToken(null)
    setQrDataUrl(null)
    try {
      const res = await api<{ token: string; expiresAt: string }>('/api/auth/qr/create', { method: 'POST' })
      const url = await QRCode.toDataURL(`${QR_PAYLOAD_PREFIX}:${res.token}`, {
        width: 220,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      setToken(res.token)
      setQrDataUrl(url)
      setExpiresAt(new Date(res.expiresAt))
      setState('waiting')

      const started = Date.now()
      pollRef.current = setInterval(async () => {
        // Stop after the pairing window has passed
        if (Date.now() - started > 3 * 60 * 1000 + 2000) {
          stopTimers()
          setState('expired')
          return
        }
        try {
          const s = await api<{ status: 'pending' | 'approved' | 'denied' | 'expired' }>(
            `/api/auth/qr/status?token=${res.token}`,
          )
          if (s.status === 'approved') {
            stopTimers()
            setState('approved')
            // The server attached the PC session cookie to this poll response
            const me = await api<{ user: UserInfo }>('/api/auth/me')
            onApproved(me.user)
          } else if (s.status === 'denied') {
            stopTimers()
            setState('denied')
          } else if (s.status === 'expired') {
            stopTimers()
            setState('expired')
          }
        } catch {
          // transient network hiccup — keep polling
        }
      }, 2500)

      tickRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil(((new Date(res.expiresAt)).getTime() - Date.now()) / 1000))
        setRemaining(left)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start QR pairing')
      setState('expired')
    }
  }, [onApproved, stopTimers])

  useEffect(() => {
    let cancelled = false
    // Defer past the render phase so the pairing setup can update state safely
    void Promise.resolve().then(() => {
      if (!cancelled) createPairing()
    })
    return () => {
      cancelled = true
      stopTimers()
    }
  }, [createPairing, stopTimers])

  return (
    <div className="animate-view-in" aria-label="QR login">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to password sign-in
      </button>

      <div className="rounded-2xl border bg-card/80 p-5 text-center shadow-sm backdrop-blur sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
          <MonitorSmartphone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="mt-3 text-lg font-bold tracking-tight">Approve with your phone</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          Scan this code with the Passway app on a device that is already signed in, then confirm the login.
        </p>

        <div className="mx-auto mt-4 w-fit rounded-2xl border bg-white p-3 shadow-inner">
          {qrDataUrl ? (

            <img src={qrDataUrl} alt="Login pairing QR code" width={180} height={180} className="rounded-lg" />
          ) : (
            <div className="flex h-[180px] w-[180px] items-center justify-center rounded-lg bg-slate-100">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        <div className="mt-3 min-h-10" aria-live="polite">
          {state === 'waiting' && (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for approval
              {remaining > 0 && <span className="tabular-nums text-xs">· {remaining}s</span>}
            </p>
          )}
          {state === 'approved' && (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Approved — unlocking…
            </p>
          )}
          {state === 'denied' && (
            <p className="text-sm font-medium text-destructive">The request was denied on your device.</p>
          )}
          {(state === 'expired' || (!token && state !== 'idle')) && (
            <p className="text-sm font-medium text-muted-foreground">
              {error ?? 'This code has expired.'}
            </p>
          )}
        </div>

        {token && (
          <div className="mx-auto mt-1 w-full max-w-[300px] text-left">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              No camera? Enter this manual code in the Passway app instead:
            </p>
            <div className="flex items-stretch gap-1.5">
              <code className="min-w-0 flex-1 break-all rounded-lg border bg-secondary/70 px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                {token}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-auto w-9 shrink-0 rounded-lg"
                onClick={copyCode}
                aria-label="Copy manual code"
                title="Copy manual code"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {state !== 'approved' && (
          <Button variant="outline" onClick={createPairing} className="mt-3 h-10 rounded-xl font-semibold">
            <RefreshCcw className="h-4 w-4" /> {state === 'waiting' ? 'Regenerate code' : 'Generate a new code'}
          </Button>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <QrCode className="h-3 w-3" /> Codes expire in 3 minutes and work exactly once
        </p>
      </div>
    </div>
  )
}
