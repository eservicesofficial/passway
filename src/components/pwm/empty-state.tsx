'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6 animate-view-in', className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 blur-lg scale-125" aria-hidden="true" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/20">
          <Icon className="h-9 w-9 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 h-10 px-5 rounded-xl">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
