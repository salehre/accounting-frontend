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

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface EntryRow {
  id: number
  number: number | null
  entryDate: string
  description: string | null
  status: 'draft' | 'posted'
  sourceType: string | null
  totalDebit: number
}

export interface EntryLine {
  id: number
  lineNo: number
  accountId: number
  accountCode: string
  accountName: string
  detailId: number | null
  detailName: string | null
  description: string | null
  debit: number
  credit: number
}

export interface JournalEntry {
  id: number
  fiscalYearId: number
  number: number | null
  entryDate: string
  description: string | null
  status: 'draft' | 'posted'
  sourceType: string | null
  sourceId: number | null
  reversesEntryId: number | null
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  lines: EntryLine[]
}

export interface ComboOption { value: number | string; label: string; sub?: string }

export interface LockEvent {
  id: number
  kind: 'soft' | 'hard'
  oldDate: string | null
  newDate: string | null
  reason: string
  username: string
  fullName: string | null
  ip: string | null
  postedEntries: number | null
  createdAt: string
}

export interface PeriodLockStatus {
  softLockDate: string | null
  hardLockDate: string | null
  effectiveLockDate: string | null
  events: LockEvent[]
}

export interface HardLockPreview {
  date: string
  canLock: boolean
  blockers: Array<{ code: string; message: string; count?: number; entries?: Array<{ id: number; entryDate: string; description: string | null }> }>
  warnings: Array<{ code: string; severity: 'important' | 'info'; message: string }>
  needsAcknowledgement: boolean
  summary: { postedEntries: number; totalDebit: number; totalCredit: number; lastEntryDate: string | null }
  confirmationPhrase: string
  token: string | null
}

export interface TrialBalanceRow {
  accountId: number
  code: string
  name: string
  level: number
  detailId?: number | null
  detailCode?: string | null
  detailName?: string | null
  openingDebit: number
  openingCredit: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
}

export interface TrialBalance {
  fiscalYear: { id: number; title: string }
  from: string
  to: string
  level: number
  includeClosing: boolean
  rows: TrialBalanceRow[]
  totals: Record<'openingDebit' | 'openingCredit' | 'periodDebit' | 'periodCredit' | 'closingDebit' | 'closingCredit', number>
  balanced: boolean | null
}

export interface LedgerItem {
  lineId: number
  entryId: number
  number: number
  date: string
  entryDescription: string | null
  lineDescription: string | null
  accountCode: string
  accountName: string
  detailId: number | null
  detailName: string | null
  debit: number
  credit: number
  balance: number
}

export interface Ledger {
  fiscalYear: { id: number; title: string }
  account: { id: number; code: string; name: string; level: number }
  detailId: number | null
  from: string
  to: string
  includeClosing: boolean
  openingBalance: number
  totals: { periodDebit: number; periodCredit: number; closingBalance: number }
  items: LedgerItem[]
  nextCursor: string | null
}

export interface JournalLine {
  lineNo: number
  accountCode: string
  accountName: string
  detailName: string | null
  description: string | null
  debit: number
  credit: number
}

export interface JournalItem {
  id: number
  number: number
  date: string
  description: string | null
  sourceType: string | null
  totalDebit: number
  totalCredit: number
  lines: JournalLine[]
}

export interface Journal {
  fiscalYear: { id: number; title: string }
  from: string
  to: string
  fromNumber: number | null
  toNumber: number | null
  totals: { debit: number; credit: number }
  items: JournalItem[]
  nextCursor: string | null
}

export interface StatementRow { accountId: number; code: string; name: string; level: number; amount: number }
export interface StatementGroup { rows: StatementRow[]; total: number }
export interface UnclassifiedAccount { accountId: number; code: string; name: string; balance: number }
export interface StatementWarning { code: string; message: string; accounts?: UnclassifiedAccount[] }

export interface IncomeStatement {
  fiscalYear: { id: number; title: string }
  from: string
  to: string
  level: number
  revenue: StatementGroup
  expenses: StatementGroup
  netProfit: number
  complete: boolean
  warnings: StatementWarning[]
}

export interface BalanceSheet {
  fiscalYear: { id: number; title: string }
  date: string
  level: number
  assets: StatementGroup
  liabilities: StatementGroup
  equity: StatementGroup
  currentPeriodResult: number
  liabilitiesAndEquity: number
  difference: number
  balanced: boolean
  complete: boolean
  warnings: StatementWarning[]
}

export interface UserItem {
  id: number
  username: string
  fullName: string
  roleId: number
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface UserPage { items: UserItem[]; page: number; pageSize: number; total: number }

export interface Role { id: number; name: string; permissions: string[]; builtIn: boolean; userCount: number }

export interface PermissionCatalog { permissions: string[]; requires: Record<string, string[]> }

// ---- year-end entries
export interface YearEndIssue {
  code: string
  message: string
  count?: number
  fields?: string[]
  accounts?: Array<string | { accountId: number; code: string; balance: number }>
  groups?: Array<{ id: number; code: string; name: string }>
}

export interface YearEndLine {
  accountId: number
  accountCode: string
  accountName: string
  detailId: number | null
  detailName: string | null
  debit: number
  credit: number
}

export interface YearEndEntry {
  type: 'temporary' | 'profit' | 'closing' | 'opening'
  fiscalYearId: number
  entryDate: string
  description: string
  totalDebit: number
  totalCredit: number
  lines: YearEndLine[]
}

export interface YearEndExisting {
  id: number
  status?: 'draft' | 'posted'
  fiscalYearId?: number
  entryDate?: string
  description?: string
  sourceType?: string
}

export interface YearEndPreview {
  fiscalYearId: number
  status: 'open' | 'closed'
  state: 'none' | 'drafts' | 'posted'
  canGenerate: boolean
  actions: { generate: boolean; discard: boolean; post: boolean; reverse: boolean }
  blockers: YearEndIssue[]
  warnings: YearEndIssue[]
  summary: { netProfit: number; temporaryAccounts: number; permanentAccounts: number; nextFiscalYearId: number | null } | null
  entries: YearEndEntry[]
  existing: YearEndExisting[]
}

// ---- accounting settings
export const ACCOUNT_CATEGORIES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number]

/** A level 1 group and the type (asset, liability...) the year-end entries use for it */
export interface AccountCategoryRow {
  id: number
  code: string
  name?: string
  category: AccountCategory | null
  hasEntries: boolean
}

type SettingAccount = { id: number; code: string; name?: string } | null
export interface AccountingSettings {
  profitLossAccountId: SettingAccount
  retainedEarningsAccountId: SettingAccount
  closingAccountId: SettingAccount
  openingAccountId: SettingAccount
}