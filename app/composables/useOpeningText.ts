/**
 * The import report is written in English by the server (one sentence per problem).
 * Known sentences are translated here by pattern; anything else is shown as it came.
 */
export function useOpeningText() {
    const { t, te } = useI18n()
    const fmt = useFormat()

    const REASONS: Array<[RegExp, string]> = [
        [/^must be a number, not a date/, 'notDate'],
        [/^must be a whole number of rials \(no decimals\)/, 'noDecimals'],
        [/^must be a whole number of rials/, 'wholeNumber'],
        [/^is too large/, 'tooLarge'],
        [/^cannot be negative/, 'negative'],
    ]
    function reason(r: string): string {
        for (const [re, key] of REASONS) if (re.test(r)) return t(`opening.reasons.${key}`)
        return r
    }

    const RULES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
        [/^The account code is empty/, () => t('opening.err.accountEmpty')],
        [/^Debit: (.+)$/, (m) => t('opening.err.debit', { reason: reason(m[1]!) })],
        [/^Credit: (.+)$/, (m) => t('opening.err.credit', { reason: reason(m[1]!) })],
        [/^A row cannot have both/, () => t('opening.err.both')],
        [/^Account code "(.+?)" does not exist/, (m) => t('opening.err.noAccount', { code: m[1]! })],
        [/^"(.+?)" is not a movement account/, (m) => t('opening.err.notMovement', { code: m[1]! })],
        [/^Account "(.+?)" is disabled/, (m) => t('opening.err.accountDisabled', { code: m[1]! })],
        [/^Detail account code "(.+?)" does not exist/, (m) => t('opening.err.noDetail', { code: m[1]! })],
        [/^Detail account "(.+?)" is disabled/, (m) => t('opening.err.detailDisabled', { code: m[1]! })],
        [/^Account "(.+?)" needs a detail account code/, (m) => t('opening.err.needsDetail', { code: m[1]! })],
        [/^This fiscal year is closed/, () => t('opening.err.yearClosed')],
        [/^Opening balances were already imported/, () => t('opening.err.already')],
        [/^The file has no row with an amount/, () => t('opening.err.noRows')],
        [/^The balances do not add up: total debit (\d+), total credit (\d+) \(difference (\d+)\)/, (m) => t('opening.err.notBalanced', { debit: fmt.money(m[1]!), credit: fmt.money(m[2]!), diff: fmt.money(m[3]!) })],
    ]
    function error(message: string): string {
        for (const [re, fn] of RULES) { const m = message.match(re); if (m) return fn(m) }
        return message
    }

    function warning(w: { code: string; message: string }): string {
        if (w.code === 'rows_without_amount') {
            const n = w.message.match(/^(\d+)/)?.[1] ?? '0'
            return t('opening.warnings.rows_without_amount', { n: fmt.money(n) })
        }
        return te(`opening.warnings.${w.code}`) ? t(`opening.warnings.${w.code}`) : w.message
    }

    return { error, warning }
}