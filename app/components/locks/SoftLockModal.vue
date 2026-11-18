<script setup lang="ts">
import type { PeriodLockStatus } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ current: string | null }>()
const emit = defineEmits<{ saved: [status: PeriodLockStatus] }>()

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()

const date = ref('')
const reason = ref('')
const removing = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string>>({})

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

watch(open, (v) => {
  if (!v) return
  date.value = props.current ?? ''
  reason.value = ''
  removing.value = false
  error.value = null
  errs.value = {}
})

async function save() {
  error.value = null
  errs.value = {}
  if (!removing.value) {
    if (!date.value) errs.value.date = t('locks.soft.dateRequired')
    else if (date.value > todayIso()) errs.value.date = t('locks.notFuture')
    else if (date.value === props.current) errs.value.date = t('locks.soft.sameDate')
  }
  if (reason.value.trim().length < 10) errs.value.reason = t('locks.reasonShort')
  if (Object.keys(errs.value).length) return

  saving.value = true
  try {
    const status = await api.put<PeriodLockStatus>('/period-locks/soft', {
      date: removing.value ? null : date.value,
      reason: reason.value.trim(),
    })
    open.value = false
    emit('saved', status)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && Object.keys(err.errors).length) {
      for (const [k, msgs] of Object.entries(err.errors)) errs.value[k] = errorText.text(msgs[0] ?? '')
    } else {
      error.value = errorText.of(e)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('locks.soft.title')">
    <form class="space-y-4" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <p class="text-sm text-slate-600">{{ $t('locks.soft.explain') }}</p>
      <p v-if="current" class="text-sm text-slate-700">
        {{ $t('locks.soft.currently') }}: <b dir="ltr">{{ fmt.date(current) }}</b>
      </p>

      <label v-if="current" class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="removing" type="checkbox" class="size-4 rounded border-slate-300">
        {{ $t('locks.soft.remove') }}
      </label>

      <DateInput v-if="!removing" v-model="date" :label="$t('locks.soft.date')" :error="errs.date" />
      <AppInput v-model="reason" :label="$t('locks.reason')" :error="errs.reason" :hint="$t('locks.reasonHint')" />
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton :loading="saving" @click="save">{{ removing ? $t('locks.soft.removeBtn') : $t('common.save') }}</AppButton>
    </template>
  </AppModal>
</template>