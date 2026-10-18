'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Eye, EyeOff, Loader2, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LogoMark } from '@/components/pwm/logo'
import { StrengthMeter } from '@/components/pwm/strength-meter'
import { api } from '@/lib/client'
import type { UserInfo } from '@/lib/types'

interface Rule {
  label: string
  test: (pw: string) => boolean
}

const RULES: Rule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Contains a letter', test: (pw) => /[A-Za-z]/.test(pw) },
  { label: 'Contains a number', test: (pw) => /[0-9]/.test(pw) },
]

export function ForceChangeView({
  user,
  currentPasswordHint,
  onDone,
}: {
  user: UserInfo
  currentPasswordHint: string
  onDone: (user: UserInfo) => void
}) {
  const [currentPassword, setCurrentPassword] = useState(currentPasswordHint)
  const [newLoginId, setNewLoginId] = useState(user.email)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rulesOk = useMemo(() => RULES.map((r) => r.test(newPassword)), [newPassword])
  const allRulesOk = rulesOk.every(Boolean)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!allRulesOk || !passwordsMatch) return
    setError(null)
    setLoading(true)
    try {
      const res = await api<{ user: UserInfo }>('/api/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword,
          newLoginId: newLoginId.trim() !== user.email ? newLoginId.trim() : undefined,
          newPassword,
        },
      })
      toast.success('Your account is now secured', {
        description: 'Default password replaced. Welcome to Passway.',
      })
      onDone(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-mesh min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-md animate-view-in" aria-label="Secure your account">
          <div className="rounded-3xl border bg-card/80 backdrop-blur-xl shadow-xl shadow-emerald-900/5 p-6 sm:p-8">
            <div className="flex justify-center mb-5">
              <LogoMark size={56} className="animate-float-slow" />
            </div>
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-widest">Action required</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">Secure your account</h1>
            <p className="text-sm text-muted-foreground text-center mt-1.5 leading-relaxed">
              You&apos;re signed in with the default password. Choose a new, strong password before continuing.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginId">
                  Login ID <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="loginId"
                  type="text"
                  autoComplete="username"
                  value={newLoginId}
                  onChange={(e) => setNewLoginId(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <StrengthMeter password={newPassword} />
                <ul className="space-y-1 pt-1">
                  {RULES.map((rule, i) => (
                    <li key={rule.label} className="flex items-center gap-1.5 text-xs">
                      {rulesOk[i] ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
                      )}
                      <span className={rulesOk[i] ? 'text-foreground' : 'text-muted-foreground'}>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                  required
                />
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords don&apos;t match yet.</p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading || !allRulesOk || !passwordsMatch || !currentPassword}
                className="w-full h-11 rounded-xl text-sm font-semibold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? 'Securing…' : 'Save & continue'}
              </Button>
            </form>
          </div>
        </section>
      </main>
      <footer className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground">
        Passway · AES-256-GCM vault encryption · Argon2id password hashing
      </footer>
    </div>
  )
}
