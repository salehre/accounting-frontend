<script setup lang="ts">
import type { BalanceSheet } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('reports.balanceSheet.name')) })

const ys = useReportYears()
const date = ref('')
const level = ref('2')

const report = ref<BalanceSheet | null>(null)
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
  const query: Record<string, unknown> = { fiscalYearId: ys.yearId.value, level: level.value }
  if (date.value) query.date = date.value

  const my = ++seq
  running.value = true
  try {
    const data = await api.get<BalanceSheet>('/reports/balance-sheet', query)
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
  <div class="mx-auto max-w-6xl space-y-4">
    <div>
      <span class="text-sm text-slate-500">{{ $t('menu.reports') }}</span>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('reports.balanceSheet.name') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('reports.balanceSheet.desc') }}</p>
    </div>

    <form class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" novalidate @submit.prevent="run">
      <div class="grid gap-4 md:grid-cols-3">
        <AppSelect v-model="ys.yearId.value" :label="$t('reports.year')" :options="ys.options.value" :error="fieldErrs.fiscalYearId" />
        <DateInput v-model="date" :label="$t('reports.balanceSheet.asOf')" :hint="$t('reports.balanceSheet.dateHint')" :error="fieldErrs.date" />
        <AppSelect v-model="level" :label="$t('reports.trialBalance.level')" :options="levelOptions" />
      </div>
      <div class="flex justify-end"><AppButton :loading="running" :disabled="ys.loading.value" @click="run">{{ $t('reports.show') }}</AppButton></div>
    </form>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <template v-if="report">
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{{ report.fiscalYear.title }} — {{ $t('reports.balanceSheet.onDate', { date: fmt.date(report.date) }) }}</span>
        <ExportButton path="/reports/balance-sheet/export" :query="shownQuery" />
        <span v-if="report.balanced" class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{{ $t('reports.balanceSheet.balanced') }}</span>
        <span v-else class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          {{ $t('reports.balanceSheet.notBalanced') }}: <span dir="ltr">{{ fmt.money(Math.abs(report.difference)) }}</span>
        </span>
      </div>
      <UnclassifiedWarning :warnings="report.warnings" />

      <div class="grid gap-4 lg:grid-cols-2" :class="running ? 'opacity-60' : ''">
        <div>
          <StatementSection :title="$t('reports.balanceSheet.assets')" :section="report.assets" :total-label="$t('reports.balanceSheet.totalAssets')" />
        </div>
        <div class="space-y-4">
          <StatementSection :title="$t('reports.balanceSheet.liabilities')" :section="report.liabilities" :total-label="$t('reports.balanceSheet.totalLiabilities')" />
          <StatementSection :title="$t('reports.balanceSheet.equity')" :section="report.equity" :total-label="$t('reports.balanceSheet.totalEquity')" />
          <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span>{{ $t('reports.balanceSheet.result') }}</span>
            <span class="tabular-nums" dir="ltr">{{ fmt.money(report.currentPeriodResult) }}</span>
          </div>
          <div class="flex items-center justify-between rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 font-semibold">
            <span>{{ $t('reports.balanceSheet.totalLiabEquity') }}</span>
            <span class="tabular-nums" dir="ltr">{{ fmt.money(report.liabilitiesAndEquity) }}</span>
          </div>
        </div>
      </div>
      <p class="text-xs text-slate-500">{{ $t('reports.balanceSheet.note') }}</p>
    </template>
  </div>
</template>