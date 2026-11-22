<script setup lang="ts">
import type { PlatformAuditRow } from '~/types/platform'
import {usePlatformApi} from "~/composables/usePlatformApi.ts";
import {usePlatformError} from "~/composables/usePlatformError.ts";

definePageMeta({ layout: 'platform', middleware: 'platform-auth' })

const { t, te } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
const fmt = useFormat()
useHead({ title: computed(() => t('platform.audit.title')) })

const ACTIONS = [
  'tenant_create', 'tenant_rename', 'tenant_renew', 'tenant_suspend', 'tenant_activate', 'tenant_plan',
  'license_issue', 'license_revoke', 'override', 'plan', 'platform_login',
]

const rows = ref<PlatformAuditRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const company = ref('')
const action = ref('')
const limit = ref('50')

const actionOptions = computed(() => [
  { value: '', label: t('platform.audit.allActions') },
  ...ACTIONS.map((a) => ({ value: a, label: actionLabel(a) })),
])
const limitOptions = [{ value: '50', label: '50' }, { value: '100', label: '100' }, { value: '200', label: '200' }]

const actionLabel = (a: string) => (te(`platform.action.${a}`) ? t(`platform.action.${a}`) : a)
const dayTime = (v: string | null | undefined) => (v ? `${fmt.date(v.slice(0, 10))} ${/[T ](\d{2}:\d{2})/.exec(v)?.[1] ?? ''}` : '—')

let seq = 0
async function load() {
  const mine = ++seq
  loadError.value = null
  try {
    const query: Record<string, unknown> = { limit: Number(limit.value) }
    if (company.value.trim()) query.company = company.value.trim().toLowerCase()
    if (action.value) query.action = action.value
    const res = await api.get<{ data: PlatformAuditRow[] }>('/platform/audit', query)
    if (mine === seq) rows.value = res.data
  } catch (e) {
    if (mine === seq) loadError.value = perr.of(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(company, () => { clearTimeout(timer); timer = setTimeout(load, 300) })
watch([action, limit], load)
onBeforeUnmount(() => clearTimeout(timer))
onMounted(load)

function detailsText(row: PlatformAuditRow): string {
  if (!row.details) return ''
  return Object.entries(row.details).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('platform.audit.title') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('platform.audit.subtitle') }}</p>
    </div>

    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div class="min-w-48 flex-1"><AppInput v-model="company" :label="$t('platform.audit.company')" ltr /></div>
      <div class="w-56"><AppSelect v-model="action" :label="$t('platform.audit.action')" :options="actionOptions" /></div>
      <div class="w-28"><AppSelect v-model="limit" :label="$t('platform.audit.count')" :options="limitOptions" /></div>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-205 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.audit.when') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.audit.action') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.audit.company') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.audit.details') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.audit.by') }}</th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="rows.length === 0"><td colspan="5" class="px-4 py-10 text-center text-slate-500">{{ $t('platform.audit.empty') }}</td></tr>
        <tr v-for="r in rows" :key="r.id" class="border-t border-slate-100 align-top">
          <td class="whitespace-nowrap px-4 py-2.5">{{ dayTime(r.at) }}</td>
          <td class="px-4 py-2.5 font-medium">{{ actionLabel(r.action) }}</td>
          <td class="px-4 py-2.5" dir="ltr">
            <NuxtLink v-if="r.company" :to="`/platform/companies/${r.company}`" class="hover:underline">{{ r.company }}</NuxtLink>
            <span v-else>—</span>
          </td>
          <td class="wrap-break-word px-4 py-2.5 text-xs text-slate-600" dir="ltr">{{ detailsText(r) }}</td>
          <td class="px-4 py-2.5 text-xs" dir="ltr">{{ r.by }}</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>