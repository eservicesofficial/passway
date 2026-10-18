'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  AtSign,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Star,
  StickyNote,
  Tag,
  UserRound,
  UsersRound,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { StrengthMeter } from '@/components/pwm/strength-meter'
import { StatusChip } from '@/components/pwm/status'
import { useOverlayHistory } from '@/components/pwm/nav-history'
import { copyToClipboard } from '@/lib/client'
import { avatarColor, formatDate, hostOf, initials, urlHref } from '@/lib/ui'
import type { CredentialDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

export function CredentialDetailDialog({
  cred,
  canWrite = true,
  open,
  onOpenChange,
  onEdit,
}: {
  cred: CredentialDTO | null
  canWrite?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (cred: CredentialDTO) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const { closeViaUi } = useOverlayHistory(open, () => onOpenChange(false))

  if (!cred) return null

  async function copy(text: string | null, label: string) {
    if (!text) {
      toast.error(`No ${label} saved`)
      return
    }
    const ok = await copyToClipboard(text)
    if (ok) toast.success(`${label} copied to clipboard`)
    else toast.error(`Could not copy ${label}`)
  }

  const color = avatarColor(cred.title + cred.id.slice(-4))
  const href = urlHref(cred.url)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRevealed(false); closeViaUi(); return }; onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3.5 pt-1">
            <span
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-md"
              style={{ backgroundColor: color, width: 52, height: 52 }}
              aria-hidden="true"
            >
              {initials(cred.title)}
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg">{cred.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {cred.url ? (
                  <a href={href ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-400 hover:underline">
                    {hostOf(cred.url)} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  'No website URL'
                )}
                {ownerLabel(cred)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {cred.dupCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 animate-view-in">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">Reused password.</span> This password is used on {cred.dupCount} other{' '}
                {cred.dupCount === 1 ? 'item' : 'items'} in this vault. Consider generating a unique one.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border bg-secondary/40 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <StatusChip status={cred.status} className="px-2 py-0.5 text-[11px]" />
          </div>

          {cred.status === 'transferred' && cred.statusRemarks && (
            <FieldRow icon={AlertTriangle} label="Transfer remarks">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{cred.statusRemarks}</p>
            </FieldRow>
          )}

          <FieldRow icon={UserRound} label="Username">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-sm">{cred.username || <span className="text-muted-foreground">—</span>}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(cred.username, 'Username')} aria-label="Copy username">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </FieldRow>

          <FieldRow icon={AtSign} label="Email">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-sm">{cred.email || <span className="text-muted-foreground">—</span>}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(cred.email, 'Email')} aria-label="Copy email">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </FieldRow>

          <FieldRow icon={KeyRound} label="Password">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-mono text-sm" aria-live="polite">
                {cred.password ? (revealed ? cred.password : '••••••••••••') : <span className="font-sans text-muted-foreground">—</span>}
              </span>
              {cred.password && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setRevealed((v) => !v)} aria-label={revealed ? 'Hide password' : 'Reveal password'}>
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(cred.password, 'Password')} aria-label="Copy password">
                {revealed ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {cred.password && <StrengthMeter password={cred.password} className="mt-2" />}
          </FieldRow>

          {cred.groupName && (
            <FieldRow icon={UsersRound} label="Group">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: (cred.groupColor ?? '#10b981') + '18', color: cred.groupColor ?? '#10b981' }}>
                {cred.groupName}
              </span>
            </FieldRow>
          )}

          {cred.tags.length > 0 && (
            <FieldRow icon={Tag} label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {cred.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="rounded-full text-[11px] font-normal">
                    #{t}
                  </Badge>
                ))}
              </div>
            </FieldRow>
          )}

          {cred.notes && (
            <FieldRow icon={StickyNote} label="Notes">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{cred.notes}</p>
            </FieldRow>
          )}

          <Separator />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Created {formatDate(cred.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3" /> {cred.favorite ? 'Favorited' : 'Not favorited'}
            </span>
            <span>Updated {formatDate(cred.updatedAt)}</span>
          </div>

          {canWrite && onEdit && (
            <Button
              className="w-full h-10 rounded-xl font-semibold"
              onClick={() => {
                closeViaUi()
                onEdit(cred)
              }}
            >
              <Pencil className="h-4 w-4" /> Edit credential
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ownerLabel(cred: CredentialDTO) {
  return cred.ownerEmail ? (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <UsersRound className="h-3 w-3" /> from {cred.ownerEmail}
    </span>
  ) : null
}

function FieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-secondary/40 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn('h-3 w-3')} />
        {label}
      </div>
      {children}
    </div>
  )
}
