export type ChequeDirection = 'received' | 'issued'
export type ChequeStatus = 'in_hand' | 'deposited' | 'cleared' | 'bounced' | 'returned' | 'endorsed' | 'issued' | 'cancelled'
export type ChequeAction = 'deposit' | 'clear' | 'bounce' | 'return' | 'endorse' | 'cancel'

export const CHEQUE_STATUSES: ChequeStatus[] = ['in_hand', 'deposited', 'cleared', 'bounced', 'returned', 'endorsed', 'issued', 'cancelled']

export interface Cheque {
    id: number
    direction: ChequeDirection
    number: string
    sayadId: string | null
    bankName: string
    branch: string | null
    amount: number
    issueDate: string
    dueDate: string
    status: ChequeStatus
    overdue: boolean
    counterpartyAccountId: number
    counterpartyAccount: string
    counterpartyDetailId: number | null
    counterpartyDetailName: string | null
    bankAccountId: number | null
    bankAccount: string | null
    bankDetailId: number | null
    description: string | null
    createdAt: string
}

export interface ChequeEvent {
    id: number
    action: string
    fromStatus: ChequeStatus | null
    toStatus: ChequeStatus
    date: string
    entryId: number | null
    entryNumber: number | null
    note: string | null
    by: string | null
    at: string
}

export interface ChequeDetail extends Cheque {
    events: ChequeEvent[]
    actions: ChequeAction[]
}

export interface ChequeList {
    items: Cheque[]
    page: number
    pageSize: number
    total: number
}

export interface Bucket { count: number; total: number }
export interface DirectionSummary {
    statuses: Partial<Record<ChequeStatus, Bucket>>
    overdue: Bucket
    next7: Bucket
    next30: Bucket
}
export interface TreasurySummary { received: DirectionSummary; issued: DirectionSummary; today: string }

export type SettingKey = 'cheques_receivable' | 'cheques_in_collection' | 'cheques_payable'
export const SETTING_KEYS: SettingKey[] = ['cheques_receivable', 'cheques_in_collection', 'cheques_payable']
export type TreasurySettings = Record<SettingKey, { accountId: number; code: string; name: string } | null>

// ---- receipts and payments of money (vouchers)
export type VoucherKind = 'receipt' | 'payment'
export type VoucherStatus = 'posted' | 'cancelled'
export type PayMethod = 'cash' | 'bank' | 'card' | 'other'
export const PAY_METHODS: PayMethod[] = ['cash', 'bank', 'card', 'other']

export interface VoucherLine {
    id: number
    method: PayMethod
    accountId: number
    accountCode: string
    accountName: string
    detailId: number | null
    detailName: string | null
    amount: number
    reference: string | null
}

export interface Voucher {
    id: number
    kind: VoucherKind
    number: number
    date: string
    amount: number
    status: VoucherStatus
    partyAccountId: number
    partyAccount: string
    partyDetailId: number | null
    partyDetailName: string | null
    description: string | null
    entryId: number
    entryNumber: number | null
    reversalEntryId: number | null
    reversalNumber: number | null
    cancelReason: string | null
    createdAt: string
}

export interface VoucherDetail extends Voucher { lines: VoucherLine[] }

export interface VoucherList {
    items: Voucher[]
    page: number
    pageSize: number
    total: number
    postedTotal: number
}