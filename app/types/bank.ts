export interface BankStatementRow {
    id: number
    title: string
    status: 'open' | 'reconciled'
    accountId: number
    accountCode: string
    accountName: string
    detailId: number | null
    detailName: string | null
    dateFrom: string
    dateTo: string
    openingBalance: number
    closingBalance: number
    lineCount: number
    openLineCount: number
}

export interface BankStatementLine {
    id: number
    lineNo: number
    date: string
    description: string | null
    reference: string | null
    amount: number
    matchedLines: number[]
    matched: boolean
}

export interface BankSummary {
    bookBalance: number
    bankClosingBalance: number
    unmatchedStatementTotal: number
    unmatchedBookTotal: number
    adjustedBookBalance: number
    adjustedBankBalance: number
    difference: number
    openLineCount: number
    openBookLineCount: number
}

export interface BankStatement {
    id: number
    title: string
    status: 'open' | 'reconciled'
    accountId: number
    detailId: number | null
    fiscalYearId: number
    dateFrom: string
    dateTo: string
    openingBalance: number
    closingBalance: number
    reconciledAt: string | null
    summary: BankSummary
    lines: BankStatementLine[]
}

/** open: waiting for the bank | matched: seen on this or an earlier statement | cleared: cleared before the statement */
export interface BankBookLine {
    id: number
    entryId: number
    entryNumber: number
    date: string
    entryDescription: string | null
    lineDescription: string | null
    detailName: string | null
    amount: number
    matchedStatementId: number | null
    matchedStatementLineId: number | null
    state: 'open' | 'matched' | 'cleared'
}