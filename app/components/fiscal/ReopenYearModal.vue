<script setup lang="ts">
import type { FiscalYear } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ year: FiscalYear | null }>()
const emit = defineEmits<{ reopened: [] }>()

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
  if (!props.year) return
  reasonError.value = null
  error.value = null
  if (reason.value.trim().length < 10) { reasonError.value = t('fiscal.reasonShort'); return }
  busy.value = true
  try {
    await api.post(`/fiscal-years/${props.year.id}/reopen`, { reason: reason.value.trim() })
    notify.success(t('toast.yearReopened', { title: props.year.title }))
    open.value = false
    emit('reopened')
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && err.field('reason')) reasonError.value = t('fiscal.reasonShort')
    else error.value = errorText.of(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('fiscal.reopenTitle', { title: year?.title ?? '' })">
    <form id="reopen-form" class="space-y-4" novalidate @submit.prevent="submit">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <AppAlert kind="warning">{{ $t('fiscal.reopenWarning') }}</AppAlert>
      <div>
        <label for="reopen-reason" class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('fiscal.reason') }}</label>
        <textarea id="reopen-reason" v-model="reason" rows="3" maxlength="500"
                  class="block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                  :class="reasonError ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'" />
        <p class="mt-1 text-xs" :class="reasonError ? 'text-red-600' : 'text-slate-500'">{{ reasonError ?? $t('fiscal.reasonHint') }}</p>
      </div>
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="reopen-form" :loading="busy">{{ $t('fiscal.reopen') }}</AppButton>
    </template>
  </AppModal>
</template>