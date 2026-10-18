'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, KeyRound, Loader2, LogIn, QrCode, ShieldCheck, Lock, Clock, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LogoMark } from '@/components/pwm/logo'
import { QrLoginPanel } from '@/components/pwm/qr-login-panel'
import { api } from '@/lib/client'
import type { UserInfo } from '@/lib/types'

const FEATURES = [
  { icon: Lock, title: 'End-to-end vault encryption', text: 'AES-256-GCM keeps every secret sealed at rest.' },
  { icon: UsersRound, title: 'Shared vaults', text: 'Grant or revoke access across your accounts.' },
  { icon: Clock, title: 'Recoverable Trash', text: 'Deleted items stay restorable for 30 days.' },
]

export function LoginView({ onLogin }: { onLogin: (user: UserInfo, password: string) => void }) {
  const [mode, setMode] = useState<'password' | 'qr'>('password')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await api<{ user: UserInfo }>('/api/auth/login', {
        method: 'POST',
        body: { loginId, password },
      })
      toast.success(`Welcome back, ${res.user.email}`)
      onLogin(res.user, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-mesh flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
          {/* Brand panel */}
          <section className="hidden animate-view-in lg:block">
            <div className="flex items-center gap-3">
              <LogoMark size={52} className="animate-float-slow" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Passway</h1>
                <p className="text-sm font-medium text-muted-foreground">Premium Password Manager</p>
              </div>
            </div>
            <p className="mt-8 max-w-md text-2xl font-semibold leading-snug tracking-tight">
              Every credential you own, <span className="text-emerald-600 dark:text-emerald-400">sealed with AES-256-GCM</span> and always within reach.
            </p>
            <ul className="mt-10 space-y-5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card shadow-sm">
                    <f.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-sm text-muted-foreground">{f.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Login card */}
          <section className="animate-view-in" aria-label="Sign in">
            <div className="rounded-3xl border bg-card/80 p-6 shadow-xl shadow-emerald-900/5 backdrop-blur-xl sm:p-8">
              <div className="mb-6 flex justify-center lg:hidden">
                <LogoMark size={56} />
              </div>

              {mode === 'password' ? (
                <>
                  <div className="mb-1 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs font-bold uppercase tracking-widest">Secure sign-in</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Sign in to unlock your vault.</p>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="loginId">Login ID</Label>
                      <Input
                        id="loginId"
                        type="text"
                        autoComplete="username"
                        placeholder="you@example.com"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        className="h-11"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-11 pr-11"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="animate-view-in">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" disabled={loading || !loginId || !password} className="h-11 w-full rounded-xl text-sm font-semibold">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                      {loading ? 'Unlocking vault…' : 'Unlock vault'}
                    </Button>
                  </form>

                  <button
                    type="button"
                    onClick={() => { setMode('qr'); setError(null) }}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <QrCode className="h-4 w-4" /> Sign in with QR code
                  </button>
                </>
              ) : (
                <QrLoginPanel
                  onApproved={(user) => {
                    toast.success(`Welcome back, ${user.email}`)
                    onLogin(user, '')
                  }}
                  onBack={() => setMode('password')}
                />
              )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Protected by rate limiting · Argon2id · HttpOnly sessions
            </div>
          </section>
        </div>
      </main>
      <footer className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground">
        Passway · AES-256-GCM vault encryption · Argon2id password hashing
      </footer>
    </div>
  )
}
