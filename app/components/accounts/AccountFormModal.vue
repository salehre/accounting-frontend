<script setup lang="ts">
import type { Account, AccountNature } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  mode: 'create' | 'edit'
  parent: Account | null     // create: the parent (null = a new top-level group)
  account: Account | null    // edit: the account
}>()
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()

const code = ref('')
const name = ref('')
const nature = ref<AccountNature>('debit')
const requiresDetail = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const level = computed(() => (props.mode === 'edit' ? props.account!.level : (props.parent ? props.parent.level + 1 : 1)))
const inUse = computed(() => props.mode === 'edit' && (props.account!.hasChildren || props.account!.hasEntries))
const parentCode = computed(() => (props.mode === 'edit' ? '' : props.parent?.code ?? ''))

const natureOptions = computed(() =>
    (['debit', 'credit', 'both'] as const).map((v) => ({ value: v, label: t(`accounts.nature.${v}`) })),
)

watch(open, (v) => {
  if (!v) return
  error.value = null
  errs.value = {}
  if (props.mode === 'edit' && props.account) {
    code.value = props.account.code
    name.value = props.account.name
    nature.value = props.account.nature
    requiresDetail.value = props.account.requiresDetail
  } else {
    code.value = props.parent?.code ?? ''
    name.value = ''
    nature.value = props.parent?.nature ?? 'debit'
    requiresDetail.value = false
  }
})

function validate(): boolean {
  errs.value = {}
  const c = normalizeDigits(code.value.trim())
  code.value = c
  if (!/^[0-9]{1,20}$/.test(c)) errs.value.code = t('accounts.errors.codeDigits')
  else if (props.mode === 'create' && props.parent && (c.length <= parentCode.value.length || !c.startsWith(parentCode.value)))
    errs.value.code = t('accounts.errors.codeParent', { code: parentCode.value })
  if (!name.value.trim()) errs.value.name = t('accounts.errors.nameRequired')
  else if (name.value.length > 150) errs.value.name = t('accounts.errors.nameLong')
  return !Object.values(errs.value).some(Boolean)
}

async function save() {
  error.value = null
  if (!validate()) return
  saving.value = true
  let message: string | null = null
  try {
    if (props.mode === 'create') {
      await api.post('/accounts', {
        level: level.value,
        parentId: props.parent?.id ?? null,
        code: code.value,
        name: name.value.trim(),
        nature: nature.value,
        requiresDetail: level.value === 3 ? requiresDetail.value : false,
      })
      message = t('toast.accountCreated', { name: name.value.trim() })
    } else {
      const a = props.account!
      const body: Record<string, unknown> = {}
      if (name.value.trim() !== a.name) body.name = name.value.trim()
      if (!inUse.value) {
        if (code.value !== a.code) body.code = code.value
        if (nature.value !== a.nature) body.nature = nature.value
        if (level.value === 3 && requiresDetail.value !== a.requiresDetail) body.requiresDetail = requiresDetail.value
      }
      if (Object.keys(body).length > 0) {
        await api.patch('/accounts/' + a.id, body)
        message = t('toast.accountUpdated', { name: name.value.trim() })
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
  <AppModal v-model:open="open" :title="mode === 'create' ? $t('accounts.addTitle', { level: $t(`accounts.level.${level}`) }) : $t('accounts.editTitle')">
    <form id="account-form" class="space-y-4" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>

      <p v-if="mode === 'create' && parent" class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {{ $t('accounts.under') }}: <span dir="ltr" class="font-mono">{{ parent.code }}</span> — {{ parent.name }}
      </p>
      <AppAlert v-if="inUse" kind="info">{{ $t('accounts.inUseNote') }}</AppAlert>

      <AppInput v-model="code" :label="$t('accounts.code')" ltr :disabled="inUse" :error="errs.code"
                :hint="mode === 'create' && parent ? $t('accounts.codeHint', { code: parent.code }) : $t('accounts.codeDigitsHint')" />
      <AppInput v-model="name" :label="$t('accounts.name')" :error="errs.name" :autofocus="true" />
      <AppSelect v-model="nature" :label="$t('accounts.natureLabel')" :options="natureOptions" :disabled="inUse" :error="errs.nature" />

      <label v-if="level === 3" class="flex items-start gap-2 text-sm text-slate-700">
        <input v-model="requiresDetail" type="checkbox" :disabled="inUse" class="mt-0.5 size-4 rounded border-slate-300">
        <span>
          {{ $t('accounts.requiresDetail') }}
          <span class="block text-xs text-slate-500">{{ $t('accounts.requiresDetailHint') }}</span>
        </span>
      </label>
      <p v-if="errs.requiresDetail" class="text-xs text-red-600">{{ errs.requiresDetail }}</p>
    </form>

    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="account-form" :loading="saving">{{ $t('common.save') }}</AppButton>
    </template>
  </AppModal>
</template>