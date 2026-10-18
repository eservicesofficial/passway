'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CredentialCard } from '@/components/pwm/credential-card'
import { CredentialDetailDialog } from '@/components/pwm/credential-detail-dialog'
import { EmptyState } from '@/components/pwm/empty-state'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import type { CredentialDTO } from '@/lib/types'

export function TrashView() {
  const { search, setSearch, openEdit, vaultVersion, bumpVault } = usePwm()
  const [credentials, setCredentials] = useState<CredentialDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)
  const [emptyOpen, setEmptyOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CredentialDTO | null>(null)
  const [detail, setDetail] = useState<CredentialDTO | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ credentials: CredentialDTO[] }>('/api/credentials?scope=trash')
      setCredentials(res.credentials)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Trash')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, vaultVersion])

  const visible = search.trim()
    ? credentials.filter((c) =>
        [c.title, c.username ?? '', c.url ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
      )
    : credentials

  async function restore(cred: CredentialDTO) {
    try {
      await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'restore' } })
      setCredentials((l) => l.filter((c) => c.id !== cred.id))
      toast.success('Restored', { description: `"${cred.title}" is back in your vault.` })
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  async function deleteForever(cred: CredentialDTO) {
    try {
      await api(`/api/credentials/${cred.id}?permanent=1`, { method: 'DELETE' })
      setCredentials((l) => l.filter((c) => c.id !== cred.id))
      toast.success('Permanently deleted', { description: `"${cred.title}" was removed forever.` })
      setDeleteTarget(null)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function emptyTrash() {
    setPurging(true)
    try {
      const res = await api<{ deleted: number }>('/api/trash/empty', { method: 'POST' })
      setCredentials([])
      toast.success('Trash emptied', { description: `${res.deleted} item${res.deleted === 1 ? '' : 's'} permanently deleted.` })
      setEmptyOpen(false)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not empty Trash')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Trash2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Trash
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deleted credentials stay recoverable for 30 days, then are removed automatically.
          </p>
        </div>
        {credentials.length > 0 && (
          <Button variant="outline" className="h-10 rounded-xl text-destructive hover:text-destructive" onClick={() => setEmptyOpen(true)}>
            <Trash2 className="h-4 w-4" /> Empty Trash
          </Button>
        )}
      </header>

      {credentials.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Trash…" className="h-10 rounded-xl pl-9 bg-secondary/60 border-transparent" aria-label="Search trash" />
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title={credentials.length === 0 ? 'Trash is empty' : 'No matches in Trash'}
          description={
            credentials.length === 0
              ? 'Deleted credentials land here first — nothing is lost immediately. Items purge automatically after 30 days.'
              : `Nothing matches “${search.trim()}”.`
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((cred) => (
            <CredentialCard
              key={cred.id}
              cred={cred}
              variant="trash"
              onChanged={(c, change) => {
                if (change === 'restore') restore(c)
                else if (change === 'delete') setDeleteTarget(c)
              }}
              onOpen={(c) => {
                setDetail(c)
                setDetailOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <CredentialDetailDialog cred={detail} open={detailOpen} onOpenChange={setDetailOpen} onEdit={openEdit} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}” forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the credential and its encrypted secrets. It cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteForever(deleteTarget)
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty the Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              All {credentials.length} item{credentials.length === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                emptyTrash()
              }}
              disabled={purging}
            >
              {purging && <Loader2 className="h-4 w-4 animate-spin" />} Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
