<script setup lang="ts">
const { locale, locales } = useI18n()

// fa and ar are right to left, en is left to right (set per language in nuxt.config.ts)
const dir = computed(() => {
  const l = locales.value.find((x) => typeof x !== 'string' && x.code === locale.value)
  return (l && typeof l !== 'string' ? l.dir : undefined) ?? 'rtl'
})

useHead({ htmlAttrs: { lang: locale, dir } })
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
