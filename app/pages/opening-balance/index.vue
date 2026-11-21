<script setup lang="ts">
import type { FiscalYear, OpeningBalanceReport, OpeningBalanceResult } from '~/types/api'
import {useOpeningText} from "~/composables/useOpeningText.ts";

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const text = useOpeningText()
const fmt = useFormat()
useHead({ title: computed(() => t('menu.openingBalance')) })

const canImport = computed(() => session.can('entries.write') && !session.readOnly)

const years = ref<FiscalYear[]>([])
const yearId = ref('')
const file = ref<File | null>(null)
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const loadError = ref<string | null>(null)

onMounted(async () => {
  try {
    const list = await api.get<FiscalYear[]>('/fiscal-years')
    years.value = list.map((y) => ({ ...y, id: Number(y.id) })).filter((y) => y.status === 'open')
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
    yearId.value = years.value[0] ? String(years.value[0].id) : ''
  } catch (e) {
    loadError.value = errorText.of(e)
  }
})
const yearOptions = computed(() => years.value.map((y) => ({ value: String(y.id), label: y.title })))

// ---- template
const downloading = ref(false)
async function template() {
  downloading.value = true
  try { await api.download('/opening-balance/template') } catch (e) { notify.error(errorText.of(e)) } finally { downloading.value = false }
}

// ---- file
const report = ref<OpeningBalanceReport | null>(null)
const result = ref<OpeningBalanceResult | null>(null)
const fileError = ref<string | null>(null)

function pick(f: File | null | undefined) {
  fileError.value = null
  report.value = null
  result.value = null
  if (!f) { file.value = null; return }
  if (!f.name.toLowerCase().endsWith('.xlsx')) { file.value = null; fileError.value = t('serverMsg.openingFileType'); return }
  if (f.size > 5 * 1024 * 1024) { file.value = null; fileError.value = t('serverMsg.openingFileSize'); return }
  file.value = f
}
function onPick(e: Event) { pick((e.target as HTMLInputElement).files?.[0]) }
function onDrop(e: DragEvent) { dragging.value = false; pick(e.dataTransfer?.files?.[0]) }
watch(yearId, () => { report.value = null; result.value = null })

function formData(): FormData {
  const fd = new FormData()
  fd.append('fiscalYearId', yearId.value)
  fd.append('file', file.value as File)
  return fd
}

// ---- preview
const checking = ref(false)
async function check() {
  if (!file.value || !yearId.value) return
  checking.value = true
  report.value = null
  result.value = null
  fileError.value = null
  try {
    report.value = await api.post<OpeningBalanceReport>('/opening-balance/preview', formData())
  } catch (e) {
    const err = toApiError(e)
    const m = err.field('file')
    if (err.status === 422 && m) fileError.value = errorText.text(m)
    else notify.error(errorText.of(e))
  } finally {
    checking.value = false
  }
}

// ---- import
const confirmOpen = ref(false)
const importing = ref(false)
async function doImport() {
  importing.value = true
  try {
    result.value = await api.post<OpeningBalanceResult>('/opening-balance/import', formData())
    notify.success(t('toast.openingImported'))
    confirmOpen.value = false
    report.value = null
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch (e) {
    confirmOpen.value = false
    notify.error(errorText.of(e))
  } finally {
    importing.value = false
  }
}

const hidden = computed(() => (report.value ? report.value.lineCount - report.value.preview.length : 0))
const hiddenErrors = computed(() => (report.value ? report.value.errorCount - report.value.errors.length : 0))
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.openingBalance') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('opening.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }}</AppAlert>

    <section class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-900">{{ $t('opening.step1') }}</h2>
      <p class="mt-1 text-sm text-slate-600">{{ $t('opening.columnsHint') }}</p>
      <div class="mt-3 overflow-x-auto">
        <table class="text-xs">
          <thead><tr class="bg-slate-50 text-slate-600">
            <th class="border border-slate-200 px-3 py-1.5 font-medium">A · {{ $t('opening.cols.account') }}</th>
            <th class="border border-slate-200 px-3 py-1.5 font-medium">B · {{ $t('opening.cols.detail') }}</th>
            <th class="border border-slate-200 px-3 py-1.5 font-medium">C · {{ $t('opening.cols.debit') }}</th>
            <th class="border border-slate-200 px-3 py-1.5 font-medium">D · {{ $t('opening.cols.credit') }}</th>
          </tr></thead>
        </table>
      </div>
      <div class="mt-4"><AppButton variant="secondary" :loading="downloading" @click="template"><AppIcon name="download" />{{ $t('opening.template') }}</AppButton></div>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-900">{{ $t('opening.step2') }}</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <AppSelect v-model="yearId" :label="$t('opening.year')" :options="yearOptions" :hint="$t('opening.yearHint')" />
      </div>
      <p v-if="!yearOptions.length && !loadError" class="mt-2 text-sm text-amber-700">{{ $t('opening.noYear') }}</p>

      <label class="mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition"
             :class="[dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300', fileError ? 'border-red-300' : '']"
             @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
        <AppIcon name="download" class="rotate-180 text-slate-400" />
        <span class="text-sm font-medium text-slate-700">{{ file ? file.name : $t('opening.drop') }}</span>
        <span class="text-xs text-slate-500">{{ $t('opening.fileHint') }}</span>
        <input ref="fileInput" type="file" class="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onPick">
      </label>
      <p v-if="fileError" class="mt-1 text-xs text-red-600">{{ fileError }}</p>

      <div class="mt-4 flex justify-end">
        <AppButton :loading="checking" :disabled="!file || !yearId" @click="check">{{ $t('opening.check') }}</AppButton>
      </div>
    </section>

    <!-- the report of the check -->
    <section v-if="report" class="space-y-4">
      <AppAlert v-if="report.canImport" kind="success">{{ $t('opening.okNote', { date: fmt.date(report.entryDate) }) }}</AppAlert>
      <AppAlert v-else>{{ $t('opening.badNote', { n: fmt.money(report.errorCount) }) }}</AppAlert>

      <div class="grid gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">{{ $t('opening.entryDate') }}</div><div class="mt-1 font-bold" dir="ltr">{{ fmt.date(report.entryDate) }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">{{ $t('opening.lines') }}</div><div class="mt-1 font-bold tabular-nums">{{ fmt.money(report.lineCount) }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">{{ $t('opening.totalDebit') }}</div><div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(report.totals.debit) }}</div></div>
        <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">{{ $t('opening.totalCredit') }}</div><div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(report.totals.credit) }}</div></div>
      </div>

      <AppAlert v-if="report.warnings.length" kind="warning">
        <ul class="list-disc space-y-0.5 ps-5"><li v-for="(w, i) in report.warnings" :key="i">{{ text.warning(w) }}</li></ul>
      </AppAlert>

      <div v-if="report.errors.length" class="overflow-x-auto rounded-xl border border-red-200 bg-white">
        <div class="border-b border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{{ $t('opening.errorsTitle') }}</div>
        <table class="w-full min-w-120 text-sm">
          <tbody class="divide-y divide-slate-100">
          <tr v-for="(er, i) in report.errors" :key="i">
            <td class="w-24 px-4 py-2 text-slate-500">{{ er.row ? $t('opening.row', { n: fmt.money(er.row) }) : '—' }}</td>
            <td class="px-4 py-2">{{ text.error(er.message) }}</td>
          </tr>
          </tbody>
        </table>
        <p v-if="hiddenErrors > 0" class="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{{ $t('opening.moreErrors', { n: fmt.money(hiddenErrors) }) }}</p>
      </div>

      <div v-if="report.preview.length" class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="w-full min-w-160 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('opening.cols.row') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('opening.cols.account') }}</th>
            <th class="px-4 py-2.5 text-start font-medium">{{ $t('opening.cols.detail') }}</th>
            <th class="px-4 py-2.5 text-end font-medium">{{ $t('opening.cols.debit') }}</th>
            <th class="px-4 py-2.5 text-end font-medium">{{ $t('opening.cols.credit') }}</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
          <tr v-for="l in report.preview" :key="l.row">
            <td class="px-4 py-2 text-slate-500">{{ fmt.money(l.row) }}</td>
            <td class="px-4 py-2"><span class="text-slate-500" dir="ltr">{{ l.accountCode }}</span> {{ l.accountName }}</td>
            <td class="px-4 py-2 text-slate-600">{{ l.detailName ? `${l.detailCode} ${l.detailName}` : '—' }}</td>
            <td class="px-4 py-2 text-end tabular-nums" dir="ltr">{{ l.debit ? fmt.money(l.debit) : '' }}</td>
            <td class="px-4 py-2 text-end tabular-nums" dir="ltr">{{ l.credit ? fmt.money(l.credit) : '' }}</td>
          </tr>
          </tbody>
        </table>
        <p v-if="hidden > 0" class="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{{ $t('opening.moreLines', { n: fmt.money(hidden) }) }}</p>
      </div>

      <div v-if="report.canImport && canImport" class="flex justify-end">
        <AppButton @click="confirmOpen = true">{{ $t('opening.importNow') }}</AppButton>
      </div>
    </section>

    <!-- after the import -->
    <section v-if="result" class="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 class="font-semibold text-emerald-800">{{ $t('opening.doneTitle') }}</h2>
      <p class="text-sm text-emerald-900">{{ $t('opening.doneNote', { n: fmt.money(result.lineCount), total: fmt.money(result.totals.debit) }) }}</p>
      <NuxtLink :to="`/entries/${result.entryId}`" class="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">{{ $t('opening.openEntry') }}</NuxtLink>
    </section>

    <AppModal v-model:open="confirmOpen" :title="$t('opening.confirmTitle')">
      <p class="text-sm text-slate-700">{{ $t('opening.confirmMessage', { date: report ? fmt.date(report.entryDate) : '' }) }}</p>
      <template #footer>
        <AppButton variant="secondary" @click="confirmOpen = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="importing" @click="doImport">{{ $t('opening.importNow') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>