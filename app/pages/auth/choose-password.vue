<script setup lang="ts">
definePageMeta({ layout: 'auth', path: '/choose-password' })

const { t } = useI18n()
const session = useSessionStore()

const MIN = 10
const mode = ref<'choose' | 'change'>('choose')
const current = ref('')
const next = ref('')
const again = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

async function keep() {
  error.value = null
  loading.value = true
  try {
    await session.keepPassword()
    await navigateTo('/')
  } catch (e) {
    error.value = toApiError(e).status === 409 ? t('password.alreadyDone') : t('errors.generic')
    if (toApiError(e).status === 409) await navigateTo('/')
  } finally {
    loading.value = false
  }
}

async function change() {
  error.value = null
  errs.value = {}
  if (!current.value) errs.value.current = t('password.required')
  if (next.value.length < MIN) errs.value.next = t('password.tooShort', { n: MIN })
  else if (next.value === current.value) errs.value.next = t('password.sameAsOld')
  if (again.value !== next.value) errs.value.again = t('password.mismatch')
  if (Object.values(errs.value).some(Boolean)) return

  loading.value = true
  try {
    await session.changePassword(current.value, next.value)
    await navigateTo('/')
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      if (err.field('currentPassword')) errs.value.current = t('password.wrongCurrent')
      else if (err.field('newPassword')) errs.value.next = err.field('newPassword')
      else error.value = t('errors.generic')
    } else error.value = t('errors.generic')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold text-slate-900">{{ $t('password.title') }}</h2>
    <p class="text-sm text-slate-600">{{ $t('password.intro', { name: session.user?.fullName }) }}</p>

    <AppAlert v-if="error">{{ error }}</AppAlert>

    <template v-if="mode === 'choose'">
      <AppButton class="w-full" :loading="loading" @click="keep">{{ $t('password.keep') }}</AppButton>
      <AppButton class="w-full" variant="secondary" @click="mode = 'change'">{{ $t('password.change') }}</AppButton>
    </template>

    <form v-else class="space-y-4" novalidate @submit.prevent="change">
      <AppInput v-model="current" :label="$t('password.current')" type="password" ltr autocomplete="current-password" :error="errs.current" />
      <AppInput v-model="next" :label="$t('password.new')" type="password" ltr autocomplete="new-password" :hint="$t('password.rule', { n: MIN })" :error="errs.next" />
      <AppInput v-model="again" :label="$t('password.repeat')" type="password" ltr autocomplete="new-password" :error="errs.again" />
      <div class="flex gap-3">
        <AppButton type="submit" class="flex-1" :loading="loading">{{ $t('password.save') }}</AppButton>
        <AppButton variant="secondary" @click="mode = 'choose'">{{ $t('common.back') }}</AppButton>
      </div>
    </form>

    <button class="w-full text-center text-sm text-slate-500 hover:text-slate-700" @click="session.logout()">{{ $t('auth.logout') }}</button>
  </div>
</template>
