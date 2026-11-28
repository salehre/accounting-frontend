<script setup lang="ts">
const session = useSessionStore()
const route = useRoute()
const open = ref(false)
const logoutOpen = ref(false)

watch(() => route.path, () => { open.value = false })

const sub = computed(() => session.features?.subscription ?? null)

// On a small screen the menu is a drawer: while it is closed it must not be reachable with the Tab key
const wide = ref(true)
const menuButton = ref<HTMLButtonElement | null>(null)
const drawer = ref<HTMLElement | null>(null)
onMounted(() => {
  const mq = window.matchMedia('(min-width: 1024px)')
  const sync = () => { wide.value = mq.matches }
  sync()
  mq.addEventListener('change', sync)
  onBeforeUnmount(() => mq.removeEventListener('change', sync))
})
const drawerHidden = computed(() => !wide.value && !open.value)

async function openMenu() {
  open.value = true
  await nextTick()
  drawer.value?.querySelector<HTMLElement>('a[href],button')?.focus()
}
function closeMenu() {
  if (!open.value) return
  open.value = false
  menuButton.value?.focus()
}

const main = ref<HTMLElement | null>(null)
const skipToContent = () => main.value?.focus()
</script>

<template>
  <div class="min-h-dvh lg:flex" @keydown.esc="closeMenu">
    <a href="#main" class="sr-only rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50" @click.prevent="skipToContent">{{ $t('common.skipToContent') }}</a>
    <!-- dark overlay on small screens -->
    <div v-if="open" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" aria-hidden="true" @click="closeMenu" />

    <aside
        id="app-menu"
        ref="drawer"
        :inert="drawerHidden"
        class="fixed inset-y-0 inset-s-0 z-40 w-64 shrink-0 border-e border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 rtl:lg:translate-x-0"
        :class="open ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full'"
    >
      <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div class="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><AppIcon name="book" /></div>
        <span class="font-bold text-slate-900">{{ $t('app.name') }}</span>
      </div>
      <SidebarMenu />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button ref="menuButton" type="button" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" :aria-label="$t('common.menu')" aria-controls="app-menu" :aria-expanded="open" @click="openMenu">
          <AppIcon name="menu" />
        </button>
        <div class="hidden lg:block" />
        <div class="flex items-center gap-4">
          <LanguageSwitcher />
          <NuxtLink to="/profile" class="hidden rounded-lg px-2 py-1 text-end leading-tight hover:bg-slate-100 sm:block" :title="$t('profile.title')">
            <div class="text-sm font-medium text-slate-900">{{ session.user?.fullName }}</div>
            <div class="text-xs text-slate-500">{{ session.user?.role }}</div>
          </NuxtLink>
          <button type="button" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100" :title="$t('auth.logout')" @click="logoutOpen = true">
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

      <main id="main" ref="main" tabindex="-1" class="flex-1 p-4 outline-none sm:p-6"><slot /></main>
    </div>
    <LogoutConfirm v-model:open="logoutOpen" />
  </div>
</template>