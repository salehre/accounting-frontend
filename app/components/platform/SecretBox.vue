<script setup lang="ts">
/** A value that is shown only once (a license key, a first password), with a button to copy it. */
const props = defineProps<{ value: string }>()
const { t } = useI18n()
const notify = useNotify()

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    notify.success(t('platform.copied'))
  } catch {
    notify.warning(t('platform.copyFailed'))
  }
}
</script>

<template>
  <div class="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-2">
    <code class="min-w-0 flex-1 select-all break-all px-1 font-mono text-sm text-slate-900" dir="ltr">{{ value }}</code>
    <AppButton variant="secondary" @click="copy">{{ $t('platform.copy') }}</AppButton>
  </div>
</template>