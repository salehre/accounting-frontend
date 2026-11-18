<script setup lang="ts">
import { DETAIL_KINDS, type DetailAccount, type DetailKind } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ account: DetailAccount | null }>() // null = create
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()

const code = ref('')
const name = ref('')
const kind = ref<DetailKind>('customer')
const saving = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const kindOptions = computed(() => DETAIL_KINDS.map((k) => ({ value: k, label: t(`detail.kind.${k}`) })))

watch(open, (v) => {
  if (!v) return
  error.value = null
  errs.value = {}
  code.value = props.account?.code ?? ''
  name.value = props.account?.name ?? ''
  kind.value = props.account?.kind ?? 'customer'
})

function validate(): boolean {
  errs.value = {}
  code.value = code.value.trim()
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(code.value)) errs.value.code = t('detail.errors.code')
  if (!name.value.trim()) errs.value.name = t('detail.errors.nameRequired')
  else if (name.value.length > 150) errs.value.name = t('detail.errors.nameLong')
  return !Object.values(errs.value).some(Boolean)
}

async function save() {
  error.value = null
  if (!validate()) return
  saving.value = true
  try {
    if (!props.account) {
      await api.post('/detail-accounts', { code: code.value, name: name.value.trim(), kind: kind.value })
    } else {
      const a = props.account
      const body: Record<string, unknown> = {}
      if (code.value !== a.code) body.code = code.value
      if (name.value.trim() !== a.name) body.name = name.value.trim()
      if (kind.value !== a.kind) body.kind = kind.value
      if (Object.keys(body).length > 0) await api.patch('/detail-accounts/' + a.id, body)
    }
    open.value = false
    emit('saved')
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
  <AppModal v-model:open="open" :title="account ? $t('detail.editTitle') : $t('detail.addTitle')">
    <form id="detail-form" class="space-y-4" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <AppInput v-model="code" :label="$t('detail.code')" ltr :error="errs.code" :hint="$t('detail.codeHint')" />
      <AppInput v-model="name" :label="$t('detail.name')" :error="errs.name" :autofocus="true" />
      <AppSelect v-model="kind" :label="$t('detail.kindLabel')" :options="kindOptions" :error="errs.kind" />
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="detail-form" :loading="saving">{{ $t('common.save') }}</AppButton>
    </template>
  </AppModal>
</template>