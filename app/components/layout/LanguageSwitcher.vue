<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()
const items = computed(() => locales.value.map((l) => (typeof l === 'string' ? { code: l, name: l } : l)))
</script>

<template>
  <label class="relative inline-flex items-center gap-1.5 text-sm text-slate-600">
    <AppIcon name="globe" />
    <span class="sr-only">{{ $t('common.language') }}</span>
    <select
      :value="locale"
      class="cursor-pointer rounded-md border border-slate-200 bg-white py-1 pe-6 ps-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
      @change="setLocale(($event.target as HTMLSelectElement).value as any)"
    >
      <option v-for="l in items" :key="l.code" :value="l.code">{{ l.name }}</option>
    </select>
  </label>
</template>
