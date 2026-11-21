<script setup lang="ts">
import type { Account, ComboOption, Ledger, LedgerItem } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const route = useRoute()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('reports.ledger.name')) })

const ys = useReportYears()
const accounts = ref<Account[]>([])
const accountId = ref<number | string | null>(null)
const detailId = ref<number | null>(null)
const from = ref('')
const to = ref('')
const includeClosing = ref(false)

const report = ref<Ledger | null>(null)
const items = ref<LedgerItem[]>([])
const nextCursor = ref<string | null>(null)
const running = ref(false)
const moreLoading = ref(false)
const error = ref<string | null>(null)
const fieldErrs = ref<Record<string, string>>({})
let seq = 0
let lastQuery: Record<string, unknown> = {}
const shownQuery = ref<Record<string, unknown> | null>(null)

const accountOptions = computed<ComboOption[]>(() => accounts.value.map((a) => ({ value: a.id, label: a.name, sub: a.code })))

async function run() {
  error.value = null
  fieldErrs.value = {}
  if (!ys.yearId.value) { fieldErrs.value.fiscalYearId = ys.requiredMessage(); return }
  if (accountId.value === null) { fieldErrs.value.accountId = t('reports.ledger.accountRequired'); return }
  if (from.value && to.value && from.value > to.value) { fieldErrs.value.to = t('reports.fromAfterTo'); return }

  const query: Record<string, unknown> = {
    fiscalYearId: ys.yearId.value,
    accountId: accountId.value,
    includeClosing: includeClosing.value ? 1 : 0,
    pageSize: 50,
  }
  if (detailId.value !== null) query.detailId = detailId.value
  if (from.value) query.from = from.value
  if (to.value) query.to = to.value

  const my = ++seq
  running.value = true
  try {
    const data = await api.get<Ledger>('/reports/ledger', query)
    if (my !== seq) return
    lastQuery = query
    const { pageSize: _p, ...exportable } = query
    shownQuery.value = exportable
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
    // the next page is asked with the filters of the report on the screen, not the edited ones
    const data = await api.get<Ledger>('/reports/ledger', { ...lastQuery, cursor: nextCursor.value })
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
    accounts.value = (await api.get<Account[]>('/accounts')).map((a) => ({ ...a, id: Number(a.id) }))
    // opened from elsewhere with ?account=ID: show it at once
    const preset = Number(route.query.account)
    if (preset && accounts.value.some((a) => a.id === preset)) { accountId.value = preset; await run() }
  } catch (e) {
    error.value = errorText.of(e)
  }
})

/** a running balance: positive = debit side, negative = credit side */
function bal(n: number): string { return n === 0 ? '—' : fmt.money(Math.abs(n)) }
function side(n: number): string { return n === 0 ? '' : n > 0 ? t('reports.ledger.dr') : t('reports.ledger.cr') }
const cell = (n: number) => (n ? fmt.money(n) : '—')
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-4">
    <div>
      <span class="text-sm text-slate-500">{{ $t('menu.reports') }}</span>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('reports.ledger.name') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('reports.ledger.desc') }}</p>
    </div>

    <form class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" novalidate @submit.prevent="run">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AppSelect v-model="ys.yearId.value" :label="$t('reports.year')" :options="ys.options.value" :error="fieldErrs.fiscalYearId" />
        <div class="md:col-span-2">
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('reports.ledger.account') }}</label>
          <ComboBox v-model="accountId" :options="accountOptions" :invalid="!!fieldErrs.accountId" :aria-label="$t('reports.ledger.account')" :placeholder="$t('entries.form.searchAccount')" />
          <p v-if="fieldErrs.accountId" class="mt-1 text-xs text-red-600">{{ fieldErrs.accountId }}</p>
          <p v-else class="mt-1 text-xs text-slate-500">{{ $t('reports.ledger.accountHint') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('reports.ledger.detail') }}</label>
          <DetailPicker v-model="detailId" :aria-label="$t('reports.ledger.detail')" :placeholder="$t('entries.form.optional')" />
          <p v-if="fieldErrs.detailId" class="mt-1 text-xs text-red-600">{{ fieldErrs.detailId }}</p>
        </div>
        <DateInput v-model="from" :label="$t('reports.from')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.from" />
        <DateInput v-model="to" :label="$t('reports.to')" :hint="$t('reports.emptyMeansYear')" :error="fieldErrs.to" />
      </div>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-700">
        <label class="flex items-center gap-2"><input v-model="includeClosing" type="checkbox" class="size-4 rounded border-slate-300">{{ $t('reports.includeClosing') }}</label>
        <AppButton class="ms-auto" :loading="running" :disabled="ys.loading.value" @click="run">{{ $t('reports.show') }}</AppButton>
      </div>
    </form>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <template v-if="report">
      <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div class="flex flex-wrap items-center justify-between gap-3 sm:col-span-4 text-slate-600">
          <span>
          <b class="text-slate-900">{{ report.account.name }}</b> <span dir="ltr" class="text-slate-400">{{ report.account.code }}</span>
          — {{ report.fiscalYear.title }} — {{ $t('reports.period', { from: fmt.date(report.from), to: fmt.date(report.to) }) }}</span>
          <ExportButton path="/reports/ledger/export" :query="shownQuery" />
        </div>
        <div><div class="text-xs text-slate-500">{{ $t('reports.ledger.opening') }}</div><b dir="ltr">{{ bal(report.openingBalance) }}</b> <span class="text-xs text-slate-500">{{ side(report.openingBalance) }}</span></div>
        <div><div class="text-xs text-slate-500">{{ $t('reports.debit') }}</div><b dir="ltr">{{ fmt.money(report.totals.periodDebit) }}</b></div>
        <div><div class="text-xs text-slate-500">{{ $t('reports.credit') }}</div><b dir="ltr">{{ fmt.money(report.totals.periodCredit) }}</b></div>
        <div><div class="text-xs text-slate-500">{{ $t('reports.ledger.closing') }}</div><b dir="ltr">{{ bal(report.totals.closingBalance) }}</b> <span class="text-xs text-slate-500">{{ side(report.totals.closingBalance) }}</span></div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white" :class="running ? 'opacity-60' : ''">
        <table class="w-full min-w-225 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('entries.date') }}</th>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('entries.number') }}</th>
            <th v-if="report.account.level < 3" class="px-3 py-2.5 text-start font-medium">{{ $t('reports.name') }}</th>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('entries.description') }}</th>
            <th class="px-3 py-2.5 text-end font-medium">{{ $t('reports.debit') }}</th>
            <th class="px-3 py-2.5 text-end font-medium">{{ $t('reports.credit') }}</th>
            <th class="px-3 py-2.5 text-end font-medium">{{ $t('reports.ledger.balance') }}</th>
          </tr>
          </thead>
          <tbody>
          <tr class="bg-slate-50/60 text-slate-600">
            <td :colspan="report.account.level < 3 ? 6 : 5" class="px-3 py-2">{{ $t('reports.ledger.opening') }}</td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ bal(report.openingBalance) }} <span class="text-xs">{{ side(report.openingBalance) }}</span></td>
          </tr>
          <tr v-if="items.length === 0"><td colspan="7" class="px-3 py-10 text-center text-slate-500">{{ $t('reports.empty') }}</td></tr>
          <tr v-for="r in items" :key="r.lineId" class="border-t border-slate-100 hover:bg-slate-50/60">
            <td class="whitespace-nowrap px-3 py-2" dir="ltr">{{ fmt.date(r.date) }}</td>
            <td class="px-3 py-2"><NuxtLink :to="`/entries/${r.entryId}`" class="text-indigo-600 hover:underline">{{ fmt.money(r.number) }}</NuxtLink></td>
            <td v-if="report.account.level < 3" class="px-3 py-2 text-slate-600"><span class="text-slate-400" dir="ltr">{{ r.accountCode }}</span> {{ r.accountName }}</td>
            <td class="px-3 py-2">
              {{ r.lineDescription || r.entryDescription }}
              <span v-if="r.detailName" class="ms-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{{ r.detailName }}</span>
            </td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.debit) }}</td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ cell(r.credit) }}</td>
            <td class="px-3 py-2 text-end tabular-nums" dir="ltr">{{ bal(r.balance) }} <span class="text-xs text-slate-500">{{ side(r.balance) }}</span></td>
          </tr>
          </tbody>
        </table>
        <div v-if="nextCursor" class="border-t border-slate-100 p-3 text-center">
          <AppButton variant="secondary" :loading="moreLoading" @click="more">{{ $t('reports.loadMore') }}</AppButton>
        </div>
      </div>
      <p class="text-xs text-slate-500">{{ $t('reports.ledger.note') }}</p>
    </template>
  </div>
</template>