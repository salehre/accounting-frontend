<script setup lang="ts">
import type { Role, UserItem } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ user: UserItem | null; roles: Role[] }>()
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const roleLabel = useRoleLabel()

const username = ref('')
const fullName = ref('')
const password = ref('')
const roleId = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const editing = computed(() => props.user !== null)
const isSelf = computed(() => props.user?.id === session.user?.id)
const roleOptions = computed(() => props.roles.map((r) => ({ value: String(r.id), label: roleLabel(r.name) })))

watch(open, (v) => {
  if (!v) return
  error.value = null
  errs.value = {}
  password.value = ''
  username.value = props.user?.username ?? ''
  fullName.value = props.user?.fullName ?? ''
  roleId.value = String(props.user?.roleId ?? props.roles.find((r) => r.name === 'viewer')?.id ?? props.roles[0]?.id ?? '')
})

function validate(): boolean {
  errs.value = {}
  if (!editing.value) {
    const u = username.value.trim().toLowerCase()
    username.value = u
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(u)) errs.value.username = t('users.errors.username')
    if (password.value.length < 10) errs.value.password = t('users.errors.passwordShort')
    else if (byteLength(password.value) > 72) errs.value.password = t('users.errors.passwordLong')
  }
  if (!fullName.value.trim()) errs.value.fullName = t('users.errors.nameRequired')
  else if (fullName.value.length > 150) errs.value.fullName = t('users.errors.nameLong')
  if (!roleId.value) errs.value.roleId = t('users.errors.roleRequired')
  return !Object.values(errs.value).some(Boolean)
}

async function save() {
  error.value = null
  if (!validate()) return
  saving.value = true
  let message: string | null = null
  try {
    if (!props.user) {
      await api.post('/users', { username: username.value, fullName: fullName.value.trim(), password: password.value, roleId: Number(roleId.value) })
      message = t('toast.userCreated', { name: fullName.value.trim() })
    } else {
      const body: Record<string, unknown> = {}
      if (fullName.value.trim() !== props.user.fullName) body.fullName = fullName.value.trim()
      if (Number(roleId.value) !== props.user.roleId) body.roleId = Number(roleId.value)
      if (Object.keys(body).length > 0) {
        await api.patch(`/users/${props.user.id}`, body)
        message = t('toast.userUpdated', { name: fullName.value.trim() })
      }
    }
    open.value = false
    emit('saved')
    if (message) notify.success(message)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && Object.keys(err.errors).length > 0) {
      for (const [field, msgs] of Object.entries(err.errors)) errs.value[field] = errorText.text(msgs[0] ?? '')
    } else {
      error.value = errorText.of(e)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="editing ? $t('users.editTitle') : $t('users.newTitle')">
    <form id="user-form" class="space-y-4" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <AppInput v-model="username" ltr autocomplete="off" :label="$t('users.username')" :disabled="editing" :error="errs.username" :hint="editing ? $t('users.usernameFixed') : $t('users.usernameHint')" />
      <AppInput v-model="fullName" :label="$t('users.fullName')" :error="errs.fullName" />
      <PasswordField v-if="!editing" v-model="password" :label="$t('users.password')" :error="errs.password" :hint="$t('users.passwordHint')" />
      <AppSelect v-model="roleId" :label="$t('users.role')" :options="roleOptions" :disabled="isSelf" :error="errs.roleId" :hint="isSelf ? $t('users.selfRole') : undefined" />
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="user-form" :loading="saving">{{ $t('common.save') }}</AppButton>
    </template>
  </AppModal>
</template>