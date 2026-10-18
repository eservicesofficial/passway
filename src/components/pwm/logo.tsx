import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LogoMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl text-white shadow-lg shadow-emerald-600/20 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <ShieldCheck style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </div>
  )
}

export function LogoWord({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 32 : 38} />
      <div className="leading-tight">
        <div className={cn('font-bold tracking-tight', compact ? 'text-base' : 'text-lg')}>
          Passway
        </div>
        {!compact && (
          <div className="text-[11px] font-medium text-muted-foreground -mt-0.5">
            Password Manager
          </div>
        )}
      </div>
    </div>
  )
}
