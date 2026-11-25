<script setup lang="ts">
const platform = usePlatformStore()
const route = useRoute()

const links = [
  { to: '/platform', label: 'platform.nav.companies', exact: false, match: (p: string) => p === '/platform' || p.startsWith('/platform/companies') },
  { to: '/platform/plans', label: 'platform.nav.plans', exact: true, match: (p: string) => p === '/platform/plans' },
  { to: '/platform/audit', label: 'platform.nav.audit', exact: true, match: (p: string) => p === '/platform/audit' },
]
</script>

<template>
  <div class="min-h-dvh bg-slate-50">
    <a href="#main" class="sr-only rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50" @click.prevent="($refs.main as HTMLElement | undefined)?.focus()">{{ $t('common.skipToContent') }}</a>
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"><AppIcon name="lock" /></div>
          <span class="truncate font-bold text-slate-900">{{ $t('platform.title') }}</span>
        </div>
        <div class="flex items-center gap-3">
          <LanguageSwitcher />
          <div class="hidden text-end leading-tight sm:block">
            <div class="text-sm font-medium text-slate-900">{{ platform.admin?.fullName }}</div>
            <div class="text-xs text-slate-500" dir="ltr">{{ platform.admin?.username }}</div>
          </div>
          <button class="rounded-lg p-2 text-slate-600 hover:bg-slate-100" :title="$t('auth.logout')" @click="platform.logout()">
            <AppIcon name="logout" />
            <span class="sr-only">{{ $t('auth.logout') }}</span>
          </button>
        </div>
      </div>
      <nav class="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" :aria-label="$t('platform.title')">
        <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition"
            :class="l.match(route.path) ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'"
        >
          {{ $t(l.label) }}
        </NuxtLink>
      </nav>
    </header>

    <main id="main" ref="main" tabindex="-1" class="p-4 outline-none sm:p-6"><slot /></main>
  </div>
</template>