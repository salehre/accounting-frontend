<script setup lang="ts">
import type { EntryRow, FiscalYear, Paginated } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('menu.entries')) })

const PAGE_SIZE = 25
const rows = ref<EntryRow[]>([])
const total = ref(0)
const page = ref(1)
const yearId = ref(String(useRoute().query.fiscalYearId ?? ''))
const status = ref('')
const years = ref<FiscalYear[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const canWrite = computed(() => session.can('entries.write') && !session.readOnly)

const yearOptions = computed(() => [{ value: '', label: t('entries.filters.all') }, ...years.value.map((y) => ({ value: String(y.id), label: y.title }))])
const statusOptions = computed(() => [
  { value: '', label: t('entries.filters.all') },
  { value: 'draft', label: t('entries.statuses.draft') },
  { value: 'posted', label: t('entries.statuses.posted') },
])

let seq = 0
async function load() {
  const mine = ++seq
  error.value = null
  loading.value = true
  try {
    const r = await api.get<Paginated<EntryRow>>('/entries', {
      page: page.value, pageSize: PAGE_SIZE,
      fiscalYearId: yearId.value || undefined, status: status.value || undefined,
    })
    if (mine !== seq) return
    rows.value = r.items.map((x) => ({ ...x, id: Number(x.id), number: x.number === null ? null : Number(x.number), totalDebit: Number(x.totalDebit) }))
    total.value = Number(r.total)
  } catch (e) {
    if (mine === seq) error.value = errorText.of(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch([yearId, status], () => { page.value = 1; load() })
watch(page, load)
onMounted(async () => {
  try { years.value = (await api.get<FiscalYear[]>('/fiscal-years')).map((y) => ({ ...y, id: Number(y.id) })) } catch { /* the filter just stays empty */ }
  await load()
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.entries') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('entries.subtitle') }}</p>
      </div>
      <NuxtLink v-if="canWrite" to="/entries/new"><AppButton><AppIcon name="plus" />{{ $t('entries.newEntry') }}</AppButton></NuxtLink>
    </div>

    <div class="flex flex-wrap gap-3">
      <div class="w-56"><AppSelect v-model="yearId" :label="$t('entries.filters.year')" :options="yearOptions" /></div>
      <div class="w-44"><AppSelect v-model="status" :label="$t('entries.status')" :options="statusOptions" /></div>
    </div>

    <AppAlert v-if="error">{{ error }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-180 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-3 text-start font-medium">{{ $t('entries.number') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('entries.date') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('entries.description') }}</th>
          <th class="px-4 py-3 text-end font-medium">{{ $t('entries.total') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('entries.status') }}</th>
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-if="loading"><td colspan="5" class="px-4 py-10 text-center text-slate-500">{{ $t('common.loading') }}</td></tr>
        <tr v-else-if="rows.length === 0"><td colspan="5" class="px-4 py-10 text-center text-slate-500">{{ $t('entries.empty') }}</td></tr>
        <tr v-for="r in rows" v-else :key="r.id" class="cursor-pointer hover:bg-slate-50" @click="navigateTo(`/entries/${r.id}`)">
          <td class="px-4 py-2.5 font-medium">
            <NuxtLink :to="`/entries/${r.id}`" class="text-indigo-700 hover:underline" @click.stop>{{ r.number === null ? $t('entries.noNumber') : fmt.money(r.number) }}</NuxtLink>
          </td>
          <td class="px-4 py-2.5" dir="ltr">{{ fmt.date(r.entryDate) }}</td>
          <td class="max-w-xs truncate px-4 py-2.5 text-slate-700">
            {{ r.description || '—' }}
            <span v-if="r.sourceType?.startsWith('year_end_')" class="ms-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{{ $t('entries.yearEnd') }}</span>
          </td>
          <td class="px-4 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(r.totalDebit) }}</td>
          <td class="px-4 py-2.5"><StatusBadge :status="r.status" /></td>
        </tr>
        </tbody>
      </table>
    </div>

    <AppPagination v-if="total > 0" v-model:page="page" :page-size="PAGE_SIZE" :total="total" />
  </div>
</template>