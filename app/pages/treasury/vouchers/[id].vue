<script setup lang="ts">
import type { VoucherDetail } from '~/types/treasury'

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()

const id = computed(() => Number(route.params.id))
const voucher = ref<VoucherDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
useHead({ title: computed(() => (voucher.value ? `${t(`treasury.vouchers.kind.${voucher.value.kind}`)} ${voucher.value.number}` : t('treasury.vouchers.title'))) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

async function load() {
  loading.value = true
  error.value = null
  try {
    voucher.value = await api.get<VoucherDetail>(`/treasury-vouchers/${id.value}`)
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---- cancelling
const open = ref(false)
const reason = ref('')
const date = ref(todayIso())
const busy = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

function startCancel() {
  reason.value = ''
  date.value = todayIso()
  formError.value = null
  errs.value = {}
  open.value = true
}
watch([reason, date], () => { errs.value = {} })

// the same rules as the server: nothing is sent until every one of them is met
function check(): boolean {
  const e: Record<string, string> = {}
  if (reason.value.trim().length < 5) e.reason = t('treasury.check.reasonShort')
  if (date.value === '') e.date = t('treasury.check.dateRequired')
  errs.value = e
  return Object.keys(e).length === 0
}

async function cancel() {
  formError.value = null
  if (!check()) return
  busy.value = true
  errs.value = {}
  try {
    voucher.value = await api.post<VoucherDetail>(`/treasury-vouchers/${id.value}/cancel`, { reason: reason.value.trim(), date: date.value })
    notify.success(t('treasury.vouchers.toast.cancelled', { number: voucher.value.number }))
    open.value = false
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['reason', 'date']) { const m = err.field(f); if (m) errs.value[f] = errorText.text(m) }
      if (!Object.keys(errs.value).length) formError.value = errorText.of(e)
    } else {
      formError.value = errorText.of(e)
      if (err.status === 409) { open.value = false; notify.error(formError.value); await load() }
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
    <NuxtLink to="/treasury/vouchers" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.vouchers.title') }}</NuxtLink>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="voucher">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
          <span>{{ $t(`treasury.vouchers.kind.${voucher.kind}`) }} {{ fmt.money(voucher.number) }}</span>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="voucher.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'">{{ $t(`treasury.vouchers.status.${voucher.status}`) }}</span>
        </h1>
        <AppButton v-if="canManage && voucher.status === 'posted'" variant="secondary" @click="startCancel">{{ $t('treasury.vouchers.cancel') }}</AppButton>
      </div>

      <AppAlert v-if="voucher.status === 'cancelled'">
        {{ $t('treasury.vouchers.cancelledNote', { reason: voucher.cancelReason ?? '' }) }}
        <NuxtLink v-if="voucher.reversalEntryId && session.can('entries.read')" :to="`/entries/${voucher.reversalEntryId}`" class="underline">{{ $t('treasury.entryNo', { n: fmt.money(voucher.reversalNumber) }) }}</NuxtLink>
      </AppAlert>

      <section class="grid gap-x-8 gap-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div><div class="text-xs text-slate-500">{{ $t('treasury.cols.amount') }}</div>
          <div class="text-lg font-bold tabular-nums" :class="voucher.status === 'cancelled' ? 'text-slate-400 line-through' : ''">{{ fmt.money(voucher.amount) }} <span class="text-sm font-normal text-slate-500">{{ $t('common.rial') }}</span></div></div>
        <div><div class="text-xs text-slate-500">{{ $t('treasury.vouchers.cols.date') }}</div><div dir="auto">{{ fmt.date(voucher.date) }}</div></div>
        <div><div class="text-xs text-slate-500">{{ voucher.kind === 'receipt' ? $t('treasury.vouchers.form.payer') : $t('treasury.vouchers.form.payee') }}</div>
          <div>{{ voucher.partyAccount }}<span v-if="voucher.partyDetailName" class="text-slate-500"> · {{ voucher.partyDetailName }}</span></div></div>
        <div v-if="voucher.entryId">
          <div class="text-xs text-slate-500">{{ $t('treasury.vouchers.entry') }}</div>
          <NuxtLink v-if="session.can('entries.read')" :to="`/entries/${voucher.entryId}`" class="text-indigo-700 hover:underline">{{ $t('treasury.entryNo', { n: fmt.money(voucher.entryNumber) }) }}</NuxtLink>
          <span v-else>{{ $t('treasury.entryNo', { n: fmt.money(voucher.entryNumber) }) }}</span>
        </div>
        <div v-if="voucher.description" class="sm:col-span-2"><div class="text-xs text-slate-500">{{ $t('treasury.form.description') }}</div><div>{{ voucher.description }}</div></div>
      </section>

      <section class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="w-full min-w-130 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.form.method') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.form.account') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.form.reference') }}</th>
            <th class="px-4 py-2.5 text-end font-medium">{{ $t('treasury.vouchers.form.amount') }}</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
          <tr v-for="l in voucher.lines" :key="l.id">
            <td class="px-4 py-2.5">{{ $t(`treasury.vouchers.method.${l.method}`) }}</td>
            <td class="px-4 py-2.5"><span class="text-slate-500" dir="ltr">{{ l.accountCode }}</span> {{ l.accountName }}<span v-if="l.detailName" class="text-slate-500"> · {{ l.detailName }}</span></td>
            <td class="px-4 py-2.5 text-slate-600" dir="ltr">{{ l.reference }}</td>
            <td class="px-4 py-2.5 text-end tabular-nums">{{ fmt.money(l.amount) }}</td>
          </tr>
          </tbody>
        </table>
      </section>
    </template>

    <AppModal v-model:open="open" :title="$t('treasury.vouchers.cancelTitle')">
      <div class="space-y-4">
        <p class="text-sm text-slate-600">{{ $t('treasury.vouchers.cancelHint') }}</p>
        <AppAlert v-if="formError">{{ formError }}</AppAlert>
        <AppInput v-model="reason" :label="$t('treasury.vouchers.cancelReason')" :error="errs.reason" :hint="$t('treasury.vouchers.cancelReasonHint')" />
        <DateInput v-model="date" :label="$t('treasury.vouchers.cancelDate')" :error="errs.date" />
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton variant="danger" :loading="busy" @click="cancel">{{ $t('treasury.vouchers.cancel') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>