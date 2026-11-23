<script setup lang="ts">
/** "Excel" and "CSV" buttons of a report: download the same report, with the filters that are on the screen. */
const props = defineProps<{ path: string; query: Record<string, unknown> | null }>()

const { locale, t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()

const busy = ref<'xlsx' | 'csv' | null>(null)
const visible = computed(() => session.can('reports.export'))

async function exportIt(format: 'xlsx' | 'csv') {
  if (!props.query) return
  busy.value = format
  try {
    // the file follows the language: Jalali dates in Persian, Gregorian in the other languages
    await api.download(props.path, { ...props.query, calendar: locale.value === 'fa' ? 'jalali' : 'gregorian', format, rtl: locale.value !== 'en' ? 1 : 0 })
    notify.success(t('toast.exported'))
  } catch (e) {
    notify.error(errorText.of(e))
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <span v-if="visible" class="inline-flex items-start gap-2">
    <AppButton variant="secondary" :loading="busy === 'xlsx'" :disabled="!query || busy !== null" @click="exportIt('xlsx')"><AppIcon name="download" />{{ $t('reports.exportExcel') }}</AppButton>
    <AppButton variant="secondary" :loading="busy === 'csv'" :disabled="!query || busy !== null" @click="exportIt('csv')"><AppIcon name="download" />CSV</AppButton>
  </span>
</template>