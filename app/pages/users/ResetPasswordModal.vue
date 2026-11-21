<script setup lang="ts">
import type { UserItem } from '~/types/api'
import PasswordField from "~/pages/users/PasswordField.vue";

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ user: UserItem | null }>()

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()

const password = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const passwordError = ref<string | null>(null)

watch(open, (v) => { if (v) { password.value = ''; error.value = null; passwordError.value = null } })

async function save() {
  if (!props.user) return
  error.value = null
  passwordError.value = null
  if (password.value.length < 10) { passwordError.value = t('users.errors.passwordShort'); return }
  if (byteLength(password.value) > 72) { passwordError.value = t('users.errors.passwordLong'); return }
  saving.value = true
  try {
    await api.post(`/users/${props.user.id}/reset-password`, { newPassword: password.value })
    open.value = false
    notify.success(t('toast.passwordReset', { name: props.user.fullName }))
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && err.field('newPassword')) passwordError.value = errorText.text(err.field('newPassword') ?? '')
    else error.value = errorText.of(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('users.resetTitle', { name: user?.fullName ?? '' })">
    <form id="reset-form" class="space-y-4" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <p class="text-sm text-slate-600">{{ $t('users.resetIntro') }}</p>
      <PasswordField v-model="password" :label="$t('users.newPassword')" :error="passwordError" :hint="$t('users.passwordHint')" />
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="reset-form" :loading="saving">{{ $t('users.resetBtn') }}</AppButton>
    </template>
  </AppModal>
</template>