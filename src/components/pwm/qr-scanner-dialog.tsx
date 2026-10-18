'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff, CheckCircle2, Keyboard, Loader2, MonitorSmartphone, ScanLine, ShieldCheck, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOverlayHistory } from '@/components/pwm/nav-history'
import { api } from '@/lib/client'
import { parsePairingPayload } from '@/lib/pairing-shared'
import { timeAgo } from '@/lib/ui'
import type { PairingInfoDTO } from '@/lib/types'

const SCANNER_ELEMENT_ID = 'passway-qr-scanner'

type ScanStage = 'scan' | 'confirm' | 'done'

/**
 * Mobile side of QR login: scan (or type) a pairing code, inspect which
 * computer is asking, then explicitly approve or deny its login request.
 */
export function QrScannerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [stage, setStage] = useState<ScanStage>('scan')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [info, setInfo] = useState<PairingInfoDTO | null>(null)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<'approved' | 'denied' | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const { closeViaUi } = useOverlayHistory(open, () => onOpenChange(false))

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current
    scannerRef.current = null
    setCameraReady(false)
    if (s) {
      try {
        await s.stop()
        await s.clear()
      } catch {
        // already stopped
      }
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    await stopCamera()
    // Camera needs the DOM node to exist
    await new Promise((r) => setTimeout(r, 120))
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded) => {
          if (handledRef.current) return
          handledRef.current = true
          const token = parsePairingPayload(decoded)
          if (!token) {
            handledRef.current = false
            return // unrelated QR content — keep scanning
          }
          await stopCamera()
          inspect(token)
        },
        () => undefined, // per-frame decode failures are normal
      )
      setCameraReady(true)
    } catch {
      setCameraError('Camera unavailable. Grant permission or type the code manually below.')
      handledRef.current = false
    }
     
  }, [stopCamera])

  async function inspect(token: string) {
    try {
      const d = await api<PairingInfoDTO>(`/api/auth/qr/info?token=${token}`)
      setInfo(d)
      setPendingToken(token)
      setStage('confirm')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'This pairing code is no longer valid')
      handledRef.current = false
    }
  }

  async function submit(action: 'approve' | 'deny') {
    if (!pendingToken) return
    setWorking(true)
    try {
      await api('/api/auth/qr/approve', { method: 'POST', body: { token: pendingToken, action } })
      setResult(action === 'approve' ? 'approved' : 'denied')
      setStage('done')
      toast.success(action === 'approve' ? 'PC login approved' : 'Login request denied')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setWorking(false)
    }
  }

  function reset() {
    handledRef.current = false
    setStage('scan')
    setInfo(null)
    setPendingToken(null)
    setResult(null)
    setManual('')
    setCameraError(null)
  }

  useEffect(() => {
    if (open) {
      reset()
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
     
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : closeViaUi())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Approve PC login
          </DialogTitle>
          <DialogDescription>
            Scan the pairing QR shown on the computer you want to approve. Codes are single-use and expire in 3 minutes.
          </DialogDescription>
        </DialogHeader>

        {stage === 'scan' && (
          <div className="space-y-3">
            <div
              id={SCANNER_ELEMENT_ID}
              className="mx-auto min-h-[220px] w-full overflow-hidden rounded-2xl border bg-black/90"
              aria-label="QR code camera scanner"
            />
            {!cameraReady && !cameraError && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
              </p>
            )}
            {cameraError && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <CameraOff className="h-4 w-4 shrink-0" /> {cameraError}
              </p>
            )}
            {cameraReady && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5" /> Point the camera at the QR code
              </p>
            )}

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Keyboard className="h-3 w-3" /> or enter code
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const token = parsePairingPayload(manual)
                if (!token) {
                  toast.error('That is not a valid Passway pairing code')
                  return
                }
                stopCamera()
                handledRef.current = true
                inspect(token)
              }}
            >
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="PASSWAY-LOGIN:…"
                className="h-10 font-mono text-xs"
                aria-label="Pairing code"
              />
              <Button type="submit" disabled={!manual.trim()} className="h-10 rounded-xl font-semibold">
                Check
              </Button>
            </form>
          </div>
        )}

        {stage === 'confirm' && info && (
          <div className="space-y-4 animate-view-in">
            <div className="rounded-2xl border bg-secondary/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MonitorSmartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {info.deviceLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested {timeAgo(info.createdAt)} · expires{' '}
                {new Date(info.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Approving signs this computer into your Passway account with a dedicated, revocable device session.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => submit('deny')} disabled={working}>
                <XCircle className="h-4 w-4" /> Deny
              </Button>
              <Button className="h-11 flex-1 rounded-xl font-semibold" onClick={() => submit('approve')} disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
              </Button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="space-y-4 py-2 text-center animate-view-in">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                result === 'approved' ? 'bg-emerald-500/10' : 'bg-destructive/10'
              }`}
            >
              {result === 'approved' ? (
                <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-7 w-7 text-destructive" />
              )}
            </div>
            <p className="text-sm font-semibold">
              {result === 'approved' ? 'The computer is signed in.' : 'The login request was denied.'}
            </p>
            {result === 'approved' && (
              <p className="text-xs text-muted-foreground">
                Manage or revoke this device anytime in Settings → Active devices.
              </p>
            )}
            <Button variant="outline" className="h-10 rounded-xl" onClick={reset}>
              Scan another code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
