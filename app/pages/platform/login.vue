<script setup lang="ts">
import {usePlatformStore} from "~/stores/platform.ts";
import {usePlatformError} from "~/composables/usePlatformError.ts";

definePageMeta({ layout: 'auth', middleware: 'platform-auth' })

const { t } = useI18n()
const platform = usePlatformStore()
const perr = usePlatformError()
useHead({ title: computed(() => t('platform.login.title')) })

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  if (!username.value.trim() || !password.value) {
    error.value = t('auth.fillAll')
    return
  }
  loading.value = true
  try {
    await platform.login(username.value.trim(), password.value)
    await navigateTo('/platform')
  } catch (e) {
    const err = toApiError(e)
    error.value = err.status === 401 ? t('platform.login.bad') : perr.of(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">{{ $t('platform.login.title') }}</h2>
      <p class="mt-1 text-sm text-slate-600">{{ $t('platform.login.subtitle') }}</p>
    </div>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <AppInput v-model="username" :label="$t('auth.username')" ltr autocomplete="username" autofocus />
    <AppInput v-model="password" :label="$t('auth.password')" type="password" ltr autocomplete="current-password" />

    <AppButton type="submit" class="w-full" :loading="loading">{{ $t('auth.login') }}</AppButton>
  </form>
</template>