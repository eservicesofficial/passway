'use client'

import { cn } from '@/lib/utils'
import { scorePassword } from '@/lib/ui'

export function StrengthMeter({ password, showLabel = true, className }: { password: string; showLabel?: boolean; className?: string }) {
  const { score, label, color } = scorePassword(password)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ backgroundColor: i <= score && password ? color : 'var(--muted)' }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold w-16 text-right" style={{ color: password ? color : 'var(--muted-foreground)' }}>
          {password ? label : '—'}
        </span>
      )}
      <span className="sr-only" role="status">
        {password ? `Password strength: ${label}` : 'Password strength: empty'}
      </span>
    </div>
  )
}
