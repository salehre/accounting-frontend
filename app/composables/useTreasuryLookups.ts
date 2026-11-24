import type { Account, ComboOption, DetailAccount } from '~/types/api'

/** The accounts and detail accounts a cheque form chooses from (loaded once per page). */
export function useTreasuryLookups() {
    const api = useApi()
    const errorText = useErrorText()
    const { t } = useI18n()

    const accounts = ref<Account[]>([])
    const details = ref<DetailAccount[]>([])
    const error = ref<string | null>(null)
    const ready = ref(false)

    async function load() {
        try {
            const [a, d] = await Promise.all([
                api.get<Account[]>('/accounts', { activeOnly: 1 }),
                api.get<DetailAccount[]>('/detail-accounts', { limit: 500 }),
            ])
            accounts.value = a.filter((x) => x.level === 3 && x.isPostable)
            details.value = (Array.isArray(d) ? d : []).filter((x) => x.isActive)
        } catch (e) {
            error.value = errorText.of(e)
        } finally {
            ready.value = true
        }
    }

    const accountOptions = computed<ComboOption[]>(() => accounts.value.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })))
    const bankOptions = computed<ComboOption[]>(() => [...accounts.value]
        .map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })))

    /** Customers and suppliers first, the rest after them. */
    const detailOptions = computed<ComboOption[]>(() => [...details.value]
        .sort((x, y) => rank(x.kind) - rank(y.kind))
        .map((d) => ({ value: d.id, label: `${d.code} ${d.name}`, sub: t(`detail.kind.${d.kind}`) })))
    const bankDetailOptions = computed<ComboOption[]>(() => [...details.value]
        .sort((x, y) => Number(y.kind === 'bank') - Number(x.kind === 'bank'))
        .map((d) => ({ value: d.id, label: `${d.code} ${d.name}`, sub: t(`detail.kind.${d.kind}`) })))

    const rank = (k: string) => (k === 'customer' || k === 'supplier' ? 0 : 1)
    const accountById = (id: number | string | null) => accounts.value.find((a) => a.id === Number(id)) ?? null

    return { load, ready, error, accountOptions, bankOptions, detailOptions, bankDetailOptions, accountById }
}