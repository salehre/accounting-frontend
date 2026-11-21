<script setup lang="ts">
import { Toaster } from 'vue-sonner'

const { locale, locales, setLocale } = useI18n()

// remember the chosen language for a year
const saved = useCookie<string | null>('acc_locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
if (saved.value && saved.value !== locale.value && locales.value.some((l) => (typeof l === 'string' ? l : l.code) === saved.value)) {
  setLocale(saved.value as 'fa' | 'en' | 'ar')
}
watch(locale, (v) => { saved.value = v })

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
  <!-- every toast of the app is shown here (see composables/useNotify.ts) -->
  <Toaster position="top-center" rich-colors close-button :dir="dir" :duration="3500" :visible-toasts="4" />
</template>
