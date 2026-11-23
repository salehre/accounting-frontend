import { jalaliToIso } from './date'
import { normalizeDigits } from './digits'

/** Column numbers are zero-based; -1 means "this column is not in the file". */
export interface Mapping {
    hasHeader: boolean
    date: number
    description: number
    reference: number
    mode: 'single' | 'split'
    amount: number       // one signed column (mode "single")
    deposit: number      // two columns (mode "split")
    withdrawal: number
    reverse: boolean     // mode "single": the file shows withdrawals as positive
}

export interface ParsedLine { row: number; date: string; description: string; reference: string; amount: number }
export interface RowIssue { row: number; kind: 'date' | 'amount'; value: string }

const has = (s: string, words: string[]) => words.some((w) => s.includes(w))

/** Looks at the header names (Persian or English) and guesses which column is which. */
export function guessMapping(header: string[]): Mapping {
    const names = header.map((h) => normalizeDigits(h).toLowerCase().replace(/[‌\s]+/g, ' ').trim())
    const find = (words: string[], not: number[] = []) => names.findIndex((n, i) => !not.includes(i) && has(n, words))

    const date = find(['تاریخ', 'date'])
    const deposit = find(['واریز', 'بستانکار', 'deposit', 'credit', 'received'])
    const withdrawal = find(['برداشت', 'بدهکار', 'withdraw', 'debit', 'paid'])
    const amount = find(['مبلغ', 'amount'], [deposit, withdrawal])
    const description = find(['شرح', 'توضیح', 'description', 'narration', 'memo', 'details'], [date])
    const reference = find(['پیگیری', 'مرجع', 'شماره', 'ref', 'trace', 'serial', 'cheque', 'check', 'چک'], [date, description])

    const split = deposit >= 0 && withdrawal >= 0
    return {
        hasHeader: true,
        date,
        description,
        reference,
        mode: split || amount < 0 ? 'split' : 'single',
        amount,
        deposit,
        withdrawal,
        reverse: false,
    }
}

/** "1405/08/05", "۱۴۰۵-۸-۵", "2026-10-28", "28/10/2026 14:30" -> "2026-10-28". Jalali when the year is below 1700. */
export function parseDate(raw: string): string | null {
    const s = normalizeDigits(raw).trim().split(/[\sT]/)[0] ?? ''
    let y: number, m: number, d: number

    let match = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(s)
    if (match) { y = +match[1]!; m = +match[2]!; d = +match[3]! }
    else if ((match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s))) { d = +match[1]!; m = +match[2]!; y = +match[3]! }
    else return null

    if (y < 1700) return jalaliToIso(y, m, d)

    const probe = new Date(Date.UTC(y, m - 1, d))
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * "1,250,000", "۱٬۲۵۰٬۰۰۰", "(500)", "500-", "−500", "1000.00" -> a whole number (null when it is not a number).
 * Empty text is null too; the caller decides what that means.
 */
export function parseAmount(raw: string): number | null {
    let s = normalizeDigits(raw).replace(/[‌\s]/g, '').replace(/[٬,،]/g, '').replace(/٫/g, '.').replace(/[−–]/g, '-')
    if (s === '') return null

    let negative = false
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
    if (s.endsWith('-')) { negative = !negative; s = s.slice(0, -1) }
    if (s.startsWith('-')) { negative = !negative; s = s.slice(1) }
    else if (s.startsWith('+')) s = s.slice(1)

    if (!/^\d+(\.\d+)?$/.test(s)) return null
    const [whole, fraction] = s.split('.') as [string, string | undefined]
    if (fraction && /[1-9]/.test(fraction)) return null // rials are whole numbers
    if (whole.length > 15) return null

    const n = Number(whole)
    return negative ? -n : n
}

export function parseLines(rows: string[][], mapping: Mapping): { lines: ParsedLine[]; issues: RowIssue[] } {
    const lines: ParsedLine[] = []
    const issues: RowIssue[] = []
    const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')

    rows.forEach((r, index) => {
        if (mapping.hasHeader && index === 0) return
        const rowNo = index + 1

        const date = parseDate(cell(r, mapping.date))
        if (!date) { issues.push({ row: rowNo, kind: 'date', value: cell(r, mapping.date) }); return }

        let amount: number | null
        if (mapping.mode === 'single') {
            amount = parseAmount(cell(r, mapping.amount))
            if (amount !== null && mapping.reverse) amount = -amount
        } else {
            const deposit = parseAmount(cell(r, mapping.deposit)) ?? 0
            const withdrawal = parseAmount(cell(r, mapping.withdrawal)) ?? 0
            const bad = (cell(r, mapping.deposit) !== '' && parseAmount(cell(r, mapping.deposit)) === null)
                || (cell(r, mapping.withdrawal) !== '' && parseAmount(cell(r, mapping.withdrawal)) === null)
            amount = bad ? null : Math.abs(deposit) - Math.abs(withdrawal)
        }

        if (amount === null || amount === 0) {
            issues.push({ row: rowNo, kind: 'amount', value: mapping.mode === 'single' ? cell(r, mapping.amount) : `${cell(r, mapping.deposit)} / ${cell(r, mapping.withdrawal)}` })
            return
        }

        lines.push({ row: rowNo, date, description: cell(r, mapping.description), reference: cell(r, mapping.reference), amount })
    })

    return { lines, issues }
}