import { z } from 'zod'

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, 'Login ID is required').max(200),
  password: z.string().min(1, 'Password is required').max(200),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newLoginId: z.string().trim().max(200).optional(),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(200)
    .regex(/[A-Za-z]/, 'New password must contain a letter')
    .regex(/[0-9]/, 'New password must contain a number')
    .optional(),
})

export const createAccountSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(3, 'Login ID must be at least 3 characters')
    .max(200)
    .refine((v) => !/\s/.test(v), 'Login ID cannot contain spaces'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  shareWith: z.array(z.string()).max(50).default([]),
  canWrite: z.boolean().default(true),
})

const tagsSchema = z.array(z.string().trim().min(1).max(32)).max(10).default([])

export const CREDENTIAL_STATUSES = ['in_process', 'complete', 'transferred'] as const
// "delete" is an input-only status: selecting it moves the credential to Trash
export const CREDENTIAL_STATUS_INPUTS = [...CREDENTIAL_STATUSES, 'delete'] as const

export const credentialCreateSchema = z.object({
  ownerId: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  url: z.string().trim().max(2048).optional().or(z.literal('')),
  username: z.string().max(320).optional().or(z.literal('')),
  email: z.string().trim().max(320).optional().or(z.literal('')),
  password: z.string().max(1000).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  groupId: z.string().nullable().optional(),
  tags: tagsSchema,
  favorite: z.boolean().default(false),
  status: z.enum(CREDENTIAL_STATUS_INPUTS).default('in_process'),
  statusRemarks: z.string().max(1000).optional().or(z.literal('')),
})

export const credentialUpdateSchema = z.object({
  action: z.enum(['trash', 'restore', 'favorite']).optional(),
  value: z.boolean().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  url: z.string().trim().max(2048).optional().or(z.literal('')),
  username: z.string().max(320).optional().or(z.literal('')),
  email: z.string().trim().max(320).optional().or(z.literal('')),
  password: z.string().max(1000).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  groupId: z.string().nullable().optional(),
  tags: tagsSchema.optional(),
  favorite: z.boolean().optional(),
  status: z.enum(CREDENTIAL_STATUS_INPUTS).optional(),
  statusRemarks: z.string().max(1000).optional().or(z.literal('')),
})

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#10b981'),
})

export const groupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export const shareCreateSchema = z.object({
  granteeEmail: z.string().trim().min(3).max(200),
  canWrite: z.boolean().default(true),
})

export const shareUpdateSchema = z.object({
  canWrite: z.boolean(),
})

export type CredentialCreateInput = z.infer<typeof credentialCreateSchema>
export type CredentialUpdateInput = z.infer<typeof credentialUpdateSchema>

// ---------------------------------------------------------------------------
// Notepad
// ---------------------------------------------------------------------------
export const noteCreateSchema = z.object({
  content: z.string().min(1, 'Note cannot be empty').max(50000),
  pinned: z.boolean().default(false),
})

export const noteUpdateSchema = z.object({
  action: z.enum(['trash', 'restore', 'purge', 'pin']).optional(),
  value: z.boolean().optional(),
  content: z.string().min(1).max(50000).optional(),
})

// ---------------------------------------------------------------------------
// QR device login
// ---------------------------------------------------------------------------
export const qrApproveSchema = z.object({
  token: z.string().trim().regex(/^[0-9a-f]{64}$/, 'Invalid pairing code'),
  action: z.enum(['approve', 'deny']),
})
