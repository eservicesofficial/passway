'use client'

import { createContext, useContext } from 'react'
import type { CredentialDTO, UserInfo } from '@/lib/types'

export type ViewKey =
  | 'dashboard'
  | 'passwords'
  | 'groups'
  | 'notepad'
  | 'shared'
  | 'favorites'
  | 'trash'
  | 'settings'

export interface PasswordsFilter {
  groupId?: string | null
  groupName?: string | null
  tag?: string | null
  status?: string | null
}

export interface PwmContextValue {
  user: UserInfo
  refreshUser: (u: UserInfo) => void
  view: ViewKey
  setView: (v: ViewKey) => void
  search: string
  setSearch: (s: string) => void
  passwordsFilter: PasswordsFilter
  openPasswords: (filter?: PasswordsFilter) => void
  openAdd: (preset?: { groupId?: string | null; favorite?: boolean }) => void
  openEdit: (c: CredentialDTO) => void
  openGenerator: () => void
  openQrScanner: () => void
  vaultVersion: number
  bumpVault: () => void
  logout: () => Promise<void>
}

export const PwmContext = createContext<PwmContextValue | null>(null)

export function usePwm(): PwmContextValue {
  const ctx = useContext(PwmContext)
  if (!ctx) throw new Error('usePwm must be used inside PwmContext.Provider')
  return ctx
}
