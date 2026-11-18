/** Dates and amounts the way the current language wants to see them. */
export function useFormat() {
    const { locale } = useI18n()
    return {
        date: (iso: string | null | undefined) => formatDate(iso, locale.value),
        money: (n: number | string | null | undefined) => formatMoney(n, locale.value),
    }
}