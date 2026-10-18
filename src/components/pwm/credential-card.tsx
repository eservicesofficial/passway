'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AtSign,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
  Undo2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusChip } from '@/components/pwm/status'
import { copyToClipboard } from '@/lib/client'
import { avatarColor, hostOf, initials } from '@/lib/ui'
import type { CredentialDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CredentialCardProps {
  cred: CredentialDTO
  canWrite?: boolean
  variant?: 'default' | 'trash'
  onChanged: (cred: CredentialDTO, change: 'favorite' | 'trash' | 'restore' | 'delete') => void
  onEdit?: (cred: CredentialDTO) => void
  onOpen?: (cred: CredentialDTO) => void
  ownerLabel?: string
}

export function CredentialCard({
  cred,
  canWrite = true,
  variant = 'default',
  onChanged,
  onEdit,
  onOpen,
  ownerLabel,
}: CredentialCardProps) {
  const [revealed, setRevealed] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  function reveal() {
    setRevealed((v) => {
      const next = !v
      if (next) {
        if (hideTimer.current) clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => setRevealed(false), 12000)
      }
      return next
    })
  }

  async function copy(text: string | null, label: string) {
    if (!text) {
      toast.error(`No ${label} saved`)
      return
    }
    const ok = await copyToClipboard(text)
    if (ok) toast.success(`${label} copied to clipboard`, { description: 'Clears automatically from history-free clipboard use.' })
    else toast.error(`Could not copy ${label}`)
  }

  const color = avatarColor(cred.title + cred.id.slice(-4))
  const isTrash = variant === 'trash'
  const daysLeft = cred.deletedAt
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(cred.deletedAt).getTime()) / 86400000))
    : 0

  return (
    <article
      className={cn(
        'group relative @container rounded-2xl border bg-card p-4 transition-all duration-200',
        !isTrash && 'hover:shadow-lg hover:shadow-emerald-900/5 hover:border-emerald-500/30 hover:-translate-y-0.5',
      )}
      aria-label={`Credential: ${cred.title}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onOpen?.(cred)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left rounded-xl focus-visible:outline-2 focus-visible:outline-emerald-600"
          aria-label={`View details for ${cred.title}`}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          >
            {initials(cred.title)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-sm">{cred.title}</span>
              {cred.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />}
              {!isTrash && <StatusChip status={cred.status} />}
              {cred.dupCount > 0 && (
                <Badge variant="outline" className="h-4.5 shrink-0 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  reused
                </Badge>
              )}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {revealed ? (
                <span className="truncate font-mono" aria-live="polite">
                  {cred.password || '—'}
                </span>
              ) : (
                <>
                  {ownerLabel && <span className="shrink-0 rounded bg-secondary px-1 py-px text-[10px] font-medium">{ownerLabel}</span>}
                  <span className="truncate">{cred.username || cred.email || hostOf(cred.url) || 'No username'}</span>
                </>
              )}
            </span>
            {(cred.groupName || cred.tags.length > 0) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-1">
                {cred.groupName && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium" style={{ backgroundColor: (cred.groupColor ?? '#10b981') + '18', color: cred.groupColor ?? '#10b981' }}>
                    {cred.groupName}
                  </span>
                )}
                {cred.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full bg-secondary px-1.5 py-px text-[10px] text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </span>
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {!isTrash && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={cred.favorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => !canWrite || onChanged({ ...cred, favorite: !cred.favorite }, 'favorite')}
              disabled={!canWrite}
            >
              <Star className={cn('h-4 w-4', cred.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`More actions for ${cred.title}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {onOpen && (
                <DropdownMenuItem onClick={() => onOpen(cred)}>
                  <Eye className="h-4 w-4" /> View details
                </DropdownMenuItem>
              )}
              {!isTrash && (
                <>
                  <DropdownMenuItem onClick={() => copy(cred.username, 'Username')}>
                    <UserRound className="h-4 w-4" /> Copy username
                  </DropdownMenuItem>
                  {cred.email && (
                    <DropdownMenuItem onClick={() => copy(cred.email, 'Email')}>
                      <AtSign className="h-4 w-4" /> Copy email
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => copy(cred.password, 'Password')}>
                    <KeyRound className="h-4 w-4" /> Copy password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={reveal}>
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {revealed ? 'Hide password' : 'Reveal password'}
                  </DropdownMenuItem>
                </>
              )}
              {canWrite && !isTrash && onEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(cred)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onChanged(cred, 'trash')}>
                    <Trash2 className="h-4 w-4" /> Move to Trash
                  </DropdownMenuItem>
                </>
              )}
              {isTrash && canWrite && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onChanged(cred, 'restore')}>
                    <Undo2 className="h-4 w-4" /> Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onChanged(cred, 'delete')}>
                    <Trash2 className="h-4 w-4" /> Delete forever
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
        {isTrash ? (
          <>
            <Badge variant="secondary" className="text-[11px] font-medium">
              {daysLeft === 0 ? 'Purges today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              Deleted {cred.deletedAt ? new Date(cred.deletedAt).toLocaleDateString() : ''}
            </span>
            <div className="flex-1" />
            {canWrite && (
              <>
                <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => onChanged(cred, 'restore')}>
                  <Undo2 className="h-3.5 w-3.5" /> Restore
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-lg text-destructive hover:text-destructive" onClick={() => onChanged(cred, 'delete')}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete forever
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 min-w-0 flex-1 rounded-lg px-2 text-xs font-medium"
              onClick={() => copy(cred.username, 'Username')}
              aria-label={`Copy username for ${cred.title}`}
              title="Copy username"
            >
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden truncate @min-[352px]:inline">Copy user</span>
            </Button>
            {cred.email && (
              <Button
                variant="secondary"
                size="sm"
                className="h-9 min-w-0 flex-1 rounded-lg px-2 text-xs font-medium"
                onClick={() => copy(cred.email, 'Email')}
                aria-label={`Copy email for ${cred.title}`}
                title="Copy email"
              >
                <AtSign className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden truncate @min-[352px]:inline">Copy email</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="h-9 min-w-0 flex-1 rounded-lg px-2 text-xs font-medium"
              onClick={() => copy(cred.password, 'Password')}
              aria-label={`Copy password for ${cred.title}`}
              title="Copy password"
            >
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden truncate @min-[352px]:inline">Copy password</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={reveal}
              aria-label={revealed ? 'Hide password' : 'Reveal password'}
              title={revealed ? 'Hide password' : 'Reveal password'}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </>
        )}
      </div>
    </article>
  )
}
