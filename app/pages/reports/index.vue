<script setup lang="ts">
const { t } = useI18n()
useHead({ title: computed(() => t('menu.reports')) })

// ready:false = built in a later step (shown dimmed, not clickable)
const REPORTS = [
  { key: 'trialBalance', to: '/reports/trial-balance', icon: 'chart', ready: true },
  { key: 'ledger', to: '/reports/ledger', icon: 'book', ready: true },
  { key: 'journal', to: '/reports/journal', icon: 'list', ready: true },
  { key: 'incomeStatement', to: '/reports/income-statement', icon: 'chart', ready: false },
  { key: 'balanceSheet', to: '/reports/balance-sheet', icon: 'chart', ready: false },
]
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.reports') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('reports.subtitle') }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <template v-for="r in REPORTS" :key="r.key">
        <NuxtLink v-if="r.ready" :to="r.to" class="block space-y-2 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm">
          <div class="flex items-center gap-2 text-slate-900"><AppIcon :name="r.icon" /><h2 class="font-semibold">{{ $t(`reports.${r.key}.name`) }}</h2></div>
          <p class="text-sm text-slate-600">{{ $t(`reports.${r.key}.desc`) }}</p>
        </NuxtLink>
        <div v-else class="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-slate-400">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2"><AppIcon :name="r.icon" /><h2 class="font-semibold">{{ $t(`reports.${r.key}.name`) }}</h2></div>
            <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">{{ $t('common.comingSoon') }}</span>
          </div>
          <p class="text-sm">{{ $t(`reports.${r.key}.desc`) }}</p>
        </div>
      </template>
    </div>
  </div>
</template>