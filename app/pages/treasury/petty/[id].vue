<script setup lang="ts">
import type { PettyExpense, PettyExpenseList, PettyFundDetail, PettySettlement } from '~/types/treasury'

type Modal = 'fund' | 'return' | 'expense' | 'settle' | 'cancelSettlement' | 'close' | 'ceiling' | null

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
const fmt = useFormat()

const id = computed(() => Number(route.params.id))
const fund = ref<PettyFundDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
useHead({ title: computed(() => fund.value?.name ?? t('treasury.petty.title')) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)
const active = computed(() => fund.value?.status === 'active')
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// ---- expenses list
const tab = ref<'expenses' | 'settlements' | 'movements'>('expenses')
const expStatus = ref('open')
const expenses = ref<PettyExpense[]>([])
const selected = ref<number[]>([])
const statusOptions = computed(() => [
  { value: 'open', label: t('treasury.petty.expenseStatus.open') },
  { value: 'settled', label: t('treasury.petty.expenseStatus.settled') },
  { value: 'cancelled', label: t('treasury.petty.expenseStatus.cancelled') },
  { value: '', label: t('treasury.filters.all') },
])

async function loadFund() {
  fund.value = await api.get<PettyFundDetail>(`/petty-funds/${id.value}`)
}
async function loadExpenses() {
  const r = await api.get<PettyExpenseList>(`/petty-funds/${id.value}/expenses`, { status: expStatus.value || undefined, pageSize: 200 })
  expenses.value = r.items
  selected.value = selected.value.filter((x) => r.items.some((e) => e.id === x && e.status === 'open'))
}
async function load() {
  loading.value = true
  error.value = null
  try {
    await Promise.all([loadFund(), loadExpenses()])
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
async function reload() {
  try { await Promise.all([loadFund(), loadExpenses()]) } catch (e) { notify.error(errorText.of(e)) }
}
onMounted(() => { void load(); void lookups.load() })
watch(expStatus, () => { void loadExpenses().catch((e) => notify.error(errorText.of(e))) })

const openRows = computed(() => expenses.value.filter((e) => e.status === 'open'))
const allSelected = computed(() => openRows.value.length > 0 && openRows.value.every((e) => selected.value.includes(e.id)))
const toggleAll = () => { selected.value = allSelected.value ? [] : openRows.value.map((e) => e.id) }
const settleTotal = computed(() => selected.value.length
    ? expenses.value.filter((e) => selected.value.includes(e.id)).reduce((s, e) => s + e.amount, 0)
    : (fund.value?.openExpenses ?? 0))

// ---- one modal at a time
const modal = ref<Modal>(null)
const isOpen = computed({ get: () => modal.value !== null, set: (v: boolean) => { if (!v) modal.value = null } })
const busy = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const date = ref(todayIso())
const amount = ref<number | null>(null)
const sourceId = ref<number | string | null>(null)
const sourceDetailId = ref<number | string | null>(null)
const note = ref('')
const expAccountId = ref<number | string | null>(null)
const expDetailId = ref<number | string | null>(null)
const description = ref('')
const receiptNo = ref('')
const reason = ref('')
const ceiling = ref<number | null>(null)
const target = ref<PettySettlement | null>(null)

function start(m: Exclude<Modal, null>, s?: PettySettlement) {
  date.value = todayIso()
  amount.value = null
  note.value = ''
  description.value = ''
  receiptNo.value = ''
  reason.value = ''
  expAccountId.value = null
  expDetailId.value = null
  ceiling.value = fund.value?.ceiling ?? null
  target.value = s ?? null
  formError.value = null
  errs.value = {}
  modal.value = m
}

const titleKey = computed(() => ({ fund: 'fundTitle', return: 'returnTitle', expense: 'expenseTitle', settle: 'settleTitle', cancelSettlement: 'cancelSettlementTitle', close: 'closeTitle', ceiling: 'ceilingTitle' }[modal.value ?? 'fund']))

const canSubmit = computed(() => {
  switch (modal.value) {
    case 'fund': case 'return': return !!amount.value && sourceId.value !== null && date.value !== ''
    case 'expense': return !!amount.value && expAccountId.value !== null && description.value.trim() !== '' && date.value !== ''
    case 'settle': return sourceId.value !== null && date.value !== '' && settleTotal.value > 0
    case 'cancelSettlement': return reason.value.trim().length >= 5
    case 'ceiling': return !!ceiling.value
    default: return true
  }
})

async function submit() {
  if (!canSubmit.value || !fund.value) return
  busy.value = true
  formError.value = null
  errs.value = {}
  const base = `/petty-funds/${id.value}`
  const source = { sourceAccountId: Number(sourceId.value), sourceDetailId: sourceDetailId.value === null ? null : Number(sourceDetailId.value) }
  try {
    switch (modal.value) {
      case 'fund':
      case 'return':
        await api.post(`${base}/${modal.value}`, { date: date.value, amount: amount.value, note: note.value.trim() || null, ...source })
        notify.success(t(`treasury.petty.toast.${modal.value}`))
        break
      case 'expense':
        await api.post(`${base}/expenses`, {
          date: date.value, amount: amount.value, accountId: Number(expAccountId.value),
          detailId: expDetailId.value === null ? null : Number(expDetailId.value),
          description: description.value.trim(), receiptNo: receiptNo.value.trim() || null,
        })
        notify.success(t('treasury.petty.toast.expense'))
        break
      case 'settle':
        await api.post(`${base}/settle`, { date: date.value, expenseIds: selected.value.length ? selected.value : null, ...source })
        selected.value = []
        notify.success(t('treasury.petty.toast.settle'))
        tab.value = 'settlements'
        break
      case 'cancelSettlement':
        await api.post(`/petty-settlements/${target.value!.id}/cancel`, { reason: reason.value.trim(), date: date.value })
        notify.success(t('treasury.petty.toast.settleCancelled'))
        break
      case 'close':
        await api.post(`${base}/close`)
        notify.success(t('treasury.petty.toast.closed'))
        break
      case 'ceiling':
        await api.patch(base, { ceiling: ceiling.value })
        notify.success(t('treasury.petty.toast.ceiling'))
        break
    }
    modal.value = null
    await reload()
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['date', 'amount', 'sourceAccountId', 'sourceDetailId', 'accountId', 'detailId', 'description', 'reason', 'ceiling', 'expenseIds']) {
        const m = err.field(f)
        if (m) errs.value[f] = errorText.text(m)
      }
      if (!Object.keys(errs.value).length) formError.value = errorText.of(e)
    } else {
      formError.value = errorText.of(e)
      if (err.status === 409) { notify.error(formError.value); modal.value = null; await reload() }
    }
  } finally {
    busy.value = false
  }
}

async function cancelExpense(x: PettyExpense) {
  try {
    await api.post(`/petty-expenses/${x.id}/cancel`)
    notify.success(t('treasury.petty.toast.expenseCancelled'))
  } catch (e) {
    notify.error(errorText.of(e))
  }
  await reload()
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <NuxtLink to="/treasury/petty" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.petty.title') }}</NuxtLink>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="fund">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
            <span>{{ fund.name }}</span>
            <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'">{{ $t(`treasury.petty.status.${fund.status}`) }}</span>
          </h1>
          <p class="mt-1 text-sm text-slate-600">{{ fund.custodianName ?? $t('treasury.petty.noCustodian') }} · {{ fund.fundAccount }}</p>
        </div>
        <div v-if="canManage && active" class="flex flex-wrap gap-2">
          <AppButton @click="start('fund')">{{ $t('treasury.petty.fund') }}</AppButton>
          <AppButton variant="secondary" @click="start('return')">{{ $t('treasury.petty.giveBack') }}</AppButton>
          <AppButton variant="secondary" @click="start('ceiling')">{{ $t('treasury.petty.changeCeiling') }}</AppButton>
          <AppButton variant="secondary" @click="start('close')">{{ $t('treasury.petty.close') }}</AppButton>
        </div>
      </div>

      <section class="grid gap-3 sm:grid-cols-4">
        <div v-for="c in [
          { k: 'onHand', v: fund.onHand, strong: true },
          { k: 'funded', v: fund.funded, strong: false },
          { k: 'openExpenses', v: fund.openExpenses, strong: false },
          { k: 'ceiling', v: fund.ceiling, strong: false },
        ]" :key="c.k" class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs text-slate-500">{{ $t(`treasury.petty.${c.k}`) }}</div>
          <div class="mt-1 tabular-nums" :class="c.strong ? 'text-xl font-bold text-slate-900' : 'text-lg font-semibold text-slate-800'">{{ fmt.money(c.v) }}</div>
        </div>
      </section>

      <div class="flex flex-wrap gap-2 border-b border-slate-200" role="tablist">
        <button v-for="k in (['expenses', 'settlements', 'movements'] as const)" :key="k" type="button" role="tab" :aria-selected="tab === k"
                class="-mb-px border-b-2 px-4 py-2 text-sm font-medium" :class="tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
                @click="tab = k">{{ $t(`treasury.petty.tabs.${k}`) }}</button>
      </div>

      <!-- expenses -->
      <section v-if="tab === 'expenses'" class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="w-44"><AppSelect v-model="expStatus" :label="$t('treasury.filters.status')" :options="statusOptions" /></div>
          <div v-if="canManage && active" class="flex flex-wrap gap-2">
            <AppButton variant="secondary" @click="start('expense')"><AppIcon name="plus" />{{ $t('treasury.petty.addExpense') }}</AppButton>
            <AppButton :disabled="fund.openExpenses === 0" @click="start('settle')">{{ selected.length ? $t('treasury.petty.settleSelected', { n: selected.length }) : $t('treasury.petty.settle') }}</AppButton>
          </div>
        </div>
        <p v-if="!expenses.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{{ $t('treasury.petty.noExpenses') }}</p>
        <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table class="w-full min-w-160 text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="w-10 px-3 py-2.5"><input v-if="canManage && active && openRows.length" type="checkbox" :checked="allSelected" :aria-label="$t('treasury.petty.selectAll')" @change="toggleAll"></th>
              <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.cols.date') }}</th>
              <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.petty.expenseFor') }}</th>
              <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.petty.receiptNo') }}</th>
              <th class="px-3 py-2.5 text-end font-medium">{{ $t('treasury.cols.amount') }}</th>
              <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.cols.status') }}</th>
              <th class="w-12 px-3 py-2.5" />
            </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
            <tr v-for="x in expenses" :key="x.id" :class="x.status === 'cancelled' ? 'text-slate-400' : ''">
              <td class="px-3 py-2.5"><input v-if="canManage && active && x.status === 'open'" v-model="selected" type="checkbox" :value="x.id" :aria-label="x.description"></td>
              <td class="px-3 py-2.5" dir="auto">{{ fmt.date(x.date) }}</td>
              <td class="px-3 py-2.5">
                <div>{{ x.description }}</div>
                <div class="text-xs text-slate-500">{{ x.accountCode }} {{ x.accountName }}<span v-if="x.detailName"> · {{ x.detailName }}</span></div>
              </td>
              <td class="px-3 py-2.5" dir="ltr">{{ x.receiptNo }}</td>
              <td class="px-3 py-2.5 text-end tabular-nums" :class="x.status === 'cancelled' ? 'line-through' : ''">{{ fmt.money(x.amount) }}</td>
              <td class="px-3 py-2.5">{{ $t(`treasury.petty.expenseStatus.${x.status}`) }}</td>
              <td class="px-3 py-2.5 text-end">
                <button v-if="canManage && active && x.status === 'open'" type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                        :aria-label="$t('treasury.petty.cancelExpense')" :title="$t('treasury.petty.cancelExpense')" @click="cancelExpense(x)"><AppIcon name="trash" /></button>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- settlements -->
      <section v-else-if="tab === 'settlements'" class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <p v-if="!fund.settlements.length" class="p-8 text-center text-sm text-slate-500">{{ $t('treasury.petty.noSettlements') }}</p>
        <table v-else class="w-full min-w-140 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.petty.settlementNo') }}</th>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.cols.date') }}</th>
            <th class="px-3 py-2.5 text-end font-medium">{{ $t('treasury.cols.amount') }}</th>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.entry') }}</th>
            <th class="px-3 py-2.5 text-start font-medium">{{ $t('treasury.cols.status') }}</th>
            <th class="px-3 py-2.5" />
          </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
          <tr v-for="s in fund.settlements" :key="s.id" :class="s.status === 'cancelled' ? 'text-slate-400' : ''">
            <td class="px-3 py-2.5">{{ fmt.money(s.number) }}</td>
            <td class="px-3 py-2.5" dir="auto">{{ fmt.date(s.date) }}</td>
            <td class="px-3 py-2.5 text-end tabular-nums" :class="s.status === 'cancelled' ? 'line-through' : ''">{{ fmt.money(s.total) }}</td>
            <td class="px-3 py-2.5">
              <NuxtLink v-if="session.can('entries.read')" :to="`/entries/${s.entryId}`" class="text-indigo-700 hover:underline">{{ $t('treasury.entryNo', { n: fmt.money(s.entryNumber) }) }}</NuxtLink>
              <span v-else>{{ $t('treasury.entryNo', { n: fmt.money(s.entryNumber) }) }}</span>
            </td>
            <td class="px-3 py-2.5">
              {{ $t(`treasury.vouchers.status.${s.status}`) }}
              <div v-if="s.cancelReason" class="text-xs text-slate-500">{{ s.cancelReason }}</div>
            </td>
            <td class="px-3 py-2.5 text-end">
              <AppButton v-if="canManage && active && s.status === 'posted'" variant="secondary" @click="start('cancelSettlement', s)">{{ $t('treasury.petty.cancelSettlement') }}</AppButton>
            </td>
          </tr>
          </tbody>
        </table>
      </section>

      <!-- movements -->
      <section v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <p v-if="!fund.movements.length" class="p-8 text-center text-sm text-slate-500">{{ $t('treasury.petty.noMovements') }}</p>
        <table v-else class="w-full min-w-130 text-sm">
          <tbody class="divide-y divide-slate-100">
          <tr v-for="m in fund.movements" :key="m.id">
            <td class="px-3 py-2.5" dir="auto">{{ fmt.date(m.date) }}</td>
            <td class="px-3 py-2.5">{{ $t(`treasury.petty.movement.${m.kind}`) }}<span v-if="m.note" class="text-slate-500"> · {{ m.note }}</span></td>
            <td class="px-3 py-2.5 text-end tabular-nums" :class="m.kind === 'fund' ? 'text-emerald-700' : 'text-amber-700'">{{ m.kind === 'fund' ? '+' : '−' }}{{ fmt.money(m.amount) }}</td>
            <td class="px-3 py-2.5">
              <NuxtLink v-if="session.can('entries.read')" :to="`/entries/${m.entryId}`" class="text-indigo-700 hover:underline">{{ $t('treasury.entryNo', { n: fmt.money(m.entryNumber) }) }}</NuxtLink>
            </td>
          </tr>
          </tbody>
        </table>
      </section>
    </template>

    <AppModal v-model:open="isOpen" :title="$t(`treasury.petty.${titleKey}`)">
      <div class="space-y-4">
        <AppAlert v-if="formError">{{ formError }}</AppAlert>

        <template v-if="modal === 'fund' || modal === 'return'">
          <p class="text-sm text-slate-600">{{ modal === 'fund' ? $t('treasury.petty.fundHint', { room: fmt.money(fund?.room ?? 0) }) : $t('treasury.petty.returnHint', { cash: fmt.money(fund?.onHand ?? 0) }) }}</p>
          <DateInput v-model="date" :label="$t('treasury.vouchers.cols.date')" :error="errs.date" />
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.cols.amount') }}</label>
            <MoneyInput v-model="amount" :invalid="!!errs.amount" :aria-label="$t('treasury.cols.amount')" />
            <p v-if="errs.amount" class="mt-1 text-xs text-red-600">{{ errs.amount }}</p>
          </div>
        </template>

        <template v-if="modal === 'expense'">
          <p class="text-sm text-slate-600">{{ $t('treasury.petty.expenseHint', { cash: fmt.money(fund?.onHand ?? 0) }) }}</p>
          <DateInput v-model="date" :label="$t('treasury.vouchers.cols.date')" :error="errs.date" />
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.cols.amount') }}</label>
            <MoneyInput v-model="amount" :invalid="!!errs.amount" :aria-label="$t('treasury.cols.amount')" />
            <p v-if="errs.amount" class="mt-1 text-xs text-red-600">{{ errs.amount }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.petty.expenseAccount') }}</label>
            <ComboBox v-model="expAccountId" :options="lookups.accountOptions.value" :invalid="!!errs.accountId"
                      :aria-label="$t('treasury.petty.expenseAccount')" :placeholder="$t('entries.form.searchAccount')" />
            <p v-if="errs.accountId" class="mt-1 text-xs text-red-600">{{ errs.accountId }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.partyDetail') }}</label>
            <ComboBox v-model="expDetailId" :options="lookups.detailOptions.value" :invalid="!!errs.detailId"
                      :aria-label="$t('treasury.form.partyDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
            <p v-if="errs.detailId" class="mt-1 text-xs text-red-600">{{ errs.detailId }}</p>
          </div>
          <AppInput v-model="description" :label="$t('treasury.petty.expenseFor')" :error="errs.description" />
          <AppInput v-model="receiptNo" :label="$t('treasury.petty.receiptNo')" />
        </template>

        <template v-if="modal === 'settle'">
          <p class="text-sm text-slate-600">{{ $t('treasury.petty.settleHint', { total: fmt.money(settleTotal) }) }}</p>
          <p v-if="errs.expenseIds" class="text-sm text-red-600">{{ errs.expenseIds }}</p>
          <DateInput v-model="date" :label="$t('treasury.vouchers.cols.date')" :error="errs.date" />
        </template>

        <template v-if="modal === 'cancelSettlement'">
          <p class="text-sm text-slate-600">{{ $t('treasury.petty.cancelSettlementHint') }}</p>
          <AppInput v-model="reason" :label="$t('treasury.vouchers.cancelReason')" :error="errs.reason" :hint="$t('treasury.vouchers.cancelReasonHint')" />
          <DateInput v-model="date" :label="$t('treasury.vouchers.cancelDate')" :error="errs.date" />
        </template>

        <template v-if="modal === 'close'">
          <p class="text-sm text-slate-600">{{ $t('treasury.petty.closeHint') }}</p>
        </template>

        <template v-if="modal === 'ceiling'">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.petty.ceiling') }}</label>
            <MoneyInput v-model="ceiling" :invalid="!!errs.ceiling" :aria-label="$t('treasury.petty.ceiling')" />
            <p v-if="errs.ceiling" class="mt-1 text-xs text-red-600">{{ errs.ceiling }}</p>
          </div>
        </template>

        <!-- where the money comes from or goes to -->
        <template v-if="modal === 'fund' || modal === 'return' || modal === 'settle'">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ modal === 'return' ? $t('treasury.petty.toAccount') : $t('treasury.petty.fromAccount') }}</label>
            <ComboBox v-model="sourceId" :options="lookups.bankOptions.value" :invalid="!!errs.sourceAccountId"
                      :aria-label="$t('treasury.petty.fromAccount')" :placeholder="$t('treasury.vouchers.form.accountPlaceholder')" />
            <p v-if="errs.sourceAccountId" class="mt-1 text-xs text-red-600">{{ errs.sourceAccountId }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.partyDetail') }}</label>
            <ComboBox v-model="sourceDetailId" :options="lookups.bankDetailOptions.value" :invalid="!!errs.sourceDetailId"
                      :aria-label="$t('treasury.form.partyDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
            <p v-if="errs.sourceDetailId" class="mt-1 text-xs text-red-600">{{ errs.sourceDetailId }}</p>
          </div>
        </template>
        <AppInput v-if="modal === 'fund' || modal === 'return'" v-model="note" :label="$t('treasury.petty.note')" />
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="modal = null">{{ $t('common.cancel') }}</AppButton>
        <AppButton :variant="modal === 'close' || modal === 'cancelSettlement' ? 'danger' : 'primary'" :loading="busy" :disabled="!canSubmit" @click="submit">{{ $t('treasury.petty.confirm') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>