'use client'

import { ArrowLeftRight, CircleCheckBig, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CredentialStatus } from '@/lib/types'

export const STATUS_META: Record<
  CredentialStatus,
  { label: string; dot: string; chip: string; icon: React.ComponentType<{ className?: string }> }
> = {
  in_process: {
    label: 'In Process',
    dot: 'bg-blue-500',
    chip: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    icon: CircleDot,
  },
  complete: {
    label: 'Complete',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: CircleCheckBig,
  },
  transferred: {
    label: 'Transferred',
    dot: 'bg-purple-500',
    chip: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
    icon: ArrowLeftRight,
  },
}

export function StatusChip({ status, className }: { status: CredentialStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.in_process
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold',
        meta.chip,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}
