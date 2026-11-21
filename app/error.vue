<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const notFound = computed(() => props.error.statusCode === 404)
useHead({ title: computed(() => t(notFound.value ? 'errorPage.notFoundTitle' : 'errorPage.title')) })
const home = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div class="text-5xl font-bold text-indigo-600" dir="ltr">{{ error.statusCode }}</div>
      <h1 class="mt-3 text-lg font-semibold text-slate-900">{{ notFound ? $t('errorPage.notFoundTitle') : $t('errorPage.title') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ notFound ? $t('errorPage.notFoundText') : $t('errorPage.text') }}</p>
      <AppButton class="mt-6" @click="home">{{ $t('errorPage.home') }}</AppButton>
    </div>
  </div>
</template>