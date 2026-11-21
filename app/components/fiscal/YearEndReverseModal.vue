<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ fiscalYearId: number }>()
const emit = defineEmits<{ done: [] }>()

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()

const reason = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const reasonError = ref<string | null>(null)

watch(open, (v) => { if (v) { reason.value = ''; error.value = null; reasonError.value = null } })

async function submit() {
  error.value = null
  reasonError.value = null
  if (!reason.value.trim()) { reasonError.value = t('yearEnd.reasonShort'); return }
  busy.value = true
  try {
    await api.post(`/fiscal-years/${props.fiscalYearId}/year-end/reverse`, { reason: reason.value.trim() })
    notify.success(t('toast.yearEndReversed'))
    open.value = false
    emit('done')
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && err.field('reason')) reasonError.value = t('yearEnd.reasonShort')
    else error.value = errorText.of(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('yearEnd.reverseTitle')">
    <form id="ye-reverse-form" class="space-y-4" novalidate @submit.prevent="submit">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <AppAlert kind="warning">{{ $t('yearEnd.reverseWarning') }}</AppAlert>
      <div>
        <label for="ye-reason" class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('yearEnd.reason') }}</label>
        <textarea id="ye-reason" v-model="reason" rows="3" maxlength="500"
                  class="block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                  :class="reasonError ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'" />
        <p class="mt-1 text-xs" :class="reasonError ? 'text-red-600' : 'text-slate-500'">{{ reasonError ?? $t('yearEnd.reasonHint') }}</p>
      </div>
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="ye-reverse-form" variant="danger" :loading="busy">{{ $t('yearEnd.reverse') }}</AppButton>
    </template>
  </AppModal>
</template>