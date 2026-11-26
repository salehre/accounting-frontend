<script setup lang="ts">
import type { VoucherList } from '~/types/treasury'

const { t } = useI18n()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('treasury.vouchers.title')) })

const PAGE_SIZE = 25
const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)

const data = ref<VoucherList>({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0, postedTotal: 0 })
const loading = ref(true)
const error = ref<string | null>(null)
const kind = ref('')
const status = ref('')
const search = ref('')
const page = ref(1)

const kindOptions = computed(() => [
  { value: '', label: t('treasury.filters.all') },
  { value: 'receipt', label: t('treasury.vouchers.kind.receipt') },
  { value: 'payment', label: t('treasury.vouchers.kind.payment') },
])
const statusOptions = computed(() => [
  { value: '', label: t('treasury.filters.anyStatus') },
  { value: 'posted', label: t('treasury.vouchers.status.posted') },
  { value: 'cancelled', label: t('treasury.vouchers.status.cancelled') },
])

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await api.get<VoucherList>('/treasury-vouchers', {
      kind: kind.value || undefined,
      status: status.value || undefined,
      search: search.value.trim() || undefined,
      page: page.value,
      pageSize: PAGE_SIZE,
    })
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

let timer: ReturnType<typeof setTimeout> | undefined
watch([kind, status], () => { page.value = 1; void load() })
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; void load() }, 300) })
watch(page, () => { void load() })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('treasury.vouchers.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.vouchers.subtitle') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/treasury/vouchers/accounts"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {{ $t('treasury.vouchers.money.link') }}
        </NuxtLink>
        <template v-if="canManage">
          <NuxtLink to="/treasury/vouchers/new?kind=receipt"
                    class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
            <AppIcon name="plus" />{{ $t('treasury.vouchers.newReceipt') }}
          </NuxtLink>
          <NuxtLink to="/treasury/vouchers/new?kind=payment"
                    class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
            <AppIcon name="plus" />{{ $t('treasury.vouchers.newPayment') }}
          </NuxtLink>
        </template>
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div class="w-44"><AppSelect v-model="kind" :label="$t('treasury.filters.direction')" :options="kindOptions" /></div>
      <div class="w-44"><AppSelect v-model="status" :label="$t('treasury.filters.status')" :options="statusOptions" /></div>
      <div class="min-w-48 flex-1"><AppInput v-model="search" :label="$t('treasury.filters.search')" :hint="$t('treasury.vouchers.searchHint')" /></div>
    </div>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="!data.items.length" class="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p class="font-medium text-slate-700">{{ $t('treasury.vouchers.empty') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ $t('treasury.vouchers.emptyHint') }}</p>
    </div>

    <template v-else>
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="w-full min-w-190 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.cols.number') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.vouchers.cols.date') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.cols.party') }}</th>
            <th class="px-4 py-2.5 text-end font-medium">{{ $t('treasury.cols.amount') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.cols.status') }}</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
          <tr v-for="r in data.items" :key="r.id" class="hover:bg-slate-50" :class="r.status === 'cancelled' ? 'text-slate-400' : ''">
            <td class="px-4 py-2.5">
              <NuxtLink :to="`/treasury/vouchers/${r.id}`" class="font-medium hover:underline" :class="r.status === 'cancelled' ? 'text-slate-500' : 'text-indigo-700'">
                {{ $t(`treasury.vouchers.kind.${r.kind}`) }} {{ fmt.money(r.number) }}
              </NuxtLink>
            </td>
            <td class="px-4 py-2.5"><span dir="auto">{{ fmt.date(r.date) }}</span></td>
            <td class="px-4 py-2.5">{{ r.partyDetailName ?? r.partyAccount }}<span v-if="r.description" class="block text-xs text-slate-400">{{ r.description }}</span></td>
            <td class="px-4 py-2.5 text-end tabular-nums" :class="[r.status === 'cancelled' ? 'line-through' : '', r.status === 'posted' ? (r.kind === 'receipt' ? 'text-emerald-700' : 'text-rose-700') : '']">{{ fmt.money(r.amount) }}</td>
            <td class="px-4 py-2.5">
              <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="r.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'">{{ $t(`treasury.vouchers.status.${r.status}`) }}</span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
      <p class="text-sm text-slate-600">{{ $t('treasury.vouchers.postedTotal') }}: <span class="font-semibold tabular-nums">{{ fmt.money(data.postedTotal) }}</span> {{ $t('common.rial') }}</p>
    </template>

    <AppPagination v-if="data.total > PAGE_SIZE" v-model:page="page" :page-size="PAGE_SIZE" :total="data.total" />
  </div>
</template>