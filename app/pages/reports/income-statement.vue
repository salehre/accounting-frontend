<script setup lang="ts">
import type { IncomeStatement } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('reports.incomeStatement.name')) })

const ys = useReportYears()
const from = ref('')
const to = ref('')
const level = ref('2')

const report = ref<IncomeStatement | null>(null)
const shownQuery = ref<Record<string, unknown> | null>(null)
const running = ref(false)
const error = ref<string | null>(null)
const fieldErrs = ref<Record<string, string>>({})
let seq = 0

const levelOptions = computed(() => [1, 2, 3].map((n) => ({ value: String(n), label: t(`reports.trialBalance.level${n}`) })))

async function run() {
  error.value = null
  fieldErrs.value = {}
  if (!ys.yearId.value) { fieldErrs.value.fiscalYearId = ys.requiredMessage(); return }
  if (from.value && to.value && from.value > to.value) { fieldErrs.value.to = t('reports.fromAfterTo'); return }
  const query: Record<string, unknown> = { fiscalYearId: ys.yearId.value, level: level.value }
  if (from.value) query.from = from.value
  if (to.value) query.to = to.value

  const my = ++seq
  running.value = true
  try {
    const data = await api.get<IncomeStatement>('/reports/income-statement', query)
    if (my === seq) { report.value = data; shownQuery.value = query }
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
    await ys.load()
    if (ys.yearId.value) await run()
  } catch (e) {
    error.value = errorText.of(e)
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-4">
    <div>
      <NuxtLink to="/reports" class="text-sm text-indigo-600 hover:underline">{{ $t('menu.reports') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('reports.incomeStatement.name') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('reports.incomeStatement.desc') }}</p>
    </div>

    <form class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" novalidate @submit.prevent="run">
      <div class="grid gap-4 md:grid-cols-2">
        <AppSelect v-model="ys.yearId.value" :label="$t('reports.year')" :options="ys.options.value" :error="fieldErrs.fiscalYearId" />
        <AppSelect v-model="level" :label="$t('reports.trialBalance.level')" :options="levelOptions" />
        <DateInput v-model="from" :label="$t('reports.from')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.from" />
        <DateInput v-model="to" :label="$t('reports.to')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.to" />
      </div>
      <div class="flex justify-end"><AppButton :loading="running" :disabled="ys.loading.value" @click="run">{{ $t('reports.show') }}</AppButton></div>
    </form>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <template v-if="report">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-600">{{ report.fiscalYear.title }} — {{ $t('reports.period', { from: fmt.date(report.from), to: fmt.date(report.to) }) }}</p>
        <ExportButton path="/reports/income-statement/export" :query="shownQuery" />
      </div>
      <UnclassifiedWarning :warnings="report.warnings" />

      <div class="space-y-4" :class="running ? 'opacity-60' : ''">
        <StatementSection :title="$t('reports.incomeStatement.revenue')" :section="report.revenue" :total-label="$t('reports.incomeStatement.totalRevenue')" />
        <StatementSection :title="$t('reports.incomeStatement.expenses')" :section="report.expenses" :total-label="$t('reports.incomeStatement.totalExpenses')" />

        <div class="flex items-center justify-between rounded-xl border-2 px-5 py-4"
             :class="report.netProfit >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'">
          <span class="font-semibold">{{ report.netProfit >= 0 ? $t('reports.incomeStatement.profit') : $t('reports.incomeStatement.loss') }}</span>
          <span class="text-lg font-bold tabular-nums" dir="ltr">{{ fmt.money(Math.abs(report.netProfit)) }}</span>
        </div>
      </div>
      <p class="text-xs text-slate-500">{{ $t('reports.incomeStatement.note') }}</p>
    </template>
  </div>
</template>