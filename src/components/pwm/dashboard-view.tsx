'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  CircleCheckBig,
  CircleDot,
  Dices,
  FolderClosed,
  KeyRound,
  NotebookPen,
  Plus,
  RefreshCcw,
  ScanLine,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/pwm/empty-state'
import { CredentialCard } from '@/components/pwm/credential-card'
import { CredentialDetailDialog } from '@/components/pwm/credential-detail-dialog'
import { LogoMark } from '@/components/pwm/logo'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import { timeAgo } from '@/lib/ui'
import type { CredentialDTO, CredentialStatus, DashboardDTO } from '@/lib/types'

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  login: ShieldCheck,
  'credential.created': KeyRound,
  'credential.updated': RefreshCcw,
  'credential.status': ArrowLeftRight,
  'credential.trashed': Trash2,
  'credential.restored': RefreshCcw,
  'credential.purged': Trash2,
  'group.created': FolderClosed,
  'group.updated': FolderClosed,
  'group.deleted': FolderClosed,
  'share.granted': Share2,
  'share.updated': Share2,
  'share.revoked': Share2,
  'account.created': UsersRound,
  'password.changed': ShieldCheck,
  'trash.emptied': Trash2,
  'note.created': NotebookPen,
  'note.trashed': NotebookPen,
  'note.restored': NotebookPen,
  'note.purged': NotebookPen,
  'note.attachment': NotebookPen,
  'qr.approved': ScanLine,
  'qr.denied': ScanLine,
  'device.revoked': ShieldCheck,
}

const STATUS_FILTER_META: Array<{ key: CredentialStatus; label: string; icon: React.ComponentType<{ className?: string }>; chip: string }> = [
  { key: 'in_process', label: 'In Process', icon: CircleDot, chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { key: 'complete', label: 'Complete', icon: CircleCheckBig, chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { key: 'transferred', label: 'Transferred', icon: ArrowLeftRight, chip: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' },
]

export function DashboardView() {
  const { user, openAdd, openGenerator, openEdit, openPasswords, setView, vaultVersion } = usePwm()
  const [data, setData] = useState<DashboardDTO | null>(null)
  const [recent, setRecent] = useState<CredentialDTO[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<CredentialStatus, number>>({ in_process: 0, complete: 0, transferred: 0 })
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<CredentialDTO | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, creds] = await Promise.all([
        api<DashboardDTO>('/api/dashboard'),
        api<{ credentials: CredentialDTO[] }>('/api/credentials?scope=all&sort=updated'),
      ])
      setData(dash)
      const all = creds.credentials
      setRecent(all.slice(0, 6))
      const counts: Record<CredentialStatus, number> = { in_process: 0, complete: 0, transferred: 0 }
      for (const c of all) counts[c.status] = (counts[c.status] ?? 0) + 1
      setStatusCounts(counts)
    } catch {
      // handled by unauthorized listener
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, vaultVersion])

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const stats = [
    { label: 'Saved passwords', value: data?.totals.passwords, icon: KeyRound, tint: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', action: () => openPasswords({}) },
    { label: 'Groups', value: data?.totals.groups, icon: FolderClosed, tint: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', action: () => setView('groups') },
    { label: 'Favorites', value: data?.totals.favorites, icon: Star, tint: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10', action: () => setView('favorites') },
    { label: 'Shared vaults', value: (data?.totals.sharedWithMe ?? 0) + (data?.totals.grantedTo ?? 0), icon: UsersRound, tint: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', action: () => setView('shared') },
  ]

  const quickActions = [
    { label: 'Add password', desc: 'Encrypt & store a credential', icon: Plus, action: () => openAdd(), tint: 'from-emerald-500/15 to-teal-500/5 text-emerald-600 dark:text-emerald-400' },
    { label: 'New note', desc: 'Markdown notepad', icon: NotebookPen, action: () => setView('notepad'), tint: 'from-amber-500/15 to-orange-500/5 text-amber-600 dark:text-amber-400' },
    { label: 'Generator', desc: 'Random strong passwords', icon: Dices, action: () => openGenerator(), tint: 'from-violet-500/15 to-purple-500/5 text-violet-600 dark:text-violet-400' },
  ]

  function handleChanged(_cred: CredentialDTO, _change: string) {
    load()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Wrapper owns the responsive visibility so LogoMark keeps its flex centering */}
          <div className="hidden shrink-0 min-[420px]:block">
            <LogoMark size={44} className="rounded-2xl shadow-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{greeting},</p>
            <h1 className="break-words text-2xl font-bold tracking-tight">{user.email}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openGenerator} className="h-10 rounded-xl font-semibold">
            <Dices className="h-4 w-4" /> Generator
          </Button>
          <Button onClick={() => openAdd()} className="h-10 rounded-xl font-semibold">
            <Plus className="h-4 w-4" /> Quick add
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Quick actions — premium gradient tiles */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                type="button"
                onClick={qa.action}
                className={`group flex items-center gap-3.5 rounded-2xl border bg-gradient-to-br ${qa.tint} p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/70 shadow-sm">
                  <qa.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{qa.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{qa.desc}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={s.action}
                className="group rounded-2xl border bg-card p-5 text-left transition-all duration-200 hover:shadow-lg hover:shadow-emerald-900/5 hover:border-emerald-500/30 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>
                    <s.icon className={`h-5 w-5 ${s.tint}`} />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500" aria-hidden="true" />
                </div>
                <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">{s.value ?? 0}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </button>
            ))}
          </div>

          {/* Status overview chips */}
          <section aria-label="Credential status overview">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Status overview</h2>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => openPasswords({})}>
                All passwords <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {STATUS_FILTER_META.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => openPasswords({ status: s.key })}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${s.chip}`}
                >
                  <s.icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-bold tabular-nums leading-none">{statusCounts[s.key] ?? 0}</span>
                    <span className="mt-1 block text-xs font-medium text-muted-foreground">{s.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-40" />
                </button>
              ))}
            </div>
          </section>

          {/* Security + activity */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Vault security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SecurityRow
                  ok={(data?.security.reused ?? 0) === 0}
                  label="Reused passwords"
                  value={data?.security.reused ?? 0}
                  okText="No duplicates — every password is unique."
                  badText="items share a password. Tap to review your vault."
                  onReview={() => openPasswords({})}
                />
                <Separator />
                <SecurityRow
                  ok={(data?.security.weak ?? 0) === 0}
                  label="Weak passwords"
                  value={data?.security.weak ?? 0}
                  okText="No weak passwords detected."
                  badText="items are short or too simple. Consider regenerating them."
                  onReview={() => openPasswords({})}
                />
                <Separator />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">In Trash</span>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setView('trash')}>
                    {data?.totals.trashed ?? 0} item{(data?.totals.trashed ?? 0) === 1 ? '' : 's'} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data && data.recent.length > 0 ? (
                  <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {data.recent.map((a) => {
                      const Icon = ACTION_ICONS[a.action] ?? KeyRound
                      return (
                        <li key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{a.detail ?? a.action}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Activity will appear here as you use your vault.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent credentials */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Recently updated</h2>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => openPasswords({})}>
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {recent.length === 0 ? (
              <div className="rounded-2xl border border-dashed">
                <EmptyState
                  icon={KeyRound}
                  title="Nothing saved yet"
                  description="Add your first credential and it will show up here, encrypted and ready to copy."
                  actionLabel="Add password"
                  onAction={() => openAdd()}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {recent.map((cred) => (
                  <CredentialCard
                    key={cred.id}
                    cred={cred}
                    onChanged={handleChanged}
                    onEdit={openEdit}
                    onOpen={(c) => {
                      setDetail(c)
                      setDetailOpen(true)
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <CredentialDetailDialog cred={detail} open={detailOpen} onOpenChange={setDetailOpen} onEdit={openEdit} />
    </div>
  )
}

function SecurityRow({
  ok,
  label,
  value,
  okText,
  badText,
  onReview,
}: {
  ok: boolean
  label: string
  value: number
  okText: string
  badText: string
  onReview: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ok ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
        {ok ? <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {label}
          {!ok && <span className="ml-1.5 text-amber-600 dark:text-amber-400">· {value}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{ok ? okText : `“${value}” ${badText}`}</p>
      </div>
      {!ok && (
        <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-lg text-xs" onClick={onReview}>
          Review
        </Button>
      )}
    </div>
  )
}
