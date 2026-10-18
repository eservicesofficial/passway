'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, ShieldOff, Share2, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { EmptyState } from '@/components/pwm/empty-state'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import type { AccountDTO, CredentialDTO, ShareDTO } from '@/lib/types'
import { formatDate } from '@/lib/ui'

interface SharesResponse {
  grantedByMe: ShareDTO[]
  sharedWithMe: ShareDTO[]
}

interface OwnerVault {
  grant: ShareDTO
  credentials: CredentialDTO[]
  loading: boolean
}

export function SharedVaultsView() {
  const { openEdit, vaultVersion, bumpVault } = usePwm()
  const [grantedByMe, setGrantedByMe] = useState<ShareDTO[]>([])
  const [sharedWithMe, setSharedWithMe] = useState<ShareDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [vaults, setVaults] = useState<Record<string, OwnerVault>>({})

  // share dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [accounts, setAccounts] = useState<AccountDTO[]>([])
  const [granteeId, setGranteeId] = useState('')
  const [grantCanWrite, setGrantCanWrite] = useState(true)
  const [granting, setGranting] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ShareDTO | null>(null)

  const loadShares = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<SharesResponse>('/api/shares')
      setGrantedByMe(res.grantedByMe)
      setSharedWithMe(res.sharedWithMe)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load shares')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadShares()
  }, [loadShares, vaultVersion])

  // lazily load each owner vault's credentials
  useEffect(() => {
    let cancelled = false
    async function loadVaults() {
      for (const grant of sharedWithMe) {
        if (vaults[grant.id]) continue
        setVaults((v) => ({ ...v, [grant.id]: { grant, credentials: [], loading: true } }))
        try {
          const res = await api<{ credentials: CredentialDTO[] }>(`/api/credentials?scope=all&shared=${encodeURIComponent(grant.owner.id)}`)
          if (cancelled) return
          setVaults((v) => ({ ...v, [grant.id]: { grant, credentials: res.credentials, loading: false } }))
        } catch {
          if (cancelled) return
          setVaults((v) => ({ ...v, [grant.id]: { grant, credentials: [], loading: false } }))
        }
      }
    }
    loadVaults()
    return () => {
      cancelled = true
    }
  }, [sharedWithMe])

  function refreshVault(ownerId: string) {
    const grant = sharedWithMe.find((g) => g.owner.id === ownerId)
    if (!grant) return
    api<{ credentials: CredentialDTO[] }>(`/api/credentials?scope=all&shared=${encodeURIComponent(ownerId)}`)
      .then((res) => {
        setVaults((v) => ({ ...v, [grant.id]: { grant, credentials: res.credentials, loading: false } }))
      })
      .catch(() => undefined)
  }

  async function toggleCanWrite(grant: ShareDTO, canWrite: boolean) {
    try {
      await api(`/api/shares/${grant.id}`, { method: 'PATCH', body: { canWrite } })
      setGrantedByMe((list) => list.map((g) => (g.id === grant.id ? { ...g, canWrite } : g)))
      toast.success(canWrite ? 'Edit access granted' : 'Set to view-only', { description: grant.grantee.email })
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function revoke(grant: ShareDTO) {
    try {
      await api(`/api/shares/${grant.id}`, { method: 'DELETE' })
      setGrantedByMe((list) => list.filter((g) => g.id !== grant.id))
      toast.success('Access revoked', { description: `${grant.grantee.email} can no longer reach your vault.` })
      setRevokeTarget(null)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed')
    }
  }

  async function openAddDialog() {
    setAddOpen(true)
    setGranteeId('')
    setGrantCanWrite(true)
    try {
      const res = await api<{ accounts: AccountDTO[] }>('/api/accounts')
      setAccounts(res.accounts)
    } catch {
      setAccounts([])
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    const account = accounts.find((a) => a.id === granteeId)
    if (!account || granting) return
    setGranting(true)
    try {
      const res = await api<{ grant: ShareDTO }>('/api/shares', {
        method: 'POST',
        body: { granteeEmail: account.email, canWrite: grantCanWrite },
      })
      setGrantedByMe((list) => [res.grant, ...list.filter((g) => g.id !== res.grant.id)])
      toast.success('Vault shared', { description: `${account.email} now has ${grantCanWrite ? 'edit' : 'view'} access.` })
      setAddOpen(false)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Share failed')
    } finally {
      setGranting(false)
    }
  }

  async function handleSharedChanged(ownerId: string, cred: CredentialDTO, change: 'favorite' | 'trash' | 'restore' | 'delete') {
    try {
      if (change === 'favorite') {
        await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'favorite', value: cred.favorite } })
      } else if (change === 'trash') {
        await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'trash' } })
        toast.success('Moved to Trash')
      } else if (change === 'restore') {
        await api(`/api/credentials/${cred.id}`, { method: 'PATCH', body: { action: 'restore' } })
      } else if (change === 'delete') {
        await api(`/api/credentials/${cred.id}?permanent=1`, { method: 'DELETE' })
      }
      refreshVault(ownerId)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Share2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Shared Vaults
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vaults other accounts shared with you — and access you granted.</p>
        </div>
        <Button onClick={openAddDialog} className="h-10 rounded-xl font-semibold">
          <Plus className="h-4 w-4" /> Share my vault
        </Button>
      </header>

      <Tabs defaultValue="with-me" className="space-y-6">
        <TabsList className="rounded-xl bg-secondary/70 p-1">
          <TabsTrigger value="with-me" className="rounded-lg px-4 data-[state=active]:bg-background">
            Shared with me {sharedWithMe.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{sharedWithMe.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="by-me" className="rounded-lg px-4 data-[state=active]:bg-background">
            Shared by me {grantedByMe.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{grantedByMe.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ---- Shared with me ---- */}
        <TabsContent value="with-me" className="space-y-6">
          {loading ? (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
            </div>
          ) : sharedWithMe.length === 0 ? (
            <div className="rounded-2xl border border-dashed">
              <EmptyState
                icon={UsersRound}
                title="No shared vaults yet"
                description="When another account grants you access to its vault, its credentials will appear here — view or edit, depending on the permission you were given."
              />
            </div>
          ) : (
            sharedWithMe.map((grant) => {
              const vault = vaults[grant.id]
              return (
                <section key={grant.id} className="rounded-2xl border bg-card/60 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                        <UsersRound className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{grant.owner.email}</p>
                        <p className="text-xs text-muted-foreground">Shared {formatDate(grant.createdAt)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={grant.canWrite ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-secondary text-muted-foreground'}>
                      {grant.canWrite ? 'Can view & edit' : 'View only'}
                    </Badge>
                  </div>

                  {vault?.loading || !vault ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <Skeleton className="h-32 rounded-2xl" />
                      <Skeleton className="h-32 rounded-2xl" />
                    </div>
                  ) : vault.credentials.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      This vault has no saved passwords yet.
                    </p>
                  ) : (
                    <div className="max-h-[30rem] overflow-y-auto pr-1">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {vault.credentials.map((cred) => (
                          <CredentialCard
                            key={cred.id}
                            cred={cred}
                            canWrite={grant.canWrite}
                            ownerLabel={grant.owner.email}
                            onChanged={(c, change) => handleSharedChanged(grant.owner.id, c, change)}
                            onEdit={openEdit}
                            onOpen={undefined}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )
            })
          )}
        </TabsContent>

        {/* ---- Shared by me ---- */}
        <TabsContent value="by-me">
          {loading ? (
            <Skeleton className="h-36 rounded-2xl" aria-busy="true" />
          ) : grantedByMe.length === 0 ? (
            <div className="rounded-2xl border border-dashed">
              <EmptyState
                icon={Share2}
                title="Your vault is private"
                description="Share your vault with another account, or link vaults while creating new accounts from Settings. Access can be revoked anytime."
                actionLabel="Share my vault"
                onAction={openAddDialog}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <ul className="divide-y">
                {grantedByMe.map((grant) => (
                  <li key={grant.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                      <UsersRound className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{grant.grantee.email}</p>
                      <p className="text-xs text-muted-foreground">Has access to your vault since {formatDate(grant.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`cw-${grant.id}`}
                          checked={grant.canWrite}
                          onCheckedChange={(v) => toggleCanWrite(grant, v)}
                          aria-label={`Toggle edit access for ${grant.grantee.email}`}
                        />
                        <Label htmlFor={`cw-${grant.id}`} className="text-xs text-muted-foreground cursor-pointer">
                          {grant.canWrite ? 'Can edit' : 'View only'}
                        </Label>
                      </div>
                      <Button variant="outline" size="sm" className="h-9 rounded-lg text-destructive hover:text-destructive" onClick={() => setRevokeTarget(grant)}>
                        <ShieldOff className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Share dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share your vault</DialogTitle>
            <DialogDescription>Grant another account access to all passwords in your vault.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGrant} className="space-y-4">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={granteeId} onValueChange={setGranteeId}>
                <SelectTrigger className="h-10 w-full" aria-label="Choose account">
                  <SelectValue placeholder="Choose an account…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => !a.isSelf)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-secondary/40 px-3.5 py-2.5">
              <div>
                <p className="text-sm font-medium">Allow editing</p>
                <p className="text-xs text-muted-foreground">They can add, edit and delete credentials in your vault</p>
              </div>
              <Switch checked={grantCanWrite} onCheckedChange={setGrantCanWrite} aria-label="Allow editing" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="h-10 rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={!granteeId || granting} className="h-10 rounded-xl font-semibold">
                {granting && <Loader2 className="h-4 w-4 animate-spin" />} Share vault
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {revokeTarget?.grantee.email}?</AlertDialogTitle>
            <AlertDialogDescription>They will immediately lose access to your vault and all its credentials.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); if (revokeTarget) revoke(revokeTarget) }}>
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
