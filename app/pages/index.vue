<script setup lang="ts">
const session = useSessionStore()
const { t } = useI18n()
useHead({ title: computed(() => t('menu.dashboard')) })

const limits = computed(() => Object.entries(session.features?.limits ?? {}))
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('home.welcome', { name: session.user?.fullName }) }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('home.subtitle') }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="text-xs text-slate-500">{{ $t('home.role') }}</div>
        <div class="mt-1 font-semibold">{{ session.user?.role }}</div>
      </div>
      <div v-for="[code, l] in limits" :key="code" class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="text-xs text-slate-500">{{ $t(`limits.${code}`) }}</div>
        <div class="mt-1 font-semibold" dir="ltr">{{ l.used }} / {{ l.max ?? '∞' }}</div>
      </div>
    </div>

    <AppAlert kind="info">{{ $t('home.building') }}</AppAlert>
  </div>
</template>
