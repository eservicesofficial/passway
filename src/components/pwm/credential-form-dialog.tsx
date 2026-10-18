'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, CircleDot, CircleCheckBig, Dices, Eye, EyeOff, Loader2, Save, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StrengthMeter } from '@/components/pwm/strength-meter'
import { PasswordGenerator, DEFAULT_OPTIONS, GeneratorOptionsState } from '@/components/pwm/password-generator'
import { useOverlayHistory } from '@/components/pwm/nav-history'
import { api } from '@/lib/client'
import type { CredentialDTO, CredentialStatus, GroupDTO } from '@/lib/types'

interface CredentialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: CredentialDTO | null
  presetGroupId?: string | null
  /** Vault to write into; defaults to the user's own. */
  ownerId?: string | null
  onSaved: (saved: CredentialDTO, wasEditing: boolean) => void
}

interface FormState {
  title: string
  url: string
  username: string
  email: string
  password: string
  notes: string
  groupId: string // '' = none
  tags: string
  favorite: boolean
  status: CredentialStatus | 'delete'
  statusRemarks: string
}

const EMPTY: FormState = {
  title: '',
  url: '',
  username: '',
  email: '',
  password: '',
  notes: '',
  groupId: '',
  tags: '',
  favorite: false,
  status: 'in_process',
  statusRemarks: '',
}

export const STATUS_META: Record<CredentialStatus, { label: string; dot: string; chip: string; icon: React.ComponentType<{ className?: string }> }> = {
  in_process: {
    label: 'In Process',
    dot: 'bg-blue-500',
    chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    icon: CircleDot,
  },
  complete: {
    label: 'Complete',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: CircleCheckBig,
  },
  transferred: {
    label: 'Transferred',
    dot: 'bg-purple-500',
    chip: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: ArrowLeftRight,
  },
}

/** "Delete" is an action-status available on saved credentials: it moves the item to Trash. */
const DELETE_OPTION = { label: 'Delete', dot: 'bg-red-500' }

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 10)
}

export function CredentialFormDialog({
  open,
  onOpenChange,
  editing,
  presetGroupId,
  ownerId,
  onSaved,
}: CredentialFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [groups, setGroups] = useState<GroupDTO[]>([])
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genOptions, setGenOptions] = useState<GeneratorOptionsState>(DEFAULT_OPTIONS)

  const isEdit = !!editing
  const { closeViaUi } = useOverlayHistory(open, () => onOpenChange(false))

  useEffect(() => {
    if (!open) return
    setError(null)
    setShowPw(false)
    setGenOpen(false)
    if (editing) {
      setForm({
        title: editing.title,
        url: editing.url ?? '',
        username: editing.username ?? '',
        email: editing.email ?? '',
        password: editing.password ?? '',
        notes: editing.notes ?? '',
        groupId: editing.groupId ?? '',
        tags: editing.tags.join(', '),
        favorite: editing.favorite,
        status: editing.status ?? 'in_process',
        statusRemarks: editing.statusRemarks ?? '',
      })
    } else {
      setForm({ ...EMPTY, groupId: presetGroupId ?? '' })
    }
  }, [open, editing, presetGroupId])

  useEffect(() => {
    if (!open) return
    api<{ groups: GroupDTO[] }>('/api/groups')
      .then((d) => setGroups(d.groups))
      .catch(() => setGroups([]))
  }, [open])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (form.status === 'transferred' && !form.statusRemarks.trim()) {
      setError('Remarks are required when the status is Transferred')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        url: form.url.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        notes: form.notes,
        groupId: form.groupId || null,
        tags: parseTags(form.tags),
        favorite: form.favorite,
        status: form.status,
        statusRemarks: form.status === 'transferred' ? form.statusRemarks.trim() : '',
      }
      if (isEdit && editing) {
        if (form.status === 'delete') {
          await api<{ ok: boolean; trashed?: boolean }>(`/api/credentials/${editing.id}`, {
            method: 'PATCH',
            body: { status: 'delete' },
          })
          toast.success('Moved to Trash', {
            description: `"${editing.title}" was marked Delete and moved to Trash — recoverable for 30 days.`,
          })
          onSaved(editing, true)
          onOpenChange(false)
          return
        }
        const res = await api<{ credential: CredentialDTO }>(`/api/credentials/${editing.id}`, {
          method: 'PATCH',
          body,
        })
        toast.success('Credential updated', { description: res.credential.title })
        onSaved(res.credential, true)
      } else {
        const res = await api<{ credential: CredentialDTO }>('/api/credentials', {
          method: 'POST',
          body: ownerId ? { ...body, ownerId } : body,
        })
        toast.success('Credential saved', { description: res.credential.title })
        onSaved(res.credential, false)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : closeViaUi())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit credential' : 'Add password'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the stored details. Secrets are re-encrypted with AES-256-GCM.' : 'Secrets are encrypted with AES-256-GCM before they touch the database.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="f-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input id="f-title" placeholder="e.g. GitHub" value={form.title} onChange={(e) => set('title', e.target.value)} className="h-10" required autoFocus />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f-username">
                Username <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="f-username" placeholder="johndoe" value={form.username} onChange={(e) => set('username', e.target.value)} className="h-10" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-email">
                Email <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="f-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} className="h-10" autoComplete="off" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f-url">Website URL</Label>
              <Input id="f-url" type="url" placeholder="https://github.com" value={form.url} onChange={(e) => set('url', e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as CredentialStatus | 'delete')}>
                <SelectTrigger id="f-status" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_META) as CredentialStatus[]).map((s) => {
                    const meta = STATUS_META[s]
                    return (
                      <SelectItem key={s} value={s}>
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                  {isEdit && (
                    <SelectItem value="delete">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${DELETE_OPTION.dot}`} />
                        {DELETE_OPTION.label}
                        <span className="text-xs text-muted-foreground">— moves to Trash</span>
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {form.status === 'delete' && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Saving with status Delete moves this credential to Trash (recoverable for 30 days).
                </p>
              )}
            </div>
          </div>

          {form.status === 'transferred' && (
            <div className="space-y-2 animate-view-in">
              <Label htmlFor="f-remarks">
                Transfer remarks <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="f-remarks"
                placeholder="Who was it transferred to, when, and any reference…"
                value={form.statusRemarks}
                onChange={(e) => set('statusRemarks', e.target.value)}
                rows={2}
                className="resize-none"
                required
              />
              <p className="text-xs text-muted-foreground">Remarks are mandatory for transferred credentials.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="f-password">Password</Label>
            <div className="relative">
              <Input
                id="f-password"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className="h-10 pr-20 font-mono"
                autoComplete="new-password"
              />
              <div className="absolute right-0 top-0 flex h-10 items-center">
                <Popover open={genOpen} onOpenChange={setGenOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-9" aria-label="Open password generator">
                      <Dices className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Password generator
                    </p>
                    <PasswordGenerator
                      options={genOptions}
                      onOptionsChange={setGenOptions}
                      useLabel="Insert into field"
                      onUse={(pw) => {
                        set('password', pw)
                        setShowPw(true)
                        setGenOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-9" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <StrengthMeter password={form.password} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="f-group">Category / Group</Label>
              <Select value={form.groupId || 'none'} onValueChange={(v) => set('groupId', v === 'none' ? '' : v)}>
                <SelectTrigger id="f-group" className="h-10 w-full">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-tags">Tags</Label>
              <Input id="f-tags" placeholder="work, finance, 2fa" value={form.tags} onChange={(e) => set('tags', e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="f-notes">Notes</Label>
            <Textarea id="f-notes" placeholder="Recovery codes, security questions, anything private…" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="resize-none" />
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-secondary/40 px-3.5 py-2.5">
            <div>
              <p className="text-sm font-medium">Favorite</p>
              <p className="text-xs text-muted-foreground">Pin to the top of your vault</p>
            </div>
            <Switch checked={form.favorite} onCheckedChange={(v) => set('favorite', v)} aria-label="Mark as favorite" />
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeViaUi} className="h-10 rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()} className="h-10 rounded-xl font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? 'Save changes' : 'Add to vault'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
