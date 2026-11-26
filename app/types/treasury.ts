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

// ---- petty cash

export type FundStatus = 'active' | 'closed'
export type ExpenseStatus = 'open' | 'settled' | 'cancelled'

export interface PettyMovement {
    id: number
    kind: 'fund' | 'return'
    amount: number
    date: string
    note: string | null
    entryId: number
    entryNumber: number | null
}

export interface PettySettlement {
    id: number
    number: number
    date: string
    total: number
    status: 'posted' | 'cancelled'
    cancelReason: string | null
    entryId: number
    entryNumber: number | null
}

export interface PettyFund {
    id: number
    name: string
    status: FundStatus
    custodianDetailId: number | null
    custodianName: string | null
    fundAccountId: number
    fundAccount: string
    ceiling: number
    funded: number
    openExpenses: number
    onHand: number
    room: number
    createdAt: string
}

export interface PettyFundDetail extends PettyFund {
    movements: PettyMovement[]
    settlements: PettySettlement[]
}

export interface PettyExpense {
    id: number
    date: string
    amount: number
    description: string
    receiptNo: string | null
    status: ExpenseStatus
    settlementId: number | null
    accountId: number
    accountCode: string
    accountName: string
    detailId: number | null
    detailName: string | null
}

export interface PettyExpenseList {
    items: PettyExpense[]
    page: number
    pageSize: number
    total: number
}

// ---- cheque books

export type LeafStatus = 'unused' | 'issued' | 'voided'

export interface ChequeLeaf {
    id: number
    leafNo: number
    number: string
    status: LeafStatus
    chequeId: number | null
    voidReason: string | null
    chequeAmount: number | null
    chequeStatus: string | null
    dueDate: string | null
}

export interface ChequeBook {
    id: number
    name: string
    status: 'active' | 'closed'
    bankName: string
    branch: string | null
    bankAccountId: number
    bankAccount: string
    bankDetailId: number | null
    bankDetailName: string | null
    firstNumber: number
    leafCount: number
    unused: number
    issued: number
    voided: number
    nextLeafId: number | null
    nextNumber: string | null
    createdAt: string
}

export interface ChequeBookDetail extends ChequeBook {
    leaves: ChequeLeaf[]
}

/** An account that holds money (a cash box or a bank): the money lines of a voucher may use only these. */
export interface MoneyAccount { accountId: number; code: string; name: string }