<script setup lang="ts">
import type { CloseCheck, FiscalYear } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ year: FiscalYear | null }>()
const emit = defineEmits<{ closed: [] }>()

const { t, te } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()

const check = ref<CloseCheck | null>(null)
const loading = ref(false)
const closing = ref(false)
const error = ref<string | null>(null)

async function loadCheck() {
  if (!props.year) return
  loading.value = true
  error.value = null
  check.value = null
  try {
    check.value = await api.get<CloseCheck>(`/fiscal-years/${props.year.id}/close-check`)
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
watch(open, (v) => { if (v) loadCheck() })

function blockerText(b: CloseCheck['blockers'][number]): string {
  const key = `fiscal.blockers.${b.code}`
  return te(key) ? t(key, { n: fmt.money(b.count ?? 0) }) : b.message
}
function warningText(w: CloseCheck['warnings'][number]): string {
  const key = `fiscal.warnings.${w.code}`
  if (!te(key)) return w.message
  const title = /"(.+)"/.exec(w.message)?.[1] ?? ''
  return t(key, { title })
}

async function doClose() {
  if (!props.year) return
  closing.value = true
  error.value = null
  try {
    await api.post(`/fiscal-years/${props.year.id}/close`)
    open.value = false
    emit('closed')
  } catch (e) {
    error.value = errorText.of(e)
    await loadCheck() // the situation changed: show the new blockers
  } finally {
    closing.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('fiscal.closeTitle', { title: year?.title ?? '' })">
    <div class="space-y-4">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <p v-if="loading" class="py-6 text-center text-sm text-slate-500">{{ $t('common.loading') }}</p>

      <template v-if="check">
        <div v-if="check.blockers.length" class="space-y-2">
          <h3 class="text-sm font-semibold text-red-700">{{ $t('fiscal.blockersTitle') }}</h3>
          <AppAlert v-for="b in check.blockers" :key="b.code">
            {{ blockerText(b) }}
            <ul v-if="b.entries?.length" class="mt-2 list-disc space-y-0.5 ps-5 text-xs">
              <li v-for="e in b.entries" :key="e.id">
                <span dir="ltr">{{ fmt.date(e.entryDate) }}</span> — {{ e.description || $t('fiscal.noDescription') }}
              </li>
            </ul>
          </AppAlert>
        </div>

        <div v-if="check.warnings.length" class="space-y-2">
          <h3 class="text-sm font-semibold text-amber-700">{{ $t('fiscal.warningsTitle') }}</h3>
          <AppAlert v-for="w in check.warnings" :key="w.code" kind="warning">{{ warningText(w) }}</AppAlert>
        </div>

        <dl class="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.posted') }}</dt><dd class="font-semibold">{{ fmt.money(check.summary.postedEntries) }}</dd></div>
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.drafts') }}</dt><dd class="font-semibold">{{ fmt.money(check.summary.draftEntries) }}</dd></div>
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.totalDebit') }}</dt><dd class="font-semibold" dir="ltr">{{ fmt.money(check.summary.totalDebit) }}</dd></div>
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.totalCredit') }}</dt><dd class="font-semibold" dir="ltr">{{ fmt.money(check.summary.totalCredit) }}</dd></div>
        </dl>
        <p v-if="check.canClose" class="text-sm text-slate-700">{{ $t('fiscal.closeNote') }}</p>
      </template>
    </div>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton :loading="closing" :disabled="!check?.canClose" @click="doClose">{{ $t('fiscal.close') }}</AppButton>
    </template>
  </AppModal>
</template>