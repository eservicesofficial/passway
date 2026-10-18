'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  Dices,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Moon,
  MonitorSmartphone,
  Settings2,
  Share2,
  ShieldCheck,
  Sun,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import { StrengthMeter } from '@/components/pwm/strength-meter'
import { PasswordGenerator, DEFAULT_OPTIONS, GeneratorOptionsState } from '@/components/pwm/password-generator'
import { useOverlayHistory } from '@/components/pwm/nav-history'
import { usePwm } from '@/components/pwm/pwm-context'
import { api } from '@/lib/client'
import { formatDate, timeAgo } from '@/lib/ui'
import type { AccountDTO, DeviceSessionDTO, UserInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

export function SettingsView() {
  const { user, refreshUser, bumpVault, setView } = usePwm()
  const { theme, setTheme } = useTheme()

  // ---- change credentials ----
  const [currentPassword, setCurrentPassword] = useState('')
  const [newLoginId, setNewLoginId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingCreds, setSavingCreds] = useState(false)

  // ---- accounts ----
  const [accounts, setAccounts] = useState<AccountDTO[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newAccPassword, setNewAccPassword] = useState('')
  const [genOptions, setGenOptions] = useState<GeneratorOptionsState>(DEFAULT_OPTIONS)
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [accCanWrite, setAccCanWrite] = useState(true)
  const [creating, setCreating] = useState(false)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const createOverlay = useOverlayHistory(createOpen, () => setCreateOpen(false))

  // ---- device sessions ----
  const [devices, setDevices] = useState<DeviceSessionDTO[] | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    try {
      const res = await api<{ devices: DeviceSessionDTO[] }>('/api/auth/devices')
      setDevices(res.devices)
    } catch {
      setDevices([])
    }
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  async function revokeDevice(d: DeviceSessionDTO) {
    setRevoking(d.id)
    try {
      await api('/api/auth/devices', { method: 'POST', body: { id: d.id } })
      toast.success('Device revoked', { description: `${d.deviceLabel} can no longer access your vault.` })
      loadDevices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed')
    } finally {
      setRevoking(null)
    }
  }

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api<{ accounts: AccountDTO[] }>('/api/accounts')
      setAccounts(res.accounts)
    } catch {
      setAccounts([])
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, createOpen])

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (savingCreds) return
    if (!currentPassword) {
      toast.error('Enter your current password')
      return
    }
    if (!newLoginId.trim() && !newPassword) {
      toast.error('Enter a new login ID and/or a new password')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setSavingCreds(true)
    try {
      const res = await api<{ user: UserInfo }>('/api/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword,
          newLoginId: newLoginId.trim() || undefined,
          newPassword: newPassword || undefined,
        },
      })
      toast.success('Account updated', {
        description: newLoginId.trim() ? `Login ID is now ${res.user.email}` : 'Your new password is active.',
      })
      setCurrentPassword('')
      setNewLoginId('')
      setNewPassword('')
      setConfirmPassword('')
      refreshUser(res.user)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSavingCreds(false)
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      const res = await api<{ account: AccountDTO; granted: number; denied: number }>('/api/accounts', {
        method: 'POST',
        body: { loginId: newEmail.trim(), password: newAccPassword, shareWith: selectedOwners, canWrite: accCanWrite },
      })
      toast.success('Account created', {
        description:
          res.granted > 0
            ? `${res.account.email} now has access to ${res.granted} linked vault${res.granted === 1 ? '' : 's'}.`
            : `${res.account.email} can now sign in.`,
      })
      createOverlay.closeViaUi()
      setNewEmail('')
      setNewAccPassword('')
      setSelectedOwners([])
      loadAccounts()
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setCreating(false)
    }
  }

  async function handleEmptyTrash() {
    try {
      const res = await api<{ deleted: number }>('/api/trash/empty', { method: 'POST' })
      toast.success('Trash emptied', { description: `${res.deleted} item${res.deleted === 1 ? '' : 's'} permanently deleted.` })
      setEmptyTrashOpen(false)
      bumpVault()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: MonitorSmartphone },
  ]

  const shareableAccounts = (accounts ?? []).filter((a) => a.shareable)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account, linked vaults and preferences.</p>
      </header>

      {/* Profile */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
            <UsersRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.email}</p>
            <p className="text-xs text-muted-foreground">Member since {formatDate(user.createdAt)}{user.mustChangePassword && ' · password change required'}</p>
          </div>
        </div>
        <Separator className="my-5" />
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Login ID & password</h2>
        <form onSubmit={handleSaveCredentials} className="space-y-4" id="change-creds-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-current">Current password</Label>
              <Input id="s-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-login">New login ID</Label>
              <Input id="s-login" type="text" placeholder={user.email} value={newLoginId} onChange={(e) => setNewLoginId(e.target.value)} className="h-10" autoComplete="username" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-newpw">New password</Label>
              <div className="relative">
                <Input id="s-newpw" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 pr-10" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <StrengthMeter password={newPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-confirmpw">Confirm new password</Label>
              <Input id="s-confirmpw" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingCreds} className="h-10 rounded-xl font-semibold">
              {savingCreds ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Update credentials
            </Button>
          </div>
        </form>
      </section>

      {/* Accounts & sharing */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Accounts & vault sharing</h2>
            <p className="text-sm text-muted-foreground">Create login accounts and link vaults so they can access each other&apos;s passwords.</p>
          </div>
          <Button onClick={() => { setNewEmail(''); setNewAccPassword(''); setSelectedOwners([]); setCreateOpen(true) }} className="h-10 rounded-xl font-semibold">
            <UserPlus className="h-4 w-4" /> Create account
          </Button>
        </div>

        {accounts === null ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto rounded-xl border">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white', a.isSelf ? 'bg-emerald-600' : 'bg-secondary text-muted-foreground')}>
                  {a.email.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.email}
                    {a.isSelf && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">You</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.iGranted ? 'Can access your vault' : a.grantedToMe ? 'Their vault is shared with you' : 'Separate vault'}
                  </p>
                </div>
                {a.iGranted && (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    sharing
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed p-3.5">
          <p className="text-xs text-muted-foreground">
            Need fine-grained control (edit rights, revocation)? Open <span className="font-semibold text-foreground">Shared Vaults</span>.
          </p>
          <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-lg" onClick={() => setView('shared')}>
            <Share2 className="h-3.5 w-3.5" /> Manage sharing
          </Button>
        </div>
      </section>

      {/* Active devices */}
      <DevicesSection devices={devices} onRevoke={revokeDevice} revoking={revoking} onRefresh={loadDevices} />

      {/* Appearance */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Appearance</h2>
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={theme === opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
                theme === opt.value ? 'border-emerald-500/60 bg-emerald-500/5 shadow-sm' : 'hover:border-emerald-500/30 hover:bg-secondary/50',
              )}
            >
              <opt.icon className={cn('h-5 w-5', theme === opt.value ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <Lock className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" /> How Passway protects you
        </h2>
        <ul className="space-y-3 text-sm">
          {[
            'Credentials are sealed with AES-256-GCM authenticated encryption before storage.',
            'Login passwords are hashed with Argon2id (32 MiB, 3 passes) — never stored or logged.',
            'Sessions use HttpOnly cookies, expire after 2h of inactivity (12h max) and are revoked on password change.',
            'Login attempts are rate-limited; every request re-validates vault ownership and sharing permissions.',
            'Deleted credentials and notes stay restorable in Trash for 30 days, then are purged automatically.',
            'QR login uses single-use codes that expire in 3 minutes — approval always requires an already-signed-in device, and every PC session is revocable.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          The Notepad module is inspired by the open-source{' '}
          <a href="https://github.com/usememos/memos" target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
            Memos project (usememos/memos, MIT license)
          </a>
          . Passway implements its own original code and design; no Memos source code is redistributed.
        </p>
      </section>
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Permanently delete everything currently in your Trash.</p>
          <Button variant="outline" className="h-10 rounded-xl text-destructive hover:text-destructive" onClick={() => setEmptyTrashOpen(true)}>
            <Trash2 className="h-4 w-4" /> Empty Trash
          </Button>
        </div>
      </section>

      {/* Create account dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => (o ? setCreateOpen(true) : createOverlay.closeViaUi())}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Create account
            </DialogTitle>
            <DialogDescription>
              Add a new login. Select existing accounts to link their vaults — the new account will access those passwords after sign-in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acc-email">Login ID</Label>
              <Input id="acc-email" type="text" placeholder="new.user@es.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-10" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-pw">Password</Label>
              <div className="flex gap-2">
                <Input id="acc-pw" type="text" value={newAccPassword} onChange={(e) => setNewAccPassword(e.target.value)} className="h-10 font-mono" required autoComplete="new-password" />
                <PopoverGen options={genOptions} onOptionsChange={setGenOptions} onUse={setNewAccPassword} />
              </div>
              <StrengthMeter password={newAccPassword} />
              <p className="text-xs text-muted-foreground">At least 8 characters with a letter and a number.</p>
            </div>

            <div className="rounded-xl border p-3.5">
              <p className="mb-1 text-sm font-semibold">Link existing vaults</p>
              <p className="mb-3 text-xs text-muted-foreground">
                The new account will access the selected accounts&apos; password data. You can only link vaults you already have access to.
              </p>
              {accounts === null ? (
                <Skeleton className="h-20 rounded-lg" />
              ) : shareableAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No vaults available to link.</p>
              ) : (
                <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {shareableAccounts.map((a) => {
                    const checked = selectedOwners.includes(a.id)
                    return (
                      <li key={a.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/60">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setSelectedOwners((prev) => (v ? [...prev, a.id] : prev.filter((id) => id !== a.id)))
                            }
                            aria-label={`Link ${a.email}'s vault`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {a.email}
                              {a.isSelf && <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">(your vault)</span>}
                            </span>
                            {!a.isSelf && <span className="block text-[11px] text-muted-foreground">shared with you</span>}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                <span className="text-xs font-medium">Allow the new account to edit linked vaults</span>
                <Switch checked={accCanWrite} onCheckedChange={setAccCanWrite} aria-label="Allow editing linked vaults" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => createOverlay.closeViaUi()} className="h-10 rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newEmail.trim() || newAccPassword.length < 8} className="h-10 rounded-xl font-semibold">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Empty trash confirm */}
      <AlertDialog open={emptyTrashOpen} onOpenChange={setEmptyTrashOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty the Trash?</AlertDialogTitle>
            <AlertDialogDescription>Everything in your Trash will be permanently deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleEmptyTrash() }}>
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Small popover hosting the generator inside the create-account dialog. */
function PopoverGen({
  options,
  onOptionsChange,
  onUse,
}: {
  options: GeneratorOptionsState
  onOptionsChange: (o: GeneratorOptionsState) => void
  onUse: (pw: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="h-10 shrink-0 rounded-xl px-3" onClick={() => setOpen(true)} aria-label="Generate password">
        <Dices className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 hidden" />
            Password generator
          </DialogTitle>
        </DialogHeader>
        <PasswordGenerator
          options={options}
          onOptionsChange={onOptionsChange}
          useLabel="Use this password"
          onUse={(pw) => {
            onUse(pw)
            setOpen(false)
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="h-9 rounded-xl">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Active device sessions (QR + password logins), each revocable. */
function DevicesSection({
  devices,
  onRevoke,
  revoking,
  onRefresh,
}: {
  devices: DeviceSessionDTO[] | null
  onRevoke: (d: DeviceSessionDTO) => void
  revoking: string | null
  onRefresh: () => void
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Active devices</h2>
          <p className="text-sm text-muted-foreground">
            Devices signed into your account, including PCs approved via QR login. Revoke any session instantly.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-lg" onClick={onRefresh}>
          <MonitorSmartphone className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      {devices === null ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active device sessions.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <MonitorSmartphone className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.deviceLabel}
                  {d.current && <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">This device</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.via === 'qr' ? 'Approved via QR scan' : 'Password sign-in'} · active {timeAgo(d.lastSeen)} · since {formatDate(d.createdAt)}
                </p>
              </div>
              {d.current ? (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  active
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 rounded-lg text-destructive hover:text-destructive"
                  onClick={() => onRevoke(d)}
                  disabled={revoking === d.id}
                >
                  {revoking === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
