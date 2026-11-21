<script setup lang="ts">
import { permKey } from '~/composables/useRoleLabel'

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const roleLabel = useRoleLabel()
useHead({ title: computed(() => t('profile.title')) })

const MIN = 10
const current = ref('')
const next = ref('')
const again = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const all = computed(() => session.user?.permissions.includes('*') ?? false)
const perms = computed(() => (session.user?.permissions ?? []).filter((p) => p !== '*'))

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
    await api.post('/auth/change-password', { currentPassword: current.value, newPassword: next.value })
    notify.success(t('toast.passwordChanged'))
    current.value = next.value = again.value = ''
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      if (err.field('currentPassword')) errs.value.current = t('password.wrongCurrent')
      else if (err.field('newPassword')) errs.value.next = err.field('newPassword')
      else error.value = useErrorText().of(e)
    } else if (err.status === 429) notify.error(t('errors.tooManyAttempts'))
    else error.value = useErrorText().of(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <h1 class="text-2xl font-bold text-slate-900">{{ $t('profile.title') }}</h1>

    <section class="rounded-xl border border-slate-200 bg-white p-5">
      <dl class="grid gap-4 text-sm sm:grid-cols-3">
        <div><dt class="text-xs text-slate-500">{{ $t('profile.fullName') }}</dt><dd class="mt-1 font-medium">{{ session.user?.fullName }}</dd></div>
        <div><dt class="text-xs text-slate-500">{{ $t('profile.username') }}</dt><dd class="mt-1 font-medium" dir="ltr">{{ session.user?.username }}</dd></div>
        <div><dt class="text-xs text-slate-500">{{ $t('profile.role') }}</dt><dd class="mt-1 font-medium">{{ roleLabel(session.user?.role ?? '') }}</dd></div>
      </dl>
      <div class="mt-4 border-t border-slate-100 pt-4">
        <div class="text-xs text-slate-500">{{ $t('profile.permissions') }}</div>
        <p v-if="all" class="mt-1 text-sm text-slate-700">{{ $t('profile.allPermissions') }}</p>
        <div v-else class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="p in perms" :key="p" class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{{ $t(`perm.${permKey(p)}.name`) }}</span>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-900">{{ $t('profile.changePassword') }}</h2>
      <AppAlert v-if="error" class="mt-3">{{ error }}</AppAlert>
      <form class="mt-4 max-w-md space-y-4" novalidate @submit.prevent="change">
        <AppInput v-model="current" :label="$t('password.current')" type="password" ltr autocomplete="current-password" :error="errs.current" />
        <AppInput v-model="next" :label="$t('password.new')" type="password" ltr autocomplete="new-password" :hint="$t('password.rule', { n: MIN })" :error="errs.next" />
        <AppInput v-model="again" :label="$t('password.repeat')" type="password" ltr autocomplete="new-password" :error="errs.again" />
        <AppButton type="submit" :loading="loading">{{ $t('common.save') }}</AppButton>
      </form>
    </section>

    <AppButton variant="secondary" @click="session.logout()"><AppIcon name="logout" />{{ $t('auth.logout') }}</AppButton>
  </div>
</template>