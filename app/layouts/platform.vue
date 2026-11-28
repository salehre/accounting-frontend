<script setup lang="ts">
const platform = usePlatformStore()
const route = useRoute()
const open = ref(false)
const logoutOpen = ref(false)

watch(() => route.path, () => { open.value = false })

// the same sidebar as the company panel: a fixed column on a wide screen, a drawer on a small one
const links = [
  { to: '/platform', label: 'platform.nav.companies', icon: 'globe', match: (p: string) => p === '/platform' || p.startsWith('/platform/companies') },
  { to: '/platform/plans', label: 'platform.nav.plans', icon: 'list', match: (p: string) => p === '/platform/plans' },
  { to: '/platform/audit', label: 'platform.nav.audit', icon: 'search', match: (p: string) => p === '/platform/audit' },
]

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

const link = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100'
</script>

<template>
  <div class="min-h-dvh bg-slate-50 lg:flex" @keydown.esc="closeMenu">
    <a href="#main" class="sr-only rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50" @click.prevent="skipToContent">{{ $t('common.skipToContent') }}</a>
    <!-- dark overlay on small screens -->
    <div v-if="open" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" aria-hidden="true" @click="closeMenu" />

    <aside
        id="platform-menu"
        ref="drawer"
        :inert="drawerHidden"
        class="fixed inset-y-0 inset-s-0 z-40 w-64 shrink-0 border-e border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 rtl:lg:translate-x-0"
        :class="open ? 'translate-x-0' : 'max-lg:-translate-x-full max-lg:rtl:translate-x-full'"
    >
      <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"><AppIcon name="lock" /></div>
        <span class="truncate font-bold text-slate-900">{{ $t('platform.title') }}</span>
      </div>
      <nav class="space-y-1 p-3" :aria-label="$t('platform.title')">
        <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            :class="[link, l.match(route.path) ? '!bg-indigo-50 !text-indigo-700' : '']"
            :aria-current="l.match(route.path) ? 'page' : undefined"
        >
          <AppIcon :name="l.icon" />{{ $t(l.label) }}
        </NuxtLink>
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button ref="menuButton" type="button" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" :aria-label="$t('common.menu')" aria-controls="platform-menu" :aria-expanded="open" @click="openMenu">
          <AppIcon name="menu" />
        </button>
        <div class="hidden lg:block" />
        <div class="flex items-center gap-4">
          <LanguageSwitcher />
          <div class="hidden text-end leading-tight sm:block">
            <div class="text-sm font-medium text-slate-900">{{ platform.admin?.fullName }}</div>
            <div class="text-xs text-slate-500" dir="ltr">{{ platform.admin?.username }}</div>
          </div>
          <button type="button" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100" :title="$t('auth.logout')" @click="logoutOpen = true">
            <AppIcon name="logout" />
            <span class="sr-only">{{ $t('auth.logout') }}</span>
          </button>
        </div>
      </header>

      <main id="main" ref="main" tabindex="-1" class="flex-1 p-4 outline-none sm:p-6"><slot /></main>
    </div>
    <LogoutConfirm v-model:open="logoutOpen" platform />
  </div>
</template>