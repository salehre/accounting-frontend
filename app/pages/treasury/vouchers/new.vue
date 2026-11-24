<script setup lang="ts">
import type { PayMethod, VoucherDetail, VoucherKind } from '~/types/treasury'
import { PAY_METHODS } from '~/types/treasury'
import {useTreasuryLookups} from "~/composables/useTreasuryLookups.ts";

interface Row { key: number; method: string; accountId: number | string | null; detailId: number | string | null; amount: number | null; reference: string }

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
const fmt = useFormat()
useHead({ title: computed(() => t('treasury.vouchers.newTitle')) })

onMounted(() => { void lookups.load() })

const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

const kind = ref<VoucherKind>(route.query.kind === 'payment' ? 'payment' : 'receipt')
const date = ref(todayIso())
const partyAccountId = ref<number | string | null>(null)
const partyDetailId = ref<number | string | null>(null)
const description = ref('')

// One id for this form: a second click, or a retry after a lost answer, returns the first voucher instead of making another.
const requestId = ref('')
onMounted(() => { requestId.value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` })

let seq = 0
const newRow = (method = 'cash'): Row => ({ key: ++seq, method, accountId: null, detailId: null, amount: null, reference: '' })
const rows = ref<Row[]>([newRow()])

const kindOptions = computed(() => [
  { value: 'receipt', label: t('treasury.vouchers.kind.receipt') },
  { value: 'payment', label: t('treasury.vouchers.kind.payment') },
])
const kindModel = computed({ get: () => kind.value as string, set: (v: string) => { kind.value = v as VoucherKind } })
const methodOptions = computed(() => PAY_METHODS.map((m) => ({ value: m, label: t(`treasury.vouchers.method.${m}`) })))

const total = computed(() => rows.value.reduce((s, r) => s + (r.amount ?? 0), 0))
const addRow = () => { rows.value.push(newRow(rows.value.length ? 'bank' : 'cash')) }
const removeRow = (key: number) => { if (rows.value.length > 1) rows.value = rows.value.filter((r) => r.key !== key) }

const saving = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const canSubmit = computed(() => date.value !== '' && partyAccountId.value !== null && total.value > 0
    && rows.value.every((r) => r.accountId !== null && !!r.amount) && requestId.value !== '')

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  formError.value = null
  errs.value = {}
  try {
    const v = await api.post<VoucherDetail>('/treasury-vouchers', {
      kind: kind.value,
      date: date.value,
      partyAccountId: Number(partyAccountId.value),
      partyDetailId: partyDetailId.value === null ? null : Number(partyDetailId.value),
      description: description.value.trim() || null,
      requestId: requestId.value,
      lines: rows.value.map((r) => ({
        method: r.method as PayMethod,
        accountId: Number(r.accountId),
        detailId: r.detailId === null ? null : Number(r.detailId),
        amount: r.amount,
        reference: r.reference.trim() || null,
      })),
    })
    notify.success(t('treasury.vouchers.toast.created', { kind: t(`treasury.vouchers.kind.${v.kind}`), number: v.number }))
    await navigateTo(`/treasury/vouchers/${v.id}`)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['date', 'partyAccountId', 'partyDetailId', 'lines']) {
        const m = err.field(f)
        if (m) errs.value[f] = errorText.text(m)
      }
      // errors of one row: lines.0.accountId ...
      for (const [k, v] of Object.entries(err.errors)) if (k.startsWith('lines.') && v[0]) errs.value[k] = errorText.text(v[0])
      const other = Object.keys(err.errors).filter((k) => !(k in errs.value))
      if (other.length || !Object.keys(errs.value).length) formError.value = errorText.text(err.field(other[0] ?? '') ?? err.message)
    } else {
      formError.value = errorText.of(e)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <NuxtLink to="/treasury/vouchers" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.vouchers.title') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('treasury.vouchers.newTitle') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.vouchers.newSubtitle') }}</p>
    </div>

    <AppAlert v-if="lookups.error.value">{{ lookups.error.value }}</AppAlert>
    <AppAlert v-if="formError">{{ formError }}</AppAlert>

    <form class="space-y-6" @submit.prevent="submit">
      <section class="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <AppSelect v-model="kindModel" :label="$t('treasury.vouchers.form.kind')" :options="kindOptions" />
        <DateInput v-model="date" :label="$t('treasury.vouchers.form.date')" :error="errs.date" :hint="$t('treasury.form.entryDateHint')" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ kind === 'receipt' ? $t('treasury.vouchers.form.payer') : $t('treasury.vouchers.form.payee') }}</label>
          <ComboBox v-model="partyAccountId" :options="lookups.accountOptions.value" :invalid="!!errs.partyAccountId"
                    :aria-label="$t('treasury.vouchers.form.payer')" :placeholder="$t('entries.form.searchAccount')" />
          <p class="mt-1 text-xs" :class="errs.partyAccountId ? 'text-red-600' : 'text-slate-500'">{{ errs.partyAccountId ?? $t('treasury.form.partyHint') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.partyDetail') }}</label>
          <ComboBox v-model="partyDetailId" :options="lookups.detailOptions.value" :invalid="!!errs.partyDetailId"
                    :aria-label="$t('treasury.form.partyDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
          <p v-if="errs.partyDetailId" class="mt-1 text-xs text-red-600">{{ errs.partyDetailId }}</p>
        </div>
        <div class="sm:col-span-2"><AppInput v-model="description" :label="$t('treasury.form.description')" /></div>
      </section>

      <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="text-base font-semibold text-slate-900">{{ $t('treasury.vouchers.form.ways') }}</h2>
        <p v-if="errs.lines" class="text-sm text-red-600">{{ errs.lines }}</p>

        <div v-for="(r, i) in rows" :key="r.key" class="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-12">
          <div class="md:col-span-2"><AppSelect v-model="r.method" compact :options="methodOptions" :aria-label="$t('treasury.vouchers.form.method')" /></div>
          <div class="md:col-span-4">
            <ComboBox v-model="r.accountId" :options="lookups.bankOptions.value" :invalid="!!errs[`lines.${i}.accountId`]"
                      :aria-label="$t('treasury.vouchers.form.account')" :placeholder="$t('treasury.vouchers.form.accountPlaceholder')" />
            <p v-if="errs[`lines.${i}.accountId`]" class="mt-1 text-xs text-red-600">{{ errs[`lines.${i}.accountId`] }}</p>
          </div>
          <div class="md:col-span-3">
            <MoneyInput v-model="r.amount" :invalid="!!errs[`lines.${i}.amount`]" :aria-label="$t('treasury.vouchers.form.amount')" />
            <p v-if="errs[`lines.${i}.amount`]" class="mt-1 text-xs text-red-600">{{ errs[`lines.${i}.amount`] }}</p>
          </div>
          <div class="md:col-span-2">
            <input v-model="r.reference" dir="ltr" :aria-label="$t('treasury.vouchers.form.reference')" :placeholder="$t('treasury.vouchers.form.reference')"
                   class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
          </div>
          <div class="flex items-center justify-end md:col-span-1">
            <button type="button" class="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-30" :disabled="rows.length === 1"
                    :aria-label="$t('treasury.vouchers.form.removeRow')" @click="removeRow(r.key)"><AppIcon name="trash" /></button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <AppButton variant="secondary" @click="addRow"><AppIcon name="plus" />{{ $t('treasury.vouchers.form.addWay') }}</AppButton>
          <div class="text-sm text-slate-600">{{ $t('treasury.vouchers.form.total') }}: <span class="text-lg font-bold tabular-nums text-slate-900">{{ fmt.money(total) }}</span> {{ $t('common.rial') }}</div>
        </div>
      </section>

      <div class="flex justify-end gap-3">
        <NuxtLink to="/treasury/vouchers" class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{{ $t('common.cancel') }}</NuxtLink>
        <AppButton type="submit" :loading="saving" :disabled="!canSubmit">{{ $t('treasury.vouchers.form.submit') }}</AppButton>
      </div>
    </form>
  </div>
</template>