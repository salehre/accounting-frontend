<script setup lang="ts">
import type { JournalEntry } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ entry: JournalEntry | null }>()

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()
const date = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

watch(open, (v) => { if (v) { date.value = ''; error.value = null } })

async function submit() {
  if (!props.entry) return
  busy.value = true
  error.value = null
  try {
    const r = await api.post<JournalEntry>(`/entries/${props.entry.id}/reverse`, date.value ? { date: date.value } : {})
    open.value = false
    notify.success(t('toast.entryReversed'))
    await navigateTo(`/entries/${r.id}`)
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('entries.reverseTitle')">
    <form id="reverse-form" class="space-y-4" novalidate @submit.prevent="submit">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <p class="text-sm text-slate-700">{{ $t('entries.reverseIntro') }}</p>
      <DateInput v-model="date" :label="$t('entries.reverseDate')" :hint="$t('entries.reverseHint')" />
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="reverse-form" :loading="busy">{{ $t('entries.reverse') }}</AppButton>
    </template>
  </AppModal>
</template>