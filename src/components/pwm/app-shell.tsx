'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FolderClosed,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Plus,
  ScanLine,
  Search,
  Settings2,
  Share2,
  Star,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LogoWord, LogoMark } from '@/components/pwm/logo'
import { CredentialFormDialog } from '@/components/pwm/credential-form-dialog'
import { PasswordGenerator, DEFAULT_OPTIONS, GeneratorOptionsState } from '@/components/pwm/password-generator'
import { QrScannerDialog } from '@/components/pwm/qr-scanner-dialog'
import { DashboardView } from '@/components/pwm/dashboard-view'
import { PasswordsView } from '@/components/pwm/passwords-view'
import { GroupsView } from '@/components/pwm/groups-view'
import { NotepadView } from '@/components/pwm/notepad-view'
import { SharedVaultsView } from '@/components/pwm/shared-vaults-view'
import { TrashView } from '@/components/pwm/trash-view'
import { SettingsView } from '@/components/pwm/settings-view'
import { PwmContext, PasswordsFilter, PwmContextValue, ViewKey } from '@/components/pwm/pwm-context'
import {
  bootNavHistory,
  navHandlers,
  rearmRootGuard,
  performExit,
  pushView,
  useOverlayHistory,
} from '@/components/pwm/nav-history'
import { api } from '@/lib/client'
import type { CredentialDTO, UserInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

const NAV_MAIN: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'passwords', label: 'All Passwords', icon: KeyRound },
  { key: 'groups', label: 'Groups', icon: FolderClosed },
  { key: 'notepad', label: 'Notepad', icon: NotebookPen },
  { key: 'shared', label: 'Shared Vaults', icon: Share2 },
  { key: 'favorites', label: 'Favorites', icon: Star },
  { key: 'trash', label: 'Trash', icon: Trash2 },
]

const NAV_SYSTEM: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'settings', label: 'Settings', icon: Settings2 },
]

/** Registers/unregisters a history-backed overlay and returns a UI-close that stays in sync. */
function useShellOverlay(open: boolean, close: () => void) {
  const { closeViaUi } = useOverlayHistory(open, close)
  return { closeViaUi }
}

export function AppShell({
  user,
  refreshUser,
  onLogout,
}: {
  user: UserInfo
  refreshUser: (u: UserInfo) => void
  onLogout: () => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [view, setView] = useState<ViewKey>('dashboard')
  const [search, setSearch] = useState('')
  const [passwordsFilter, setPasswordsFilter] = useState<PasswordsFilter>({})
  const [vaultVersion, setVaultVersion] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<CredentialDTO | null>(null)
  const [presetGroupId, setPresetGroupId] = useState<string | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genOptions, setGenOptions] = useState<GeneratorOptionsState>(DEFAULT_OPTIONS)
  const [qrOpen, setQrOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const bootRef = useRef(false)

  const bumpVault = useCallback(() => setVaultVersion((v) => v + 1), [])

  // ---- back-button coordination -------------------------------------------
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    bootNavHistory('dashboard')
  }, [])

  // Rebind on every mount (survives Fast Refresh / module instance swaps).
  useEffect(() => {
    navHandlers.onView = (v) => {
      setView(v)
      setMobileNavOpen(false)
    }
    navHandlers.onExitRequest = () => setExitOpen(true)
  })

  const navigate = useCallback((v: ViewKey) => {
    pushView(v)
    setMobileNavOpen(false)
  }, [])

  const openPasswords = useCallback(
    (filter?: PasswordsFilter) => {
      setPasswordsFilter(filter ?? {})
      navigate('passwords')
    },
    [navigate],
  )

  const genOverlay = useShellOverlay(genOpen, () => setGenOpen(false))
  const mobileNavOverlay = useShellOverlay(mobileNavOpen, () => setMobileNavOpen(false))

  const openAdd = useCallback(
    (preset?: { groupId?: string | null }) => {
      setEditing(null)
      setPresetGroupId(preset?.groupId ?? null)
      setAddOpen(true)
    },
    [],
  )

  const openEdit = useCallback((c: CredentialDTO) => {
    setEditing(c)
    setAddOpen(true)
  }, [])

  const openGenerator = useCallback(() => setGenOpen(true), [])
  const openQrScanner = useCallback(() => setQrOpen(true), [])

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore network issues — clear locally regardless
    }
    toast.success('Signed out', { description: 'Your vault was locked.' })
    onLogout()
  }, [onLogout])

  const ctxValue = useMemo<PwmContextValue>(
    () => ({
      user,
      refreshUser,
      view,
      setView: navigate,
      search,
      setSearch,
      passwordsFilter,
      openPasswords,
      openAdd,
      openEdit,
      openGenerator,
      openQrScanner,
      vaultVersion,
      bumpVault,
      logout,
    }),
    [user, refreshUser, view, navigate, search, passwordsFilter, openPasswords, openAdd, openEdit, openGenerator, openQrScanner, vaultVersion, bumpVault, logout],
  )

  const navItem = (item: (typeof NAV_MAIN)[number]) => {
    const active = view === item.key
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => navigate(item.key)}
        aria-current={view === item.key ? 'page' : undefined}
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
          view === item.key
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        <item.icon className={cn('h-4.5 w-4.5 shrink-0', view === item.key && 'text-emerald-600 dark:text-emerald-400')} />
        {item.label}
        {item.key === 'passwords' && view === 'passwords' && passwordsFilter.groupName && (
          <span className="ml-auto max-w-24 truncate rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
            {passwordsFilter.groupName}
          </span>
        )}
      </button>
    )
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-6 pt-5">
        <LogoWord />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main navigation">
        <p className="px-3.5 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Vault</p>
        {NAV_MAIN.map(navItem)}
        <p className="px-3.5 pb-2 pt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">System</p>
        {NAV_SYSTEM.map(navItem)}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary/50 p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
            {user.email.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user.email}</p>
            <p className="text-[10px] text-muted-foreground">Vault unlocked</p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={logout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  const ThemeToggle = (
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-xl"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* CSS-driven swap avoids hydration mismatch */}
      <Sun className="h-4.5 w-4.5 dark:hidden" />
      <Moon className="hidden h-4.5 w-4.5 dark:block" />
    </Button>
  )

  return (
    <PwmContext.Provider value={ctxValue}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-sidebar lg:block" aria-label="Sidebar">
          {sidebarContent}
        </aside>

        {/* Mobile nav sheet */}
        <Sheet open={mobileNavOpen} onOpenChange={(o) => (o ? setMobileNavOpen(true) : mobileNavOverlay.closeViaUi())}>
          <SheetContent side="left" className="w-80 p-0 [&>button]:hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-72">
          {/* Topbar */}
          <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-1.5 px-4 sm:gap-2 sm:px-6">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
              {/* Shield-only on phones, full wordmark from sm up (sidebar carries the brand on desktop) */}
              <span className="shrink-0 lg:hidden">
                <span className="sm:hidden">
                  <LogoMark size={32} className="rounded-xl" />
                </span>
                <span className="hidden sm:block">
                  <LogoWord compact />
                </span>
              </span>

              <div className="relative ml-auto min-w-0 flex-1 max-w-md lg:ml-0 lg:mr-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search all passwords…"
                  className="h-10 min-w-0 rounded-xl bg-secondary/60 pl-9 pr-9 border-transparent focus-visible:bg-background"
                  aria-label="Search all passwords"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-emerald-600" aria-label="Clear search">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Button onClick={() => openAdd()} className="hidden h-10 shrink-0 rounded-xl px-4 font-semibold sm:inline-flex">
                <Plus className="h-4 w-4" /> Add password
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl sm:hidden" onClick={() => openAdd()} aria-label="Add password">
                <Plus className="h-4.5 w-4.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl text-sky-600 dark:text-sky-400"
                onClick={openQrScanner}
                aria-label="Scan QR to approve a PC login"
                title="Scan QR to approve a PC login"
              >
                <ScanLine className="h-4.5 w-4.5" />
              </Button>
              {ThemeToggle}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 w-10 rounded-xl p-0" aria-label="Account menu">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                      {user.email.slice(0, 2).toUpperCase()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-semibold">{user.email}</p>
                    <p className="text-xs font-normal text-muted-foreground">Vault session active</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('settings')}>
                    <UserRound className="h-4 w-4" /> Account settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} variant="destructive">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl animate-view-in" key={view + (view === 'passwords' ? passwordsFilter.groupId ?? '' : '')}>
              {view === 'dashboard' && <DashboardView />}
              {view === 'passwords' && <PasswordsView mode="all" />}
              {view === 'groups' && <GroupsView />}
              {view === 'notepad' && <NotepadView />}
              {view === 'shared' && <SharedVaultsView />}
              {view === 'favorites' && <PasswordsView mode="favorites" />}
              {view === 'trash' && <TrashView />}
              {view === 'settings' && <SettingsView />}
            </div>
          </main>

          {/* Sticky footer */}
          <footer className="mt-auto border-t px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[11px] text-muted-foreground sm:justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <LogoMark size={16} className="rounded-md" /> Passway — Premium Password Manager
              </span>
              <span>AES-256-GCM vault encryption · Argon2id hashing · Auto-purging Trash · 2h idle session timeout</span>
            </div>
          </footer>
        </div>

        {/* Global dialogs */}
        <CredentialFormDialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o)
            if (!o) setEditing(null)
          }}
          editing={editing}
          presetGroupId={presetGroupId}
          onSaved={() => bumpVault()}
        />

        <Dialog open={genOpen} onOpenChange={(o) => (o ? setGenOpen(true) : genOverlay.closeViaUi())}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Password generator</DialogTitle>
              <DialogDescription>Cryptographically random passwords, generated locally in your browser.</DialogDescription>
            </DialogHeader>
            <PasswordGenerator options={genOptions} onOptionsChange={setGenOptions} />
          </DialogContent>
        </Dialog>

        <QrScannerDialog open={qrOpen} onOpenChange={setQrOpen} />

        {/* Exit confirmation (Android back at the dashboard) */}
        <AlertDialog
          open={exitOpen}
          onOpenChange={(o) => {
            setExitOpen(o)
            if (!o) rearmRootGuard() // Stay / dismiss — absorb the next back press again
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Passway?</AlertDialogTitle>
              <AlertDialogDescription>
                Your vault locks automatically when you leave. Active sessions keep working until they idle out.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setExitOpen(false)
                  performExit()
                }}
              >
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PwmContext.Provider>
  )
}
