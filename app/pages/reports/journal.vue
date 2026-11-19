<script setup lang="ts">
import type { Journal, JournalItem } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('reports.journal.name')) })

const ys = useReportYears()
const from = ref('')
const to = ref('')
const fromNumber = ref('')
const toNumber = ref('')

const report = ref<Journal | null>(null)
const items = ref<JournalItem[]>([])
const nextCursor = ref<string | null>(null)
const running = ref(false)
const moreLoading = ref(false)
const error = ref<string | null>(null)
const fieldErrs = ref<Record<string, string>>({})
let seq = 0
let lastQuery: Record<string, unknown> = {}

const balanced = computed(() => !!report.value && report.value.totals.debit === report.value.totals.credit)

function parseNumber(s: string): number | null | 'bad' {
  const v = normalizeDigits(s.trim())
  if (v === '') return null
  return /^[1-9]\d{0,9}$/.test(v) ? Number(v) : 'bad'
}

async function run() {
  error.value = null
  fieldErrs.value = {}
  if (!ys.yearId.value) { fieldErrs.value.fiscalYearId = ys.requiredMessage(); return }
  if (from.value && to.value && from.value > to.value) { fieldErrs.value.to = t('reports.fromAfterTo'); return }
  const fn = parseNumber(fromNumber.value)
  const tn = parseNumber(toNumber.value)
  if (fn === 'bad') { fieldErrs.value.fromNumber = t('reports.journal.numberBad'); return }
  if (tn === 'bad') { fieldErrs.value.toNumber = t('reports.journal.numberBad'); return }
  if (fn !== null && tn !== null && fn > tn) { fieldErrs.value.toNumber = t('serverMsg.numberOrder'); return }

  const query: Record<string, unknown> = { fiscalYearId: ys.yearId.value, pageSize: 20 }
  if (from.value) query.from = from.value
  if (to.value) query.to = to.value
  if (fn !== null) query.fromNumber = fn
  if (tn !== null) query.toNumber = tn

  const my = ++seq
  running.value = true
  try {
    const data = await api.get<Journal>('/reports/journal', query)
    if (my !== seq) return
    lastQuery = query
    report.value = data
    items.value = data.items
    nextCursor.value = data.nextCursor
  } catch (e) {
    if (my !== seq) return
    showError(e)
  } finally {
    if (my === seq) running.value = false
  }
}

async function more() {
  if (!nextCursor.value || moreLoading.value) return
  const my = seq
  moreLoading.value = true
  try {
    const data = await api.get<Journal>('/reports/journal', { ...lastQuery, cursor: nextCursor.value })
    if (my !== seq) return
    items.value = [...items.value, ...data.items]
    nextCursor.value = data.nextCursor
  } catch (e) {
    showError(e)
  } finally {
    moreLoading.value = false
  }
}

function showError(e: unknown) {
  const err = toApiError(e)
  if (err.status === 422 && Object.keys(err.errors).length) {
    for (const [k, msgs] of Object.entries(err.errors)) fieldErrs.value[k] = errorText.text(msgs[0] ?? '')
  } else {
    error.value = errorText.of(e)
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

const cell = (n: number) => (n ? fmt.money(n) : '—')
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div>
      <NuxtLink to="/reports" class="text-sm text-indigo-600 hover:underline">{{ $t('menu.reports') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('reports.journal.name') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('reports.journal.desc') }}</p>
    </div>

    <form class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" novalidate @submit.prevent="run">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="lg:col-span-3"><AppSelect v-model="ys.yearId.value" :label="$t('reports.year')" :options="ys.options.value" :error="fieldErrs.fiscalYearId" /></div>
        <DateInput v-model="from" :label="$t('reports.from')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.from" />
        <DateInput v-model="to" :label="$t('reports.to')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.to" />
        <span class="hidden lg:block" />
        <AppInput v-model="fromNumber" ltr :label="$t('reports.journal.fromNumber')" :error="fieldErrs.fromNumber" />
        <AppInput v-model="toNumber" ltr :label="$t('reports.journal.toNumber')" :error="fieldErrs.toNumber" />
        <div class="flex items-end justify-end"><AppButton :loading="running" :disabled="ys.loading.value" @click="run">{{ $t('reports.show') }}</AppButton></div>
      </div>
    </form>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <template v-if="report">
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{{ report.fiscalYear.title }} — {{ $t('reports.period', { from: fmt.date(report.from), to: fmt.date(report.to) }) }}</span>
        <span class="flex items-center gap-4">
          <span>{{ $t('reports.debit') }}: <b class="text-slate-900" dir="ltr">{{ fmt.money(report.totals.debit) }}</b></span>
          <span>{{ $t('reports.credit') }}: <b class="text-slate-900" dir="ltr">{{ fmt.money(report.totals.credit) }}</b></span>
          <span v-if="balanced" class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{{ $t('reports.trialBalance.balanced') }}</span>
          <span v-else class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">{{ $t('reports.trialBalance.notBalanced') }}</span>
        </span>
      </div>

      <p v-if="items.length === 0" class="rounded-xl border border-slate-200 bg-white px-3 py-10 text-center text-sm text-slate-500">{{ $t('reports.empty') }}</p>

      <div class="space-y-3" :class="running ? 'opacity-60' : ''">
        <article v-for="e in items" :key="e.id" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header class="flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-50 px-4 py-2.5 text-sm">
            <NuxtLink :to="`/entries/${e.id}`" class="font-semibold text-indigo-600 hover:underline">{{ $t('reports.journal.entryNo', { n: fmt.money(e.number) }) }}</NuxtLink>
            <span class="text-slate-600" dir="ltr">{{ fmt.date(e.date) }}</span>
            <span v-if="e.sourceType?.startsWith('year_end_')" class="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{{ $t('entries.yearEnd') }}</span>
            <span class="text-slate-700">{{ e.description }}</span>
          </header>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] text-sm">
              <tbody>
              <tr v-for="l in e.lines" :key="l.lineNo" class="border-t border-slate-100">
                <td class="w-10 px-3 py-1.5 text-slate-400">{{ fmt.money(l.lineNo) }}</td>
                <td class="whitespace-nowrap px-3 py-1.5"><span class="text-slate-400" dir="ltr">{{ l.accountCode }}</span> {{ l.accountName }}</td>
                <td class="px-3 py-1.5 text-slate-600">
                  <span v-if="l.detailName" class="me-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{{ l.detailName }}</span>{{ l.description }}
                </td>
                <td class="w-36 px-3 py-1.5 text-end tabular-nums" dir="ltr">{{ cell(l.debit) }}</td>
                <td class="w-36 px-3 py-1.5 text-end tabular-nums" dir="ltr">{{ cell(l.credit) }}</td>
              </tr>
              </tbody>
              <tfoot>
              <tr class="border-t border-slate-200 bg-slate-50/60 font-medium">
                <td colspan="3" class="px-3 py-1.5 text-slate-500">{{ $t('reports.totals') }}</td>
                <td class="px-3 py-1.5 text-end tabular-nums" dir="ltr">{{ fmt.money(e.totalDebit) }}</td>
                <td class="px-3 py-1.5 text-end tabular-nums" dir="ltr">{{ fmt.money(e.totalCredit) }}</td>
              </tr>
              </tfoot>
            </table>
          </div>
        </article>
      </div>

      <div v-if="nextCursor" class="text-center">
        <AppButton variant="secondary" :loading="moreLoading" @click="more">{{ $t('reports.loadMore') }}</AppButton>
      </div>
    </template>
  </div>
</template>