<script setup lang="ts">
import type { ChequeAction, ChequeDetail } from '~/types/treasury'
import ChequeStatus from "~/components/treasury/ChequeStatus.vue";
import {useTreasuryLookups} from "~/composables/useTreasuryLookups.ts";

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
const lookups = useTreasuryLookups()

const id = computed(() => Number(route.params.id))
const cheque = ref<ChequeDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
useHead({ title: computed(() => (cheque.value ? `${t('treasury.chequeNo')} ${cheque.value.number}` : t('treasury.title'))) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

async function load() {
  loading.value = true
  error.value = null
  try {
    cheque.value = await api.get<ChequeDetail>(`/cheques/${id.value}`)
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => { void load(); void lookups.load() })

// ---- one action at a time, in a dialog
const action = ref<ChequeAction | null>(null)
const open = computed({ get: () => action.value !== null, set: (v: boolean) => { if (!v) action.value = null } })
const date = ref(todayIso())
const note = ref('')
const bankAccountId = ref<number | string | null>(null)
const bankDetailId = ref<number | string | null>(null)
const accountId = ref<number | string | null>(null)
const detailId = ref<number | string | null>(null)
const busy = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

function start(a: ChequeAction) {
  action.value = a
  date.value = todayIso()
  note.value = ''
  bankAccountId.value = cheque.value?.bankAccountId ?? null
  bankDetailId.value = cheque.value?.bankDetailId ?? null
  accountId.value = null
  detailId.value = null
  formError.value = null
  errs.value = {}
}

const needsBank = computed(() => action.value === 'deposit')
const needsTarget = computed(() => action.value === 'endorse')
const canSend = computed(() => date.value !== '' && (!needsBank.value || bankAccountId.value !== null) && (!needsTarget.value || accountId.value !== null))

async function send() {
  if (!action.value || !canSend.value) return
  busy.value = true
  formError.value = null
  errs.value = {}
  try {
    cheque.value = await api.post<ChequeDetail>(`/cheques/${id.value}/${action.value}`, {
      date: date.value,
      note: note.value.trim() || null,
      bankAccountId: needsBank.value ? Number(bankAccountId.value) : undefined,
      bankDetailId: needsBank.value && bankDetailId.value !== null ? Number(bankDetailId.value) : undefined,
      accountId: needsTarget.value ? Number(accountId.value) : undefined,
      detailId: needsTarget.value && detailId.value !== null ? Number(detailId.value) : undefined,
    })
    notify.success(t(`treasury.toast.${action.value}`, { number: cheque.value.number }))
    action.value = null
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['date', 'bankAccountId', 'bankDetailId', 'accountId', 'detailId']) {
        const m = err.field(f)
        if (m) errs.value[f] = errorText.text(m)
      }
      const other = Object.keys(err.errors).filter((k) => !(k in errs.value))
      if (other.length || !Object.keys(errs.value).length) formError.value = errorText.text(err.field(other[0] ?? '') ?? err.message)
    } else {
      formError.value = errorText.of(e)
      // somebody else may have changed the cheque: show the truth behind the message
      if (err.status === 409) { action.value = null; notify.error(formError.value); await load() }
    }
  } finally {
    busy.value = false
  }
}

const danger = (a: ChequeAction) => a === 'cancel' || a === 'return' || a === 'bounce'
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <NuxtLink to="/treasury" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.title') }}</NuxtLink>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="cheque">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
            <span>{{ $t('treasury.chequeNo') }} <span dir="ltr">{{ cheque.number }}</span></span>
            <ChequeStatus :status="cheque.status" :overdue="cheque.overdue" />
          </h1>
          <p class="mt-1 text-sm text-slate-600">{{ $t(`treasury.direction.${cheque.direction}`) }} · {{ cheque.bankName }}<template v-if="cheque.branch"> · {{ cheque.branch }}</template></p>
        </div>
        <div v-if="canManage && cheque.actions.length" class="flex flex-wrap gap-2">
          <AppButton v-for="a in cheque.actions" :key="a" :variant="danger(a) ? 'secondary' : 'primary'" @click="start(a)">{{ $t(`treasury.action.${a}`) }}</AppButton>
        </div>
      </div>

      <section class="grid gap-x-8 gap-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div><div class="text-xs text-slate-500">{{ $t('treasury.cols.amount') }}</div><div class="text-lg font-bold tabular-nums">{{ fmt.money(cheque.amount) }} <span class="text-sm font-normal text-slate-500">{{ $t('common.rial') }}</span></div></div>
        <div><div class="text-xs text-slate-500">{{ $t('treasury.cols.dueDate') }}</div><div dir="auto">{{ fmt.date(cheque.dueDate) }}</div></div>
        <div><div class="text-xs text-slate-500">{{ $t('treasury.form.issueDate') }}</div><div dir="auto">{{ fmt.date(cheque.issueDate) }}</div></div>
        <div v-if="cheque.sayadId"><div class="text-xs text-slate-500">{{ $t('treasury.form.sayadId') }}</div><div dir="ltr" class="text-start tabular-nums">{{ cheque.sayadId }}</div></div>
        <div><div class="text-xs text-slate-500">{{ cheque.direction === 'issued' ? $t('treasury.form.payeeAccount') : $t('treasury.form.payerAccount') }}</div>
          <div>{{ cheque.counterpartyAccount }}<span v-if="cheque.counterpartyDetailName" class="text-slate-500"> · {{ cheque.counterpartyDetailName }}</span></div></div>
        <div v-if="cheque.bankAccount"><div class="text-xs text-slate-500">{{ $t('treasury.form.bankAccount') }}</div><div>{{ cheque.bankAccount }}</div></div>
        <div v-if="cheque.description" class="sm:col-span-2"><div class="text-xs text-slate-500">{{ $t('treasury.form.description') }}</div><div>{{ cheque.description }}</div></div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="mb-3 text-base font-semibold text-slate-900">{{ $t('treasury.history') }}</h2>
        <ol class="space-y-3">
          <li v-for="e in cheque.events" :key="e.id" class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div>
              <div class="font-medium text-slate-800">{{ $t(`treasury.action.${e.action}`) }} <span class="text-slate-400">→</span> <ChequeStatus :status="e.toStatus" /></div>
              <div v-if="e.note" class="mt-0.5 text-xs text-slate-500">{{ e.note }}</div>
              <div v-if="e.by" class="mt-0.5 text-xs text-slate-400">{{ e.by }}</div>
            </div>
            <div class="text-end text-xs text-slate-500">
              <div dir="auto">{{ fmt.date(e.date) }}</div>
              <NuxtLink v-if="e.entryId && session.can('entries.read')" :to="`/entries/${e.entryId}`" class="text-indigo-700 hover:underline">{{ $t('treasury.entryNo', { n: fmt.money(e.entryNumber) }) }}</NuxtLink>
            </div>
          </li>
        </ol>
      </section>
    </template>

    <AppModal v-model:open="open" :title="action ? $t(`treasury.action.${action}`) : ''">
      <div class="space-y-4">
        <p v-if="action" class="text-sm text-slate-600">{{ $t(`treasury.actionHint.${action}`) }}</p>
        <AppAlert v-if="formError">{{ formError }}</AppAlert>
        <DateInput v-model="date" :label="$t('treasury.form.eventDate')" :error="errs.date" />

        <template v-if="needsBank">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.depositAccount') }}</label>
            <ComboBox v-model="bankAccountId" :options="lookups.bankOptions.value" :invalid="!!errs.bankAccountId"
                      :aria-label="$t('treasury.form.depositAccount')" :placeholder="$t('entries.form.searchAccount')" />
            <p v-if="errs.bankAccountId" class="mt-1 text-xs text-red-600">{{ errs.bankAccountId }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.bankDetail') }}</label>
            <ComboBox v-model="bankDetailId" :options="lookups.bankDetailOptions.value" :invalid="!!errs.bankDetailId"
                      :aria-label="$t('treasury.form.bankDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
            <p v-if="errs.bankDetailId" class="mt-1 text-xs text-red-600">{{ errs.bankDetailId }}</p>
          </div>
        </template>

        <template v-if="needsTarget">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.targetAccount') }}</label>
            <ComboBox v-model="accountId" :options="lookups.accountOptions.value" :invalid="!!errs.accountId"
                      :aria-label="$t('treasury.form.targetAccount')" :placeholder="$t('entries.form.searchAccount')" />
            <p v-if="errs.accountId" class="mt-1 text-xs text-red-600">{{ errs.accountId }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.partyDetail') }}</label>
            <ComboBox v-model="detailId" :options="lookups.detailOptions.value" :invalid="!!errs.detailId"
                      :aria-label="$t('treasury.form.partyDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
            <p v-if="errs.detailId" class="mt-1 text-xs text-red-600">{{ errs.detailId }}</p>
          </div>
        </template>

        <AppInput v-model="note" :label="$t('treasury.form.note')" />
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :variant="action && danger(action) ? 'danger' : 'primary'" :loading="busy" :disabled="!canSend" @click="send">{{ $t('treasury.confirm') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>