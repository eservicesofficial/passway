/** Shared DTO types used by both API routes and client components. */

export interface UserInfo {
  id: string
  email: string
  mustChangePassword: boolean
  createdAt: string
}

export interface CredentialDTO {
  id: string
  ownerId: string
  ownerEmail?: string
  title: string
  url: string | null
  username: string | null
  email: string | null
  password: string | null
  notes: string | null
  groupId: string | null
  groupName: string | null
  groupColor: string | null
  tags: string[]
  favorite: boolean
  status: CredentialStatus
  statusRemarks: string | null
  dupCount: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CredentialStatus = 'in_process' | 'complete' | 'transferred'

export interface GroupDTO {
  id: string
  name: string
  color: string
  count: number
  createdAt: string
}

export interface AccountDTO {
  id: string
  email: string
  createdAt: string
  isSelf: boolean
  shareable: boolean // current user may delegate this account's vault to a new account
  iGranted: boolean // current user granted this account access to their vault
  grantedToMe: boolean // this account granted the current user access
}

export interface ShareDTO {
  id: string
  canWrite: boolean
  createdAt: string
  owner: { id: string; email: string }
  grantee: { id: string; email: string }
}

export interface ActivityDTO {
  id: string
  action: string
  detail: string | null
  createdAt: string
}

export interface DashboardDTO {
  totals: {
    passwords: number
    groups: number
    favorites: number
    trashed: number
    sharedWithMe: number
    grantedTo: number
  }
  security: {
    reused: number
    weak: number
  }
  recent: ActivityDTO[]
}

export type SortKey = 'updated' | 'title' | 'titleDesc' | 'created'

// ---------------------------------------------------------------------------
// Notepad (Memos-inspired)
// ---------------------------------------------------------------------------
export interface NoteDTO {
  id: string
  content: string
  pinned: boolean
  tags: string[]
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  attachments: { id: string; name: string; mime: string; size: number }[]
}

// ---------------------------------------------------------------------------
// QR device login
// ---------------------------------------------------------------------------
export interface PairingCreateInfo {
  token: string
  qrDataUrl: string
  expiresAt: string
}

export interface PairingInfoDTO {
  deviceLabel: string
  createdAt: string
  expiresAt: string
}

export type PairingPollStatus = 'pending' | 'approved' | 'denied' | 'expired'

export interface DeviceSessionDTO {
  id: string // sha256 prefix handle
  deviceLabel: string
  via: string
  lastSeen: string
  createdAt: string
  current: boolean
}
