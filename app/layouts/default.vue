<script setup lang="ts">
const session = useSessionStore()
const route = useRoute()
const open = ref(false)

const items = computed(() =>
  MENU.filter((i) => (!i.permission || session.can(i.permission)) && session.hasFeature(i.feature)),
)

watch(() => route.path, () => { open.value = false })

const sub = computed(() => session.features?.subscription ?? null)
</script>

<template>
  <div class="min-h-dvh lg:flex">
    <!-- dark overlay on small screens -->
    <div v-if="open" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" @click="open = false" />

    <aside
      class="fixed inset-y-0 start-0 z-40 w-64 shrink-0 border-e border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 rtl:lg:translate-x-0"
      :class="open ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full'"
    >
      <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div class="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><AppIcon name="book" /></div>
        <span class="font-bold text-slate-900">{{ $t('app.name') }}</span>
      </div>
      <nav class="space-y-1 p-3">
        <template v-for="item in items" :key="item.key">
          <NuxtLink
            v-if="item.ready"
            :to="item.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            active-class="!bg-indigo-50 !text-indigo-700"
          >
            <AppIcon :name="item.icon" />{{ $t(`menu.${item.key}`) }}
          </NuxtLink>
          <span v-else class="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400" :title="$t('common.comingSoon')">
            <AppIcon :name="item.icon" />{{ $t(`menu.${item.key}`) }}
          </span>
        </template>
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" :aria-label="$t('common.menu')" @click="open = true">
          <AppIcon name="menu" />
        </button>
        <div class="hidden lg:block" />
        <div class="flex items-center gap-4">
          <LanguageSwitcher />
          <div class="hidden text-end leading-tight sm:block">
            <div class="text-sm font-medium text-slate-900">{{ session.user?.fullName }}</div>
            <div class="text-xs text-slate-500">{{ session.user?.role }}</div>
          </div>
          <button class="rounded-lg p-2 text-slate-600 hover:bg-slate-100" :title="$t('auth.logout')" @click="session.logout()">
            <AppIcon name="logout" />
            <span class="sr-only">{{ $t('auth.logout') }}</span>
          </button>
        </div>
      </header>

      <div v-if="sub && sub.state !== 'active'" class="px-4 pt-4 sm:px-6">
        <AppAlert :kind="sub.state === 'grace' ? 'warning' : 'error'">
          <template v-if="sub.state === 'grace'">{{ $t('subscription.grace', { date: sub.graceEndsAt }) }}</template>
          <template v-else-if="sub.state === 'expired'">{{ $t('subscription.expired') }}</template>
          <template v-else>{{ $t('subscription.suspended') }}</template>
        </AppAlert>
      </div>

      <main class="flex-1 p-4 sm:p-6"><slot /></main>
    </div>
  </div>
</template>
