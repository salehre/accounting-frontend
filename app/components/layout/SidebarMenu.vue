<script setup lang="ts">
const session = useSessionStore()
const route = useRoute()

const allowed = (x: { permission?: string; feature?: string }) =>
    (!x.permission || session.can(x.permission)) && session.hasFeature(x.feature)

const items = computed(() =>
    MENU
        .filter(allowed)
        .map((i) => ({ ...i, children: i.children?.filter(allowed) }))
        .filter((i) => !i.children || i.children.length > 0),
)

// which groups are open. The group of the page on the screen is always opened.
const openKeys = useState<string[]>('menuOpenGroups', () => [])
watch(
    () => route.path,
    (path) => {
      for (const i of items.value) {
        if (i.children && (path === i.to || path.startsWith(i.to + '/')) && !openKeys.value.includes(i.key)) openKeys.value = [...openKeys.value, i.key]
      }
    },
    { immediate: true },
)
const isOpen = (key: string) => openKeys.value.includes(key)
const toggle = (key: string) => { openKeys.value = isOpen(key) ? openKeys.value.filter((k) => k !== key) : [...openKeys.value, key] }
const groupActive = (to: string) => route.path === to || route.path.startsWith(to + '/')

const link = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100'
</script>

<template>
  <nav class="space-y-1 p-3">
    <template v-for="item in items" :key="item.key">
      <!-- a group: opens under itself -->
      <div v-if="item.children">
        <button
            type="button"
            :class="[link, 'w-full', groupActive(item.to) ? 'text-indigo-700' : '']"
            :aria-expanded="isOpen(item.key)"
            :aria-controls="`menu-${item.key}`"
            @click="toggle(item.key)"
        >
          <AppIcon :name="item.icon" />
          <span class="flex-1 text-start">{{ $t(`menu.${item.key}`) }}</span>
          <AppIcon name="chevron-down" class="!size-4 text-slate-400 transition-transform duration-200" :class="isOpen(item.key) ? 'rotate-180' : ''" />
        </button>
        <!-- 0fr -> 1fr animates the height without measuring it -->
        <div
            :id="`menu-${item.key}`"
            class="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
            :class="isOpen(item.key) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
            :inert="!isOpen(item.key)"
        >
          <ul class="min-h-0 space-y-0.5 overflow-hidden">
            <li v-for="c in item.children" :key="c.to" class="first:pt-1">
              <NuxtLink
                  :to="c.to"
                  class="ms-5 block rounded-lg border-s border-slate-200 py-2 pe-3 ps-4 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  active-class="!border-indigo-500 !bg-indigo-50 !font-medium !text-indigo-700"
              >{{ $t(c.label) }}</NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <NuxtLink v-else-if="item.ready" :to="item.to" :class="link" active-class="!bg-indigo-50 !text-indigo-700">
        <AppIcon :name="item.icon" />{{ $t(`menu.${item.key}`) }}
      </NuxtLink>
      <span v-else class="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400" :title="$t('common.comingSoon')">
        <AppIcon :name="item.icon" />{{ $t(`menu.${item.key}`) }}
      </span>
    </template>
  </nav>
</template>