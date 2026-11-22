<script setup lang="ts">
import type { PlatformPlans } from '~/types/platform'

definePageMeta({ layout: 'platform', middleware: 'platform-auth' })

const { t, te } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
useHead({ title: computed(() => t('platform.plans.title')) })

const data = ref<PlatformPlans | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

async function load() {
  loadError.value = null
  try { data.value = await api.get<PlatformPlans>('/platform/plans') } catch (e) { loadError.value = perr.of(e) } finally { loading.value = false }
}
onMounted(load)

const featureLabel = (c: string) => (te(`platform.feature.${permKey(c)}`) ? t(`platform.feature.${permKey(c)}`) : c)
const limitLabel = (c: string) => (te(`platform.limit.${permKey(c)}`) ? t(`platform.limit.${permKey(c)}`) : c)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('platform.plans.title') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('platform.plans.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="data" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <p v-if="data.data.length === 0" class="col-span-full py-10 text-center text-slate-500">{{ $t('platform.plans.empty') }}</p>
      <section v-for="p in data.data" :key="p.code" class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="font-semibold text-slate-900">{{ p.name }}</h2>
          <span class="text-xs text-slate-500" dir="ltr">{{ p.code }}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="fcode in p.features" :key="fcode" class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">{{ featureLabel(fcode) }}</span>
          <span v-if="p.features.length === 0" class="text-xs text-slate-500">{{ $t('platform.detail.coreOnly') }}</span>
        </div>
        <ul class="mt-3 space-y-1 text-sm">
          <li v-for="(max, lcode) in p.limits" :key="lcode" class="flex justify-between gap-3">
            <span class="text-slate-500">{{ limitLabel(String(lcode)) }}</span>
            <span>{{ max === null ? $t('platform.unlimited') : max }}</span>
          </li>
        </ul>
      </section>
    </div>

    <p class="text-xs text-slate-500">{{ $t('platform.plans.note') }}</p>
  </div>
</template>