'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Dices, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { StrengthMeter } from '@/components/pwm/strength-meter'
import { copyToClipboard } from '@/lib/client'
import { generatePassword } from '@/lib/ui'
import { toast } from 'sonner'

export interface GeneratorValue {
  password: string
  options: GeneratorOptionsState
}

export interface GeneratorOptionsState {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  avoidAmbiguous: boolean
}

const DEFAULT_OPTIONS: GeneratorOptionsState = {
  length: 18,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
}

export function PasswordGenerator({
  options,
  onOptionsChange,
  onUse,
  useLabel = 'Use password',
}: {
  options: GeneratorOptionsState
  onOptionsChange: (o: GeneratorOptionsState) => void
  onUse?: (password: string) => void
  useLabel?: string
}) {
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const regenerate = useCallback(() => {
    setPassword(generatePassword(options))
  }, [options])

  useEffect(() => {
    setPassword(generatePassword(options))
  }, [options])

  async function copy() {
    const ok = await copyToClipboard(password)
    if (ok) {
      setCopied(true)
      toast.success('Generated password copied')
      setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error('Copy failed')
    }
  }

  const toggles: Array<{ key: keyof GeneratorOptionsState; label: string }> = [
    { key: 'upper', label: 'Uppercase (A–Z)' },
    { key: 'lower', label: 'Lowercase (a–z)' },
    { key: 'digits', label: 'Numbers (0–9)' },
    { key: 'symbols', label: 'Symbols (!@#$)' },
    { key: 'avoidAmbiguous', label: 'Avoid look-alikes (l, 1, O, 0)' },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-secondary/50 p-3">
        <div className="flex items-center gap-2">
          <p className="flex-1 font-mono text-sm font-medium break-all select-all" aria-live="polite">
            {password || '—'}
          </p>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={regenerate} aria-label="Regenerate password">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={copy} aria-label="Copy generated password">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <StrengthMeter password={password} className="mt-2.5" />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="gen-length" className="text-sm">
            Length
          </Label>
          <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{options.length}</span>
        </div>
        <Slider
          id="gen-length"
          min={8}
          max={64}
          step={1}
          value={[options.length]}
          onValueChange={([v]) => onOptionsChange({ ...options, length: v })}
        />
      </div>

      <div className="space-y-1">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between py-1.5">
            <Label htmlFor={`gen-${t.key}`} className="text-sm font-normal cursor-pointer">
              {t.label}
            </Label>
            <Switch
              id={`gen-${t.key}`}
              checked={Boolean(options[t.key])}
              onCheckedChange={(v) => {
                const next = { ...options, [t.key]: v }
                if (!next.lower && !next.upper && !next.digits && !next.symbols) return
                onOptionsChange(next)
              }}
            />
          </div>
        ))}
      </div>

      {onUse && (
        <Button type="button" className="w-full h-10 rounded-xl font-semibold" onClick={() => onUse(password)} disabled={!password}>
          <Dices className="h-4 w-4" />
          {useLabel}
        </Button>
      )}
    </div>
  )
}

export { DEFAULT_OPTIONS }
