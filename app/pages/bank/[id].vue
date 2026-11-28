<script setup lang="ts">
import type { BankBookLine, BankStatement, BankStatementLine } from '~/types/bank'

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()

const id = computed(() => Number(route.params.id))
const statement = ref<BankStatement | null>(null)
const bookLines = ref<BankBookLine[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showAll = ref(false)
useHead({ title: computed(() => statement.value?.title ?? t('menu.bank')) })

const editable = computed(() => statement.value?.status === 'open' && session.can('bank.manage') && !session.readOnly)

// what is selected: one line of the statement, and some lines of the books
const lineId = ref<number | null>(null)
const picked = ref<number[]>([])
const busy = ref(false)

async function loadBook() {
  bookLines.value = await api.get<BankBookLine[]>(`/bank-statements/${id.value}/book-lines`, showAll.value ? undefined : { onlyOpen: 1 })
}
async function load() {
  loading.value = true
  error.value = null
  try {
    statement.value = await api.get<BankStatement>(`/bank-statements/${id.value}`)
    await loadBook()
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(showAll, () => { picked.value = []; void loadBook().catch((e) => notify.error(errorText.of(e))) })

const selectedLine = computed<BankStatementLine | null>(() => statement.value?.lines.find((l) => l.id === lineId.value) ?? null)
const pickedSum = computed(() => bookLines.value.filter((b) => picked.value.includes(b.id)).reduce((s, b) => s + b.amount, 0))
const canMatch = computed(() => editable.value && !!selectedLine.value && !selectedLine.value.matched && picked.value.length > 0 && pickedSum.value === selectedLine.value.amount)
const canClear = computed(() => editable.value && picked.value.length > 0 && bookLines.value.filter((b) => picked.value.includes(b.id)).every((b) => b.state === 'open'))
const canUnclear = computed(() => editable.value && picked.value.length > 0 && bookLines.value.filter((b) => picked.value.includes(b.id)).every((b) => b.state === 'cleared'))

function selectLine(l: BankStatementLine) {
  if (!editable.value) return
  lineId.value = lineId.value === l.id ? null : l.id
}
function togglePick(b: BankBookLine) {
  if (!editable.value || b.state === 'matched') return
  picked.value = picked.value.includes(b.id) ? picked.value.filter((x) => x !== b.id) : [...picked.value, b.id]
}
const suggests = (b: BankBookLine) => !!selectedLine.value && !selectedLine.value.matched && b.state === 'open' && b.amount === selectedLine.value.amount

/** Runs one change, takes the new statement from the answer and refreshes the books. */
async function run<T extends { lines?: unknown } | { statement: BankStatement }>(job: () => Promise<T>, ok?: (r: T) => string): Promise<boolean> {
  busy.value = true
  try {
    const r = await job()
    statement.value = 'statement' in r ? r.statement : (r as unknown as BankStatement)
    await loadBook()
    picked.value = picked.value.filter((p) => bookLines.value.some((b) => b.id === p && b.state !== 'matched'))
    if (ok) notify.success(ok(r))
    return true
  } catch (e) {
    notify.error(errorText.of(e))
    // somebody else may have changed it: show the truth
    try { statement.value = await api.get<BankStatement>(`/bank-statements/${id.value}`); await loadBook() } catch { /* the message above is enough */ }
    return false
  } finally {
    busy.value = false
  }
}

async function match() {
  if (!canMatch.value || !selectedLine.value) return
  const done = await run(() => api.post<BankStatement>(`/bank-statements/${id.value}/match`, { statementLineId: selectedLine.value!.id, journalLineIds: picked.value }))
  if (done) { picked.value = []; lineId.value = nextOpenLine() }
}
function nextOpenLine(): number | null {
  return statement.value?.lines.find((l) => !l.matched)?.id ?? null
}
const unmatch = (l: BankStatementLine) => run(() => api.post<BankStatement>(`/bank-statements/${id.value}/unmatch`, { statementLineId: l.id }))
async function clear() {
  if (await run(() => api.post<BankStatement>(`/bank-statements/${id.value}/clear`, { journalLineIds: picked.value }))) picked.value = []
}
async function unclear() {
  if (await run(() => api.post<BankStatement>(`/bank-statements/${id.value}/unclear`, { journalLineIds: picked.value }))) picked.value = []
}
function autoMatch() {
  return run(() => api.post<{ matched: number; remaining: number; statement: BankStatement }>(`/bank-statements/${id.value}/auto-match`),
      (r) => t('bank.toast.auto', { matched: fmt.money(r.matched), remaining: fmt.money(r.remaining) }))
}

// ---- finishing, reopening, deleting
const confirmFinish = ref(false)
const confirmDelete = ref(false)
const confirmReopen = ref(false)

async function finish() {
  const done = await run(() => api.post<BankStatement>(`/bank-statements/${id.value}/finish`), () => t('bank.toast.finished'))
  confirmFinish.value = false
  if (done) { lineId.value = null; picked.value = [] }
}
async function reopen() {
  await run(() => api.post<BankStatement>(`/bank-statements/${id.value}/reopen`), () => t('bank.toast.reopened'))
  confirmReopen.value = false
}
async function remove() {
  busy.value = true
  try {
    await api.del(`/bank-statements/${id.value}`)
    notify.success(t('bank.toast.deleted', { title: statement.value?.title ?? '' }))
    await navigateTo('/bank')
  } catch (e) {
    notify.error(errorText.of(e))
    confirmDelete.value = false
  } finally {
    busy.value = false
  }
}

const canFinish = computed(() => editable.value && !!statement.value && statement.value.summary.openLineCount === 0 && statement.value.summary.difference === 0)
const sign = (n: number) => (n > 0 ? 'text-emerald-700' : 'text-rose-700')
const stateClass = { open: 'bg-amber-100 text-amber-800', matched: 'bg-emerald-100 text-emerald-800', cleared: 'bg-slate-200 text-slate-700' } as const
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <NuxtLink to="/bank" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('menu.bank') }}</NuxtLink>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="statement">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
            {{ statement.title }}
            <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="statement.status === 'reconciled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">{{ $t(`bank.status.${statement.status}`) }}</span>
          </h1>
          <p class="mt-1 text-sm text-slate-600" dir="auto">{{ fmt.date(statement.dateFrom) }} – {{ fmt.date(statement.dateTo) }}</p>
        </div>
        <div v-if="session.can('bank.manage') && !session.readOnly" class="flex flex-wrap justify-end gap-2">
          <template v-if="statement.status === 'open'">
            <AppButton variant="secondary" :loading="busy" @click="autoMatch">{{ $t('bank.auto') }}</AppButton>
            <AppButton :disabled="!canFinish || busy" @click="confirmFinish = true">{{ $t('bank.finish') }}</AppButton>
            <AppButton variant="danger" :disabled="busy" @click="confirmDelete = true">{{ $t('common.delete') }}</AppButton>
          </template>
          <AppButton v-else variant="secondary" :disabled="busy" @click="confirmReopen = true">{{ $t('bank.reopen') }}</AppButton>
        </div>
      </div>

      <StatementSummary :summary="statement.summary" />

      <p v-if="editable" class="text-sm text-slate-600">{{ $t('bank.howTo') }}</p>

      <!-- what is selected -->
      <div v-if="editable" class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-indigo-900">
          <span>{{ $t('bank.sel.line') }}: <b class="tabular-nums" dir="ltr">{{ selectedLine ? fmt.money(selectedLine.amount) : '—' }}</b></span>
          <span>{{ $t('bank.sel.picked') }}: <b class="tabular-nums" dir="ltr">{{ fmt.money(pickedSum) }}</b> ({{ fmt.money(picked.length) }})</span>
          <span v-if="selectedLine && picked.length">{{ $t('bank.sel.gap') }}: <b class="tabular-nums" dir="ltr" :class="pickedSum === selectedLine.amount ? 'text-emerald-700' : 'text-rose-700'">{{ fmt.money(selectedLine.amount - pickedSum) }}</b></span>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <AppButton :disabled="!canMatch || busy" @click="match">{{ $t('bank.match') }}</AppButton>
          <AppButton variant="secondary" :disabled="!canClear || busy" @click="clear">{{ $t('bank.clear') }}</AppButton>
          <AppButton v-if="canUnclear" variant="secondary" :disabled="busy" @click="unclear">{{ $t('bank.unclear') }}</AppButton>
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <!-- the bank -->
        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 class="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">{{ $t('bank.bankSide') }}</h2>
          <div class="max-h-[60vh] overflow-auto">
            <table class="w-full min-w-105 text-sm">
              <tbody class="divide-y divide-slate-100">
              <tr v-for="l in statement.lines" :key="l.id"
                  :class="[l.matched ? 'bg-emerald-50/50 text-slate-500' : '', lineId === l.id ? 'bg-indigo-100' : '', editable && !l.matched ? 'cursor-pointer hover:bg-indigo-50' : '']"
                  @click="!l.matched && selectLine(l)">
                <td class="w-24 px-3 py-2 align-top text-xs text-slate-500" dir="ltr">{{ fmt.date(l.date) }}</td>
                <td class="px-3 py-2">
                  <div>{{ l.description }}</div>
                  <div v-if="l.reference" class="text-xs text-slate-400" dir="ltr">{{ l.reference }}</div>
                </td>
                <td class="px-3 py-2 text-end align-top font-medium tabular-nums" :class="l.matched ? '' : sign(l.amount)" dir="ltr">{{ fmt.money(l.amount) }}</td>
                <td class="w-20 px-3 py-2 text-end align-top">
                  <template v-if="l.matched">
                    <AppIcon name="check" class="inline text-emerald-600" />
                    <button v-if="editable" type="button" class="ms-1 text-xs text-slate-500 underline hover:text-red-600" :disabled="busy" @click.stop="unmatch(l)">{{ $t('bank.undo') }}</button>
                  </template>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- our books -->
        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 class="text-sm font-semibold text-slate-800">{{ $t('bank.bookSide') }}</h2>
            <label class="inline-flex items-center gap-2 text-xs text-slate-600"><input v-model="showAll" type="checkbox" class="accent-indigo-600">{{ $t('bank.showAll') }}</label>
          </div>
          <p v-if="!bookLines.length" class="px-4 py-8 text-center text-sm text-slate-500">{{ $t('bank.noBookLines') }}</p>
          <div v-else class="max-h-[60vh] overflow-auto">
            <table class="w-full min-w-115 text-sm">
              <tbody class="divide-y divide-slate-100">
              <tr v-for="b in bookLines" :key="b.id"
                  :class="[picked.includes(b.id) ? 'bg-indigo-100' : suggests(b) ? 'bg-amber-50' : '', b.state === 'matched' ? 'text-slate-400' : '', editable && b.state !== 'matched' ? 'cursor-pointer hover:bg-indigo-50' : '']"
                  @click="togglePick(b)">
                <td class="w-8 px-3 py-2 align-top">
                  <input type="checkbox" class="accent-indigo-600" :checked="picked.includes(b.id)" :disabled="!editable || b.state === 'matched'" :aria-label="$t('bank.pick')" @click.stop="togglePick(b)">
                </td>
                <td class="w-24 px-3 py-2 align-top text-xs text-slate-500" dir="ltr">{{ fmt.date(b.date) }}</td>
                <td class="px-3 py-2">
                  <div>
                    <NuxtLink :to="`/entries/${b.entryId}`" class="text-indigo-700 hover:underline" @click.stop>{{ $t('bank.entryNo', { n: fmt.money(b.entryNumber) }) }}</NuxtLink>
                    <span v-if="b.detailName" class="text-slate-500"> · {{ b.detailName }}</span>
                  </div>
                  <div class="text-xs text-slate-500">{{ b.lineDescription || b.entryDescription }}</div>
                </td>
                <td class="px-3 py-2 text-end align-top font-medium tabular-nums" :class="b.state === 'matched' ? '' : sign(b.amount)" dir="ltr">{{ fmt.money(b.amount) }}</td>
                <td v-if="showAll" class="px-3 py-2 align-top"><span class="rounded-full px-2 py-0.5 text-xs" :class="stateClass[b.state]">{{ $t(`bank.state.${b.state}`) }}</span></td>
              </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>

    <ConfirmDialog v-model:open="confirmFinish" :title="$t('bank.confirm.finishTitle')" :message="$t('bank.confirm.finishMessage')" :confirm-label="$t('bank.finish')" :loading="busy" @confirm="finish" />
    <ConfirmDialog v-model:open="confirmReopen" :title="$t('bank.confirm.reopenTitle')" :message="$t('bank.confirm.reopenMessage')" :confirm-label="$t('bank.reopen')" :loading="busy" @confirm="reopen" />
    <ConfirmDialog v-model:open="confirmDelete" :title="$t('bank.confirm.deleteTitle', { title: statement?.title ?? '' })" :message="$t('bank.confirm.deleteMessage')" :confirm-label="$t('common.delete')" :loading="busy" @confirm="remove" />
  </div>
</template>