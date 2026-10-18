'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowUpDown, FolderOpen, KeyRound, Plus, Search, Star, Tag, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CredentialCard } from '@/components/pwm/credential-card'
import { CredentialDetailDialog } from '@/components/pwm/credential-detail-dialog'
import { EmptyState } from '@/components/pwm/empty-state'
import { STATUS_META } from '@/components/pwm/status'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import type { CredentialDTO, CredentialStatus, GroupDTO, SortKey } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CredentialsResponse {
  credentials: CredentialDTO[]
  canWrite: boolean
  ownerId: string
}

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Recently updated',
  created: 'Newest first',
  title: 'Title A–Z',
  titleDesc: 'Title Z–A',
}

export function PasswordsView({ mode, ownerId }: { mode: 'all' | 'favorites' | 'group'; ownerId?: string }) {
  const { search, setSearch, passwordsFilter, openPasswords, openAdd, openEdit, vaultVersion, bumpVault } = usePwm()
  const [credentials, setCredentials] = useState<CredentialDTO[]>([])
  const [groups, setGroups] = useState<GroupDTO[]>([])
  const [canWrite, setCanWrite] = useState(true)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('updated')
  const [tagFilter, setTagFilter] = useState<string | null>(passwordsFilter.tag ?? null)
  const [statusFilter, setStatusFilter] = useState<CredentialStatus | null>((passwordsFilter.status as CredentialStatus) ?? null)
  const [detail, setDetail] = useState<CredentialDTO | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const activeGroupId = passwordsFilter.groupId ?? undefined
  const isFavorites = mode === 'favorites' && !activeGroupId
  const scope = isFavorites ? 'favorites' : activeGroupId ? 'group' : 'all'
  const sharedQuery = ownerId ? `&shared=${encodeURIComponent(ownerId)}` : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ scope })
      if (mode === 'group' && activeGroupId) params.set('groupId', activeGroupId)
      if (statusFilter) params.set('status', statusFilter)
      const [credRes, groupRes] = await Promise.all([
        api<CredentialsResponse>(`/api/credentials?${params.toString()}${sharedQuery}`),
        ownerId
          ? Promise.resolve({ groups: [] as GroupDTO[] })
          : api<{ groups: GroupDTO[] }>('/api/groups'),
      ])
      setCredentials(credRes.credentials)
      setCanWrite(credRes.canWrite)
      setGroups(groupRes.groups)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load vault')
    } finally {
      setLoading(false)
    }
  }, [scope, activeGroupId, ownerId, sharedQuery, mode, statusFilter])

  useEffect(() => {
    load()
  }, [load, vaultVersion])

  useEffect(() => {
    setTagFilter(passwordsFilter.tag ?? null)
    setStatusFilter((passwordsFilter.status as CredentialStatus) ?? null)
  }, [passwordsFilter.tag, passwordsFilter.status])

  // instant client-side search + sorting
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = credentials
    if (q) {
      list = list.filter((c) =>
        [c.title, c.url ?? '', c.username ?? '', c.email ?? '', c.notes ?? '', c.groupName ?? '', c.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    if (tagFilter) list = list.filter((c) => c.tags.includes(tagFilter))
    if (statusFilter) list = list.filter((c) => c.status === statusFilter)
    const sorted = [...list]
    switch (sort) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
        break
      case 'titleDesc':
        sorted.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }))
        break
      case 'created':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        break
      default:
        sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    return sorted
  }, [credentials, search, sort, tagFilter, statusFilter])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    credentials.forEach((c) => c.tags.forEach((t) => set.add(t)))
    return [...set].sort((a, b) => a.localeCompare(b)).slice(0, 14)
  }, [credentials])

  async function handleChanged(cred: CredentialDTO, change: 'favorite' | 'trash' | 'restore' | 'delete') {
    try {
      if (change === 'favorite') {
        await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'favorite', value: cred.favorite } })
        setCredentials((list) =>
          isFavorites ? list.filter((c) => c.id !== cred.id) : list.map((c) => (c.id === cred.id ? cred : c)),
        )
        toast.success(cred.favorite ? 'Added to favorites' : 'Removed from favorites')
      } else if (change === 'trash') {
        await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'trash' } })
        setCredentials((list) => list.filter((c) => c.id !== cred.id))
        toast.success('Moved to Trash', { description: `You can restore "${cred.title}" for 30 days.` })
      } else if (change === 'restore') {
        await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'restore' } })
        setCredentials((list) => list.filter((c) => c.id !== cred.id))
        toast.success('Restored', { description: `"${cred.title}" is back in your vault.` })
      } else if (change === 'delete') {
        await api(`/api/credentials/${cred.id}?permanent=1`, { method: 'DELETE' })
        setCredentials((list) => list.filter((c) => c.id !== cred.id))
        toast.success('Permanently deleted')
      }
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const heading = isFavorites ? 'Favorites' : activeGroupId ? passwordsFilter.groupName || 'Group' : 'All Passwords'
  const sub = `${visible.length} item${visible.length === 1 ? '' : 's'}${search.trim() ? ` matching “${search.trim()}”` : ''}`

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {isFavorites ? (
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            ) : (
              <KeyRound className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            )}
            {heading}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
        </div>
        {canWrite && (
          <Button onClick={() => openAdd({ groupId: activeGroupId ?? null })} className="h-10 rounded-xl font-semibold">
            <Plus className="h-4 w-4" /> Add password
          </Button>
        )}
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vault…"
            className="h-10 rounded-xl pl-9 bg-secondary/60 border-transparent focus-visible:bg-background"
            aria-label="Search vault"
          />
        </div>

        {mode === 'all' && (
          <Select
            value={activeGroupId ?? 'all-groups'}
            onValueChange={(v) =>
              openPasswords(v === 'all-groups' ? { groupId: null, groupName: null } : { groupId: v, groupName: groups.find((g) => g.id === v)?.name ?? null })
            }
          >
            <SelectTrigger className="h-10 w-44 rounded-xl bg-secondary/60 border-transparent" aria-label="Filter by group">
              <FolderOpen className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-groups">All groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} ({g.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-10 w-44 rounded-xl bg-secondary/60 border-transparent" aria-label="Sort credentials">
            <ArrowUpDown className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tagFilter && (
          <Badge variant="outline" className="h-9 gap-1.5 rounded-xl border-emerald-500/40 bg-emerald-500/10 px-3 text-emerald-700 dark:text-emerald-300">
            <Tag className="h-3 w-3" /> {tagFilter}
            <button onClick={() => setTagFilter(null)} aria-label="Clear tag filter" className="rounded-full focus-visible:outline-2 focus-visible:outline-emerald-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Status</span>
        <button
          onClick={() => setStatusFilter(null)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
            statusFilter === null
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground',
          )}
        >
          All
        </button>
        {(Object.keys(STATUS_META) as CredentialStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter((prev) => (prev === s ? null : s))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
              statusFilter === s ? STATUS_META[s].chip : 'border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
            {STATUS_META[s].label}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 inline-flex items-center gap-1 pr-1 text-xs font-medium text-muted-foreground">
            <Tag className="h-3 w-3" /> Tags
          </span>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter((prev) => (prev === t ? null : t))}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
                tagFilter === t
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground hover:border-emerald-500/30',
              )}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading credentials">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="flex gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        credentials.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={isFavorites ? 'No favorites yet' : activeGroupId ? 'This group is empty' : 'Your vault is empty'}
            description={
              isFavorites
                ? 'Star the credentials you use most and they will appear here for one-tap access.'
                : activeGroupId
                  ? 'Add a password to this group, or move existing credentials into it.'
                  : 'Add your first password — it will be encrypted with AES-256-GCM before it is stored.'
            }
            actionLabel={canWrite ? 'Add your first password' : undefined}
            onAction={canWrite ? () => openAdd({ groupId: activeGroupId ?? null }) : undefined}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing matches ${search.trim() ? `“${search.trim()}”` : 'your filters'}. Try a different search or clear filters.`}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((cred, i) => (
            <div
              key={cred.id}
              className="animate-view-in [&>article]:h-full"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <CredentialCard
                cred={cred}
                canWrite={canWrite}
                onChanged={handleChanged}
                onEdit={openEdit}
                onOpen={(c) => {
                  setDetail(c)
                  setDetailOpen(true)
                }}
              />
            </div>
          ))}
        </div>
      )}

      <CredentialDetailDialog cred={detail} canWrite={canWrite} open={detailOpen} onOpenChange={setDetailOpen} onEdit={openEdit} />
    </div>
  )
}
