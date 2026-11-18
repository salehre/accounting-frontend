<script setup lang="ts">
import type { FiscalYear } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ year: FiscalYear | null }>() // null = create
const emit = defineEmits<{ saved: [warnings: string[]] }>()

const { t } = useI18n()
const api = useApi()
const errorText = useErrorText()

const title = ref('')
const startDate = ref('')
const endDate = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

/** The dates are frozen once the year has entries or is closed (the backend refuses them too) */
const datesLocked = computed(() => !!props.year && (props.year.hasEntries || props.year.status === 'closed'))

watch(open, (v) => {
  if (!v) return
  error.value = null
  errs.value = {}
  title.value = props.year?.title ?? ''
  startDate.value = props.year?.startDate ?? ''
  endDate.value = props.year?.endDate ?? ''
})

function validate(): boolean {
  errs.value = {}
  if (!title.value.trim()) errs.value.title = t('fiscal.errors.titleRequired')
  else if (title.value.length > 100) errs.value.title = t('fiscal.errors.titleLong')
  if (!startDate.value) errs.value.startDate = t('fiscal.errors.dateRequired')
  if (!endDate.value) errs.value.endDate = t('fiscal.errors.dateRequired')
  if (startDate.value && endDate.value && endDate.value <= startDate.value) errs.value.endDate = t('fiscal.errors.endAfterStart')
  return !Object.values(errs.value).some(Boolean)
}

async function save() {
  error.value = null
  if (!validate()) return
  saving.value = true
  try {
    let warnings: string[] = []
    if (!props.year) {
      const r = await api.post<{ warnings?: string[] }>('/fiscal-years', {
        title: title.value.trim(), startDate: startDate.value, endDate: endDate.value,
      })
      warnings = r.warnings ?? []
    } else {
      const y = props.year
      const body: Record<string, unknown> = {}
      if (title.value.trim() !== y.title) body.title = title.value.trim()
      if (!datesLocked.value) {
        if (startDate.value !== y.startDate) body.startDate = startDate.value
        if (endDate.value !== y.endDate) body.endDate = endDate.value
      }
      if (Object.keys(body).length > 0) {
        const r = await api.patch<{ warnings?: string[] }>('/fiscal-years/' + y.id, body)
        warnings = r.warnings ?? []
      }
    }
    open.value = false
    emit('saved', warnings)
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
  <AppModal v-model:open="open" :title="year ? $t('fiscal.editTitle') : $t('fiscal.addTitle')">
    <form id="fiscal-form" class="space-y-4" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <AppAlert v-if="datesLocked" kind="info">{{ $t('fiscal.datesLockedNote') }}</AppAlert>
      <AppInput v-model="title" :label="$t('fiscal.title')" :error="errs.title" :hint="$t('fiscal.titleHint')" :autofocus="true" />
      <DateInput v-model="startDate" :label="$t('fiscal.start')" :error="errs.startDate" :disabled="datesLocked" />
      <DateInput v-model="endDate" :label="$t('fiscal.end')" :error="errs.endDate" :disabled="datesLocked" />
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="fiscal-form" :loading="saving">{{ $t('common.save') }}</AppButton>
    </template>
  </AppModal>
</template>