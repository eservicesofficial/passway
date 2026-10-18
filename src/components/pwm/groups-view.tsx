'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FolderClosed, FolderOpen, FolderPlus, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { EmptyState } from '@/components/pwm/empty-state'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import { GROUP_COLORS } from '@/lib/ui'
import type { GroupDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GroupsResponse {
  groups: GroupDTO[]
}

export function GroupsView() {
  const { openAdd, openPasswords, vaultVersion, bumpVault } = usePwm()
  const [groups, setGroups] = useState<GroupDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState<GroupDTO | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<GroupDTO | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<GroupsResponse>('/api/groups')
      setGroups(res.groups)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, vaultVersion])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const res = await api<{ group: GroupDTO }>('/api/groups', { method: 'POST', body: { name: name.trim(), color } })
      setGroups((g) => [...g, res.group].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Group created', { description: `"${res.group.name}" is ready for credentials.` })
      setCreateOpen(false)
      setName('')
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create group')
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renaming || !renameValue.trim() || saving) return
    setSaving(true)
    try {
      const res = await api<{ group: { id: string; name: string; color: string } }>(`/api/groups/${renaming.id}`, {
        method: 'PATCH',
        body: { name: renameValue.trim() },
      })
      setGroups((g) => g.map((x) => (x.id === renaming.id ? { ...x, name: res.group.name } : x)))
      toast.success('Group renamed')
      setRenaming(null)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename group')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await api(`/api/groups/${deleting.id}`, { method: 'DELETE' })
      setGroups((g) => g.filter((x) => x.id !== deleting.id))
      toast.success('Group deleted', { description: 'Its credentials were kept and are now ungrouped.' })
      setDeleting(null)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete group')
    }
  }

  const totalItems = groups.reduce((acc, g) => acc + g.count, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FolderClosed className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {groups.length} group{groups.length === 1 ? '' : 's'} · {totalItems} credential{totalItems === 1 ? '' : 's'} organized
          </p>
        </div>
        <Button onClick={() => { setColor(GROUP_COLORS[groups.length % GROUP_COLORS.length]); setCreateOpen(true) }} className="h-10 rounded-xl font-semibold">
          <Plus className="h-4 w-4" /> New group
        </Button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No groups yet"
          description="Groups keep your vault tidy — think Work, Finance, Family or Gaming. Create your first one."
          actionLabel="Create a group"
          onAction={() => { setColor(GROUP_COLORS[0]); setCreateOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <article
              key={g.id}
              className="group relative rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-900/5 hover:border-emerald-500/30 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => openPasswords({ groupId: g.id, groupName: g.name })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-xl focus-visible:outline-2 focus-visible:outline-emerald-600"
                  aria-label={`Open group ${g.name}`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
                    style={{ backgroundColor: g.color + '1f' }}
                    aria-hidden="true"
                  >
                    <FolderClosed className="h-5 w-5" style={{ color: g.color }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-sm">{g.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {g.count} saved item{g.count === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for group ${g.name}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => openPasswords({ groupId: g.id, groupName: g.name })}>
                      <FolderOpen className="h-4 w-4" /> Open group
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setRenaming(g); setRenameValue(g.name) }}>
                      <Pencil className="h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(g)}>
                      <Trash2 className="h-4 w-4" /> Delete group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                type="button"
                onClick={() => openAdd({ groupId: g.id })}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <Plus className="h-3.5 w-3.5" /> Add to this group
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> New group
            </DialogTitle>
            <DialogDescription>Group credentials by purpose, project or area of life.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name</Label>
              <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work" className="h-10" autoFocus required maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Group color">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    onClick={() => setColor(c)}
                    className={cn('h-8 w-8 rounded-full transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600', color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-background' : 'hover:scale-105')}
                    style={{ backgroundColor: c, ...(color === c ? ({ '--tw-ring-color': c } as React.CSSProperties) : {}) }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="h-10 rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()} className="h-10 rounded-xl font-semibold">
                Create group
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
            <DialogDescription>Credentials keep their group assignment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-group">Group name</Label>
              <Input id="rename-group" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-10" autoFocus required maxLength={60} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)} className="h-10 rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !renameValue.trim()} className="h-10 rounded-xl font-semibold">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The {deleting?.count ?? 0} credential{deleting?.count === 1 ? '' : 's'} inside will be kept and become ungrouped. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Delete group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
