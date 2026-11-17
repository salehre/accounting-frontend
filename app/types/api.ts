export interface SessionUser {
  id: number
  username: string
  fullName: string
  role: string
  permissions: string[]
  credentialChoicePending?: boolean
}

export interface Subscription {
  state: 'active' | 'grace' | 'expired' | 'suspended'
  endsAt: string | null
  graceEndsAt: string | null
}

export interface FeaturesPayload {
  plan: { code?: string; name?: string } | string | null
  subscription: Subscription | null
  features: string[]
  limits: Record<string, { max: number | null; used: number }>
}

export type AccountNature = 'debit' | 'credit' | 'both'

export interface Account {
  id: number
  parentId: number | null
  code: string
  name: string
  level: 1 | 2 | 3
  nature: AccountNature
  isPostable: boolean
  requiresDetail: boolean
  isActive: boolean
  hasChildren: boolean
  hasEntries: boolean
}
