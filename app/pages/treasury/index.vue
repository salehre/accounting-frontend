<script setup lang="ts">
import type { ChequeList, DirectionSummary, TreasurySummary } from '~/types/treasury'
import { CHEQUE_STATUSES } from '~/types/treasury'
import ChequeStatus from "~/components/treasury/ChequeStatus.vue";

const { t } = useI18n()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('treasury.title')) })

const PAGE_SIZE = 25
const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)

const summary = ref<TreasurySummary | null>(null)
const data = ref<ChequeList>({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 })
const loading = ref(true)
const error = ref<string | null>(null)

const direction = ref('')
const status = ref('')
const search = ref('')
const overdueOnly = ref(false)
const page = ref(1)

const directionOptions = computed(() => [
  { value: '', label: t('treasury.filters.all') },
  { value: 'received', label: t('treasury.direction.received') },
  { value: 'issued', label: t('treasury.direction.issued') },
])
const statusOptions = computed(() => [
  { value: '', label: t('treasury.filters.anyStatus') },
  ...CHEQUE_STATUSES.map((s) => ({ value: s, label: t(`treasury.status.${s}`) })),
])

async function loadList() {
  loading.value = true
  error.value = null
  try {
    data.value = await api.get<ChequeList>('/cheques', {
      direction: direction.value || undefined,
      status: status.value || undefined,
      search: search.value.trim() || undefined,
      overdue: overdueOnly.value ? 1 : undefined,
      page: page.value,
      pageSize: PAGE_SIZE,
    })
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
async function loadSummary() {
  try { summary.value = await api.get<TreasurySummary>('/treasury/summary') } catch { /* the list shows the error */ }
}
onMounted(() => { void loadSummary(); void loadList() })

let timer: ReturnType<typeof setTimeout> | undefined
watch([direction, status, overdueOnly], () => { page.value = 1; void loadList() })
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; void loadList() }, 300) })
watch(page, () => { void loadList() })
onBeforeUnmount(() => clearTimeout(timer))

function showOverdue(d: 'received' | 'issued') {
  direction.value = d
  status.value = ''
  overdueOnly.value = true
}

const cards = computed(() => (['received', 'issued'] as const).map((d) => ({ key: d, s: summary.value?.[d] as DirectionSummary | undefined })))
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('treasury.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.subtitle') }}</p>
      </div>
      <NuxtLink v-if="canManage" to="/treasury/new"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
        <AppIcon name="plus" />{{ $t('treasury.new') }}
      </NuxtLink>
    </div>

    <!-- what is waiting -->
    <div class="grid gap-4 md:grid-cols-2">
      <section v-for="c in cards" :key="c.key" class="rounded-xl border border-slate-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-slate-900">{{ $t(`treasury.direction.${c.key}`) }}</h2>
        <p v-if="!c.s" class="mt-3 text-sm text-slate-500">{{ $t('common.loading') }}</p>
        <div v-else class="mt-3 grid grid-cols-3 gap-3 text-center">
          <button type="button" class="rounded-lg p-2 transition hover:bg-red-50" :class="c.s.overdue.count ? 'bg-red-50' : 'bg-slate-50'" @click="showOverdue(c.key)">
            <div class="text-xs text-slate-500">{{ $t('treasury.summary.overdue') }}</div>
            <div class="mt-1 text-lg font-bold tabular-nums" :class="c.s.overdue.count ? 'text-red-700' : 'text-slate-700'">{{ fmt.money(c.s.overdue.count) }}</div>
            <div class="text-xs tabular-nums text-slate-500">{{ fmt.money(c.s.overdue.total) }}</div>
          </button>
          <div class="rounded-lg bg-amber-50 p-2">
            <div class="text-xs text-slate-500">{{ $t('treasury.summary.next7') }}</div>
            <div class="mt-1 text-lg font-bold tabular-nums text-amber-800">{{ fmt.money(c.s.next7.count) }}</div>
            <div class="text-xs tabular-nums text-slate-500">{{ fmt.money(c.s.next7.total) }}</div>
          </div>
          <div class="rounded-lg bg-slate-50 p-2">
            <div class="text-xs text-slate-500">{{ $t('treasury.summary.next30') }}</div>
            <div class="mt-1 text-lg font-bold tabular-nums text-slate-700">{{ fmt.money(c.s.next30.count) }}</div>
            <div class="text-xs tabular-nums text-slate-500">{{ fmt.money(c.s.next30.total) }}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- filters -->
    <div class="flex flex-wrap items-end gap-3">
      <div class="w-44"><AppSelect v-model="direction" :label="$t('treasury.filters.direction')" :options="directionOptions" /></div>
      <div class="w-48"><AppSelect v-model="status" :label="$t('treasury.filters.status')" :options="statusOptions" /></div>
      <div class="min-w-48 flex-1"><AppInput v-model="search" :label="$t('treasury.filters.search')" :hint="$t('treasury.filters.searchHint')" /></div>
      <label class="mb-6 flex items-center gap-2 text-sm text-slate-700">
        <input v-model="overdueOnly" type="checkbox" class="size-4 rounded border-slate-300 text-indigo-600">{{ $t('treasury.filters.overdueOnly') }}
      </label>
    </div>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="loadList">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="!data.items.length" class="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p class="font-medium text-slate-700">{{ $t('treasury.empty') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ $t('treasury.emptyHint') }}</p>
    </div>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-205 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.cols.number') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.cols.party') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.cols.dueDate') }}</th>
          <th class="px-4 py-2.5 text-end font-medium">{{ $t('treasury.cols.amount') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('treasury.cols.status') }}</th>
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-for="r in data.items" :key="r.id" class="hover:bg-slate-50">
          <td class="px-4 py-2.5">
            <NuxtLink :to="`/treasury/${r.id}`" class="font-medium text-indigo-700 hover:underline" dir="ltr">{{ r.number }}</NuxtLink>
            <div class="text-xs text-slate-500">{{ r.bankName }} · {{ $t(`treasury.direction.${r.direction}`) }}</div>
          </td>
          <td class="px-4 py-2.5">{{ r.counterpartyDetailName ?? r.counterpartyAccount }}</td>
          <td class="px-4 py-2.5 text-slate-600"><span dir="ltr">{{ fmt.date(r.dueDate) }}</span></td>
          <td class="px-4 py-2.5 text-end tabular-nums">{{ fmt.money(r.amount) }}</td>
          <td class="px-4 py-2.5"><ChequeStatus :status="r.status" :overdue="r.overdue" /></td>
        </tr>
        </tbody>
      </table>
    </div>

    <AppPagination v-if="data.total > PAGE_SIZE" v-model:page="page" :page-size="PAGE_SIZE" :total="data.total" />
  </div>
</template>