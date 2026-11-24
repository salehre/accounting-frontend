<script setup lang="ts">
import type { ChequeDetail, ChequeDirection } from '~/types/treasury'
import {useTreasuryLookups} from "~/composables/useTreasuryLookups.ts";

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
useHead({ title: computed(() => t('treasury.newTitle')) })

onMounted(() => { void lookups.load() })

const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

const direction = ref<ChequeDirection>('received')
const number = ref('')
const sayadId = ref('')
const bankName = ref('')
const branch = ref('')
const amount = ref<number | null>(null)
const issueDate = ref(todayIso())
const dueDate = ref('')
const date = ref(todayIso())
const counterpartyAccountId = ref<number | string | null>(null)
const counterpartyDetailId = ref<number | string | null>(null)
const bankAccountId = ref<number | string | null>(null)
const bankDetailId = ref<number | string | null>(null)
const description = ref('')

const issued = computed(() => direction.value === 'issued')
const directionOptions = computed(() => [
  { value: 'received', label: t('treasury.direction.received') },
  { value: 'issued', label: t('treasury.direction.issued') },
])
const dir = computed({ get: () => direction.value as string, set: (v: string) => { direction.value = v as ChequeDirection } })

const saving = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const FIELDS = ['number', 'sayadId', 'bankName', 'amount', 'issueDate', 'dueDate', 'date', 'counterpartyAccountId', 'counterpartyDetailId', 'bankAccountId', 'bankDetailId']

const canSubmit = computed(() => number.value.trim() !== '' && bankName.value.trim() !== '' && !!amount.value && issueDate.value !== ''
    && dueDate.value !== '' && date.value !== '' && counterpartyAccountId.value !== null && (!issued.value || bankAccountId.value !== null))

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  formError.value = null
  errs.value = {}
  try {
    const cheque = await api.post<ChequeDetail>('/cheques', {
      direction: direction.value,
      number: number.value.trim(),
      sayadId: sayadId.value.trim() || null,
      bankName: bankName.value.trim(),
      branch: branch.value.trim() || null,
      amount: amount.value,
      issueDate: issueDate.value,
      dueDate: dueDate.value,
      date: date.value,
      counterpartyAccountId: Number(counterpartyAccountId.value),
      counterpartyDetailId: counterpartyDetailId.value === null ? null : Number(counterpartyDetailId.value),
      bankAccountId: issued.value && bankAccountId.value !== null ? Number(bankAccountId.value) : null,
      bankDetailId: issued.value && bankDetailId.value !== null ? Number(bankDetailId.value) : null,
      description: description.value.trim() || null,
    })
    notify.success(t('treasury.toast.registered', { number: cheque.number }))
    await navigateTo(`/treasury/${cheque.id}`)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of FIELDS) {
        const m = err.field(f)
        if (m) errs.value[f] = errorText.text(m)
      }
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
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <NuxtLink to="/treasury" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.title') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('treasury.newTitle') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.newSubtitle') }}</p>
    </div>

    <AppAlert v-if="lookups.error.value">{{ lookups.error.value }}</AppAlert>
    <AppAlert v-if="formError">{{ formError }}</AppAlert>

    <form class="space-y-5 rounded-xl border border-slate-200 bg-white p-5" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <AppSelect v-model="dir" :label="$t('treasury.form.direction')" :options="directionOptions" />
        <AppInput v-model="number" ltr :label="$t('treasury.form.number')" :error="errs.number" />
        <AppInput v-model="bankName" :label="$t('treasury.form.bankName')" :error="errs.bankName" />
        <AppInput v-model="branch" :label="$t('treasury.form.branch')" />
        <AppInput v-model="sayadId" ltr :label="$t('treasury.form.sayadId')" :hint="$t('treasury.form.sayadHint')" :error="errs.sayadId" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.amount') }}</label>
          <MoneyInput v-model="amount" :invalid="!!errs.amount" :aria-label="$t('treasury.form.amount')" />
          <p v-if="errs.amount" class="mt-1 text-xs text-red-600">{{ errs.amount }}</p>
        </div>
        <DateInput v-model="issueDate" :label="$t('treasury.form.issueDate')" :error="errs.issueDate" />
        <DateInput v-model="dueDate" :label="$t('treasury.form.dueDate')" :error="errs.dueDate" />
      </div>

      <div class="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ issued ? $t('treasury.form.payeeAccount') : $t('treasury.form.payerAccount') }}</label>
          <ComboBox v-model="counterpartyAccountId" :options="lookups.accountOptions.value" :invalid="!!errs.counterpartyAccountId"
                    :aria-label="$t('treasury.form.payerAccount')" :placeholder="$t('entries.form.searchAccount')" />
          <p class="mt-1 text-xs" :class="errs.counterpartyAccountId ? 'text-red-600' : 'text-slate-500'">{{ errs.counterpartyAccountId ?? $t('treasury.form.partyHint') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.partyDetail') }}</label>
          <ComboBox v-model="counterpartyDetailId" :options="lookups.detailOptions.value" :invalid="!!errs.counterpartyDetailId"
                    :aria-label="$t('treasury.form.partyDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
          <p v-if="errs.counterpartyDetailId" class="mt-1 text-xs text-red-600">{{ errs.counterpartyDetailId }}</p>
        </div>

        <template v-if="issued">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.bankAccount') }}</label>
            <ComboBox v-model="bankAccountId" :options="lookups.bankOptions.value" :invalid="!!errs.bankAccountId"
                      :aria-label="$t('treasury.form.bankAccount')" :placeholder="$t('entries.form.searchAccount')" />
            <p class="mt-1 text-xs" :class="errs.bankAccountId ? 'text-red-600' : 'text-slate-500'">{{ errs.bankAccountId ?? $t('treasury.form.bankAccountHint') }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.bankDetail') }}</label>
            <ComboBox v-model="bankDetailId" :options="lookups.bankDetailOptions.value" :aria-label="$t('treasury.form.bankDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
          </div>
        </template>

        <DateInput v-model="date" :label="$t('treasury.form.entryDate')" :error="errs.date" :hint="$t('treasury.form.entryDateHint')" />
        <div class="sm:col-span-2"><AppInput v-model="description" :label="$t('treasury.form.description')" /></div>
      </div>

      <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <NuxtLink to="/treasury" class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{{ $t('common.cancel') }}</NuxtLink>
        <AppButton type="submit" :loading="saving" :disabled="!canSubmit">{{ $t('treasury.form.submit') }}</AppButton>
      </div>
    </form>
  </div>
</template>