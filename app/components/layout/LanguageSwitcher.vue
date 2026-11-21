<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()
const items = computed(() => locales.value.map((l) => (typeof l === 'string' ? { value: l, label: l } : { value: l.code, label: l.name ?? l.code })))
const current = computed({
  get: () => locale.value as string,
  set: (v: string) => { setLocale(v as 'fa' | 'en' | 'ar') },
})
</script>

<template>
  <div class="inline-flex items-center gap-1.5 text-slate-600">
    <AppIcon name="globe" />
    <div class="w-28"><AppSelect v-model="current" compact size="sm" :options="items" :aria-label="$t('common.language')" /></div>
  </div>
</template>