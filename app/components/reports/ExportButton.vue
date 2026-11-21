<script setup lang="ts">
/** "Excel" button of a report: downloads the same report, with the filters that are on the screen. */
const props = defineProps<{ path: string; query: Record<string, unknown> | null }>()

const { locale, t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()

const busy = ref(false)
const error = ref<string | null>(null)
const visible = computed(() => session.can('reports.export'))

async function exportIt() {
  if (!props.query) return
  busy.value = true
  error.value = null
  try {
    // the sheet follows the language: Jalali dates in Persian, Gregorian in the other languages
    await api.download(props.path, { ...props.query, calendar: locale.value === 'fa' ? 'jalali' : 'gregorian' })
    notify.success(t('toast.exported'))
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span v-if="visible" class="inline-flex flex-col items-end gap-1">
    <AppButton variant="secondary" :loading="busy" :disabled="!query" @click="exportIt"><AppIcon name="download" />{{ $t('reports.exportExcel') }}</AppButton>
    <span v-if="error" class="text-xs text-red-600">{{ error }}</span>
  </span>
</template>