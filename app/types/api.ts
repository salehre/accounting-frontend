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

export type DetailKind = 'customer' | 'supplier' | 'employee' | 'bank' | 'cash' | 'cost_center' | 'other'
export const DETAIL_KINDS: DetailKind[] = ['customer', 'supplier', 'employee', 'bank', 'cash', 'cost_center', 'other']

export interface DetailAccount {
  id: number
  code: string
  name: string
  kind: DetailKind
  isActive: boolean
}

export interface FiscalYear {
  id: number
  title: string
  startDate: string
  endDate: string
  status: 'open' | 'closed'
  postedEntries: number
  draftEntries: number
  hasEntries: boolean
}

export interface CloseCheck {
  fiscalYearId: number
  status: 'open' | 'closed'
  canClose: boolean
  blockers: Array<{ code: string; message: string; count?: number; entries?: Array<{ id: number; entryDate: string; description: string | null }> }>
  warnings: Array<{ code: string; message: string }>
  summary: { postedEntries: number; draftEntries: number; lastEntryNumber: number | null; totalDebit: number; totalCredit: number }
}