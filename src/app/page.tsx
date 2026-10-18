'use client'

import { useCallback, useEffect, useState } from 'react'
import { LogoMark } from '@/components/pwm/logo'
import { LoginView } from '@/components/pwm/login-view'
import { ForceChangeView } from '@/components/pwm/force-change-view'
import { AppShell } from '@/components/pwm/app-shell'
import { api } from '@/lib/client'
import type { UserInfo } from '@/lib/types'

type Stage = 'loading' | 'login' | 'force' | 'app'

export default function Home() {
  const [stage, setStage] = useState<Stage>('loading')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loginPassword, setLoginPassword] = useState('')

  const bootstrap = useCallback(() => {
    api<{ user: UserInfo }>('/api/auth/me')
      .then((res) => {
        setUser(res.user)
        setStage(res.user.mustChangePassword ? 'force' : 'app')
      })
      .catch(() => {
        setUser(null)
        setStage('login')
      })
  }, [])

  useEffect(() => {
    bootstrap()
    const onUnauthorized = () => {
      setUser(null)
      setLoginPassword('')
      setStage('login')
    }
    window.addEventListener('passway:unauthorized', onUnauthorized)
    return () => window.removeEventListener('passway:unauthorized', onUnauthorized)
  }, [bootstrap])

  function handleLogin(u: UserInfo, password: string) {
    setUser(u)
    setLoginPassword(password)
    setStage(u.mustChangePassword ? 'force' : 'app')
  }

  function handleForceDone(u: UserInfo) {
    setUser(u)
    setLoginPassword('')
    setStage('app')
  }

  if (stage === 'loading') {
    return (
      <div className="bg-mesh flex min-h-screen flex-col items-center justify-center gap-4">
        <LogoMark size={56} className="animate-float-slow" />
        <div className="flex items-center gap-1.5" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/70"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">Unlocking Passway…</p>
      </div>
    )
  }

  if (stage === 'login') {
    return <LoginView onLogin={handleLogin} />
  }

  if (stage === 'force' && user) {
    return <ForceChangeView user={user} currentPasswordHint={loginPassword} onDone={handleForceDone} />
  }

  if (user) {
    return <AppShell user={user} refreshUser={setUser} onLogout={() => { setUser(null); setLoginPassword(''); setStage('login') }} />
  }

  return null
}
