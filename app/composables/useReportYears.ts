import type { FiscalYear } from '~/types/api'

/** The fiscal years for the filter of a report, with the current one preselected. */
export function useReportYears() {
    const { t } = useI18n()
    const api = useApi()
    const fmt = useFormat()

    const years = ref<FiscalYear[]>([])
    const yearId = ref('')
    const loading = ref(true)

    const options = computed(() => years.value.map((y) => ({
        value: String(y.id),
        label: `${y.title}  (${fmt.date(y.startDate)} – ${fmt.date(y.endDate)})`,
    })))

    /** Loads the years and selects the current one. Throws the API error when loading fails. */
    async function load() {
        try {
            years.value = (await api.get<FiscalYear[]>('/fiscal-years')).map((y) => ({ ...y, id: Number(y.id) }))
            const d = new Date()
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const current = years.value.find((y) => today >= y.startDate && today <= y.endDate) ?? years.value[years.value.length - 1]
            if (current) yearId.value = String(current.id)
        } finally {
            loading.value = false
        }
    }

    return { years, yearId, options, loading, load, requiredMessage: () => t('reports.yearRequired') }
}