<script setup lang="ts">
import type { FiscalYear, TrialBalance } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('reports.trialBalance.name')) })

const years = ref<FiscalYear[]>([])
const yearId = ref('')
const from = ref('')
const to = ref('')
const level = ref('3')
const withDetails = ref(false)
const hideZero = ref(true)
const includeClosing = ref(false)

const report = ref<TrialBalance | null>(null)
const loadingYears = ref(true)
const running = ref(false)
const error = ref<string | null>(null)
const fieldErrs = ref<Record<string, string>>({})
let seq = 0

const yearOptions = computed(() => years.value.map((y) => ({ value: String(y.id), label: `${y.title}  (${fmt.date(y.startDate)} – ${fmt.date(y.endDate)})` })))
const levelOptions = computed(() => [1, 2, 3].map((n) => ({ value: String(n), label: t(`reports.trialBalance.level${n}`) })))
const detailsShown = computed(() => report.value?.rows.some((r) => 'detailId' in r) ?? false)

// detail accounts exist only at level 3
watch(level, (v) => { if (v !== '3') withDetails.value = false })

async function run() {
  error.value = null
  fieldErrs.value = {}
  if (!yearId.value) { fieldErrs.value.fiscalYearId = t('reports.yearRequired'); return }
  if (from.value && to.value && from.value > to.value) { fieldErrs.value.to = t('reports.fromAfterTo'); return }

  const my = ++seq
  running.value = true
  try {
    const query: Record<string, unknown> = {
      fiscalYearId: yearId.value,
      level: level.value,
      hideZero: hideZero.value ? 1 : 0,
      includeClosing: includeClosing.value ? 1 : 0,
      withDetails: withDetails.value ? 1 : 0,
    }
    if (from.value) query.from = from.value
    if (to.value) query.to = to.value
    const data = await api.get<TrialBalance>('/reports/trial-balance', query)
    if (my === seq) report.value = data
  } catch (e) {
    if (my !== seq) return
    const err = toApiError(e)
    if (err.status === 422 && Object.keys(err.errors).length) {
      for (const [k, msgs] of Object.entries(err.errors)) fieldErrs.value[k] = errorText.text(msgs[0] ?? '')
    } else {
      error.value = errorText.of(e)
    }
  } finally {
    if (my === seq) running.value = false
  }
}

onMounted(async () => {
  try {
    years.value = (await api.get<FiscalYear[]>('/fiscal-years')).map((y) => ({ ...y, id: Number(y.id) }))
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const current = years.value.find((y) => today >= y.startDate && today <= y.endDate) ?? years.value[years.value.length - 1]
    if (current) { yearId.value = String(current.id); await run() }
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loadingYears.value = false
  }
})

/** zero is shown as a dash: a trial balance is easier to read that way */
const cell = (n: number) => (n ? fmt.money(n) : '—')
const columns = ['opening', 'period', 'closing'] as const
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-4">
    <div>
      <NuxtLink to="/reports" class="text-sm text-indigo-600 hover:underline">{{ $t('menu.reports') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('reports.trialBalance.name') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('reports.trialBalance.desc') }}</p>
    </div>

    <form class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" novalidate @submit.prevent="run">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AppSelect v-model="yearId" :label="$t('reports.year')" :options="yearOptions" :error="fieldErrs.fiscalYearId" />
        <DateInput v-model="from" :label="$t('reports.from')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.from" />
        <DateInput v-model="to" :label="$t('reports.to')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.to" />
        <AppSelect v-model="level" :label="$t('reports.trialBalance.level')" :options="levelOptions" />
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
        <label class="flex items-center gap-2" :class="level !== '3' ? 'opacity-50' : ''">
          <input v-model="withDetails" type="checkbox" :disabled="level !== '3'" class="size-4 rounded border-slate-300">
          {{ $t('reports.trialBalance.withDetails') }}
        </label>
        <label class="flex items-center gap-2"><input v-model="hideZero" type="checkbox" class="size-4 rounded border-slate-300">{{ $t('reports.hideZero') }}</label>
        <label class="flex items-center gap-2"><input v-model="includeClosing" type="checkbox" class="size-4 rounded border-slate-300">{{ $t('reports.includeClosing') }}</label>
        <AppButton class="ms-auto" :loading="running" :disabled="loadingYears" @click="run">{{ $t('reports.show') }}</AppButton>
      </div>
      <p v-if="fieldErrs.withDetails" class="text-xs text-red-600">{{ fieldErrs.withDetails }}</p>
    </form>

    <AppAlert v-if="error">{{ error }}</AppAlert>
    <p v-if="loadingYears" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-if="report">
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {{ report.fiscalYear.title }} — {{ $t('reports.period', { from: fmt.date(report.from), to: fmt.date(report.to) }) }}
          <span class="text-slate-400">· {{ $t('reports.rowsCount', { n: fmt.money(report.rows.length) }) }}</span>
        </span>
        <span v-if="report.balanced === true" class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{{ $t('reports.trialBalance.balanced') }}</span>
        <span v-else-if="report.balanced === false" class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">{{ $t('reports.trialBalance.notBalanced') }}</span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white" :class="running ? 'opacity-60' : ''">
        <table class="w-full min-w-240 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th rowspan="2" class="px-3 py-2.5 text-start font-medium">{{ $t('reports.code') }}</th>
            <th rowspan="2" class="px-3 py-2.5 text-start font-medium">{{ $t('reports.name') }}</th>
            <th v-if="detailsShown" rowspan="2" class="px-3 py-2.5 text-start font-medium">{{ $t('reports.trialBalance.detail') }}</th>
            <th v-for="c in columns" :key="c" colspan="2" class="border-s border-slate-200 px-3 py-2 text-center font-medium">{{ $t(`reports.trialBalance.${c}`) }}</th>
          </tr>
          <tr>
            <template v-for="c in columns" :key="c">
              <th class="border-s border-slate-200 px-3 py-2 text-end font-medium">{{ $t('reports.debit') }}</th>
              <th class="px-3 py-2 text-end font-medium">{{ $t('reports.credit') }}</th>
            </template>
          </tr>
          </thead>
          <tbody>
          <tr v-if="report.rows.length === 0"><td colspan="9" class="px-3 py-10 text-center text-slate-500">{{ $t('reports.empty') }}</td></tr>
          <tr v-for="(r, i) in report.rows" :key="`${r.accountId}-${r.detailId ?? 0}-${i}`" class="border-t border-slate-100 hover:bg-slate-50/60">
            <td class="whitespace-nowrap px-3 py-2 text-slate-500" dir="ltr">{{ r.code }}</td>
            <td class="px-3 py-2">{{ r.name }}</td>
            <td v-if="detailsShown" class="px-3 py-2 text-slate-600">
              <template v-if="r.detailName"><span class="text-slate-400" dir="ltr">{{ r.detailCode }}</span> {{ r.detailName }}</template>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="border-s border-slate-100 px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.openingDebit) }}</td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.openingCredit) }}</td>
            <td class="border-s border-slate-100 px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.periodDebit) }}</td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.periodCredit) }}</td>
            <td class="border-s border-slate-100 px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.closingDebit) }}</td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.closingCredit) }}</td>
          </tr>
          </tbody>
          <tfoot v-if="report.rows.length" class="border-t-2 border-slate-300 bg-slate-50 font-semibold">
          <tr>
            <td :colspan="detailsShown ? 3 : 2" class="px-3 py-2.5">{{ $t('reports.totals') }}</td>
            <td class="border-s border-slate-200 px-3 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(report.totals.openingDebit) }}</td>
            <td class="px-3 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(report.totals.openingCredit) }}</td>
            <td class="border-s border-slate-200 px-3 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(report.totals.periodDebit) }}</td>
            <td class="px-3 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(report.totals.periodCredit) }}</td>
            <td class="border-s border-slate-200 px-3 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(report.totals.closingDebit) }}</td>
            <td class="px-3 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(report.totals.closingCredit) }}</td>
          </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>