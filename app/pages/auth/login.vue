<script setup lang="ts">
definePageMeta({ layout: 'auth', path: '/login' })

const { t } = useI18n()
const config = useRuntimeConfig()
const session = useSessionStore()

const multi = config.public.tenancy === 'multi'
const company = ref('')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string | null>>({})

onMounted(() => { company.value = getStoredCompany() })

function messageFor(e: ApiError): string {
  if (e.status === 429) return t('errors.tooManyAttempts')
  if (e.status === 422 && e.code === null && Object.keys(e.errors).length === 0) return t('auth.badCredentials')
  if (e.status === 401 || e.status === 422) return t('auth.badCredentials')
  if (e.status === 403 && e.code === 'account_disabled') return t('errors.accountDisabled')
  if (e.status === 0) return t('errors.network')
  if (e.status === 404 || e.status === 400) return t('auth.companyNotFound')
  return t('errors.generic')
}

async function submit() {
  error.value = null
  fieldErrors.value = {}
  if ((multi && !company.value.trim()) || !username.value.trim() || !password.value) {
    error.value = t('auth.fillAll')
    return
  }
  loading.value = true
  try {
    await session.login(company.value, username.value, password.value)
    await navigateTo(session.choicePending ? '/choose-password' : '/')
  } catch (e) {
    const err = toApiError(e)
    error.value = messageFor(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-slate-900">{{ $t('auth.loginTitle') }}</h2>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <AppInput v-if="multi" v-model="company" :label="$t('auth.company')" :hint="$t('auth.companyHint')" ltr autocomplete="organization" />
    <AppInput v-model="username" :label="$t('auth.username')" ltr autocomplete="username" :autofocus="!multi" />
    <AppInput v-model="password" :label="$t('auth.password')" type="password" ltr autocomplete="current-password" />

    <AppButton type="submit" class="w-full" :loading="loading">{{ $t('auth.login') }}</AppButton>
  </form>
</template>
