<script setup lang="ts">
import type { PlatformCompany, PlatformPlan, PlatformPlans } from '~/types/platform'
import PlatformStatus from "~/components/platform/PlatformStatus.vue";
import CompanyCreateModal from "~/components/platform/CompanyCreateModal.vue";
import {usePlatformApi} from "~/composables/usePlatformApi.ts";
import {usePlatformError} from "~/composables/usePlatformError.ts";

definePageMeta({ layout: 'platform', middleware: 'platform-auth' })

const { t } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
const fmt = useFormat()
useHead({ title: computed(() => t('platform.companies.title')) })

const items = ref<PlatformCompany[]>([])
const plans = ref<PlatformPlan[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const search = ref('')
const status = ref('')
const createOpen = ref(false)

const statusOptions = computed(() => [
  { value: '', label: t('platform.companies.allStatuses') },
  { value: 'active', label: t('platform.state.active') },
  { value: 'suspended', label: t('platform.state.suspended') },
])

let seq = 0
async function load() {
  const mine = ++seq
  loadError.value = null
  try {
    const query: Record<string, unknown> = {}
    if (search.value.trim()) query.search = search.value.trim()
    if (status.value) query.status = status.value
    const res = await api.get<{ data: PlatformCompany[] }>('/platform/companies', query)
    if (mine === seq) items.value = res.data
  } catch (e) {
    if (mine === seq) loadError.value = perr.of(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => { clearTimeout(timer); timer = setTimeout(load, 300) })
watch(status, load)
onBeforeUnmount(() => clearTimeout(timer))
onMounted(async () => {
  load()
  try { plans.value = (await api.get<PlatformPlans>('/platform/plans')).data } catch { /* the list still works without it */ }
})

const day = (v: string | null | undefined) => (v ? fmt.date(v.slice(0, 10)) : '—')
const open = (code: string) => navigateTo(`/platform/companies/${code}`)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('platform.companies.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('platform.companies.subtitle') }}</p>
      </div>
      <AppButton @click="createOpen = true"><AppIcon name="plus" />{{ $t('platform.companies.add') }}</AppButton>
    </div>

    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div class="min-w-56 flex-1"><AppInput v-model="search" :label="$t('platform.companies.search')" /></div>
      <div class="w-48"><AppSelect v-model="status" :label="$t('platform.companies.status')" :options="statusOptions" /></div>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-215 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.companies.name') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.companies.code') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.companies.plan') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.companies.subscription') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.companies.status') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('platform.companies.license') }}</th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="items.length === 0"><td colspan="6" class="px-4 py-10 text-center text-slate-500">{{ $t('platform.companies.empty') }}</td></tr>
        <tr
            v-for="c in items"
            :key="c.code"
            class="cursor-pointer border-t border-slate-100 hover:bg-slate-50/60"
            :class="c.status === 'suspended' ? 'text-slate-500' : ''"
            @click="open(c.code)"
        >
          <td class="px-4 py-2.5 font-medium">
            <NuxtLink :to="`/platform/companies/${c.code}`" class="hover:underline" @click.stop>{{ c.name }}</NuxtLink>
          </td>
          <td class="px-4 py-2.5" dir="ltr">{{ c.code }}</td>
          <td class="px-4 py-2.5">{{ c.plan ? c.plan.name : $t('platform.noPlan') }}</td>
          <td class="whitespace-nowrap px-4 py-2.5">
            <PlatformStatus :kind="c.subscription.state" />
            <span class="ms-2 text-xs text-slate-500">{{ c.subscription.endsAt ? day(c.subscription.endsAt) : $t('platform.noEnd') }}</span>
          </td>
          <td class="px-4 py-2.5"><PlatformStatus :kind="c.status" /></td>
          <td class="px-4 py-2.5" dir="ltr">{{ c.license.active ? `…${c.license.hint}` : '—' }}</td>
        </tr>
        </tbody>
      </table>
    </div>

    <CompanyCreateModal v-model:open="createOpen" :plans="plans" @created="open" />
  </div>
</template>