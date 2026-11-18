<script setup lang="ts">
import type { Account, ComboOption, FiscalYear, JournalEntry } from '~/types/api'

interface FormLine {
  key: number
  accountId: number | null
  detailId: number | null
  detailLabel: string
  description: string
  debit: number | null
  credit: number | null
}

const { t } = useI18n()
const api = useApi()
const route = useRoute()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
const flash = useState<{ kind: 'error' | 'warning'; text: string } | null>('flash', () => null)
useHead({ title: computed(() => t('entries.form.title')) })

const fromId = computed(() => (route.query.from ? Number(route.query.from) : null))
const replace = computed(() => route.query.replace === '1')
const canPost = computed(() => session.can('entries.post'))

const years = ref<FiscalYear[]>([])
const accounts = ref<Account[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const yearId = ref('')
const entryDate = ref('')
const description = ref('')
let keySeq = 0
const blank = (): FormLine => ({ key: ++keySeq, accountId: null, detailId: null, detailLabel: '', description: '', debit: null, credit: null })
const lines = ref<FormLine[]>([blank(), blank()])

const saving = ref(false)
const error = ref<string | null>(null)
const fieldErrs = ref<Record<string, string>>({})
const lineErrs = ref<Record<number, string>>({})

const year = computed(() => years.value.find((y) => String(y.id) === yearId.value) ?? null)
const yearOptions = computed(() => years.value.map((y) => ({ value: String(y.id), label: `${y.title}  (${fmt.date(y.startDate)} – ${fmt.date(y.endDate)})` })))
const accountById = computed(() => new Map(accounts.value.map((a) => [a.id, a])))
const accountOptions = computed<ComboOption[]>(() => accounts.value.map((a) => ({ value: a.id, label: a.name, sub: a.code })))

const totalDebit = computed(() => lines.value.reduce((s, l) => s + (l.debit ?? 0), 0))
const totalCredit = computed(() => lines.value.reduce((s, l) => s + (l.credit ?? 0), 0))
const diff = computed(() => totalDebit.value - totalCredit.value)
const balanced = computed(() => diff.value === 0 && totalDebit.value > 0)

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function defaultDate(y: FiscalYear | null): string {
  if (!y) return ''
  const today = todayIso()
  return today >= y.startDate && today <= y.endDate ? today : y.startDate
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [ys, accs] = await Promise.all([
      api.get<FiscalYear[]>('/fiscal-years'),
      api.get<Account[]>('/accounts', { activeOnly: 1 }),
    ])
    years.value = ys.filter((y) => y.status === 'open').map((y) => ({ ...y, id: Number(y.id) }))
    accounts.value = accs.map((a) => ({ ...a, id: Number(a.id) })).filter((a) => a.isPostable)

    if (fromId.value) {
      const e = await api.get<JournalEntry>(`/entries/${fromId.value}`)
      if (years.value.some((y) => y.id === Number(e.fiscalYearId))) yearId.value = String(e.fiscalYearId)
      entryDate.value = e.entryDate
      description.value = e.description ?? ''
      lines.value = e.lines.map((l) => ({
        key: ++keySeq,
        accountId: Number(l.accountId),
        detailId: l.detailId === null ? null : Number(l.detailId),
        detailLabel: l.detailName ?? '',
        description: l.description ?? '',
        debit: Number(l.debit) || null,
        credit: Number(l.credit) || null,
      }))
    }
    if (!yearId.value && years.value.length) {
      const today = todayIso()
      const current = years.value.find((y) => today >= y.startDate && today <= y.endDate) ?? years.value[0]!
      yearId.value = String(current.id)
    }
    if (!entryDate.value) entryDate.value = defaultDate(year.value)
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

watch(yearId, () => {
  const y = year.value
  if (y && (!entryDate.value || entryDate.value < y.startDate || entryDate.value > y.endDate)) entryDate.value = defaultDate(y)
})

function addLine(focus = false) {
  const l = blank()
  if (diff.value > 0) l.credit = diff.value
  else if (diff.value < 0) l.debit = -diff.value
  lines.value.push(l)
  if (focus) nextTick(() => document.querySelector<HTMLInputElement>(`[data-line="${lines.value.length - 1}"] input`)?.focus())
}
function removeLine(i: number) { if (lines.value.length > 2) lines.value.splice(i, 1) }
function onAmountEnter(i: number) {
  const l = lines.value[i]!
  if (i === lines.value.length - 1 && (l.debit || l.credit) && l.accountId) addLine(true)
}
function onAccountChange(l: FormLine) { l.detailId = null; l.detailLabel = '' }
// a line has either a debit or a credit: typing in one clears the other
function onDebit(l: FormLine, v: number | null) { l.debit = v; if (v) l.credit = null }
function onCredit(l: FormLine, v: number | null) { l.credit = v; if (v) l.debit = null }

/** Returns the lines to send, or null when something is wrong (errors are then shown) */
function validate(forPost: boolean): FormLine[] | null {
  fieldErrs.value = {}
  lineErrs.value = {}
  error.value = null
  let ok = true

  if (!year.value) { fieldErrs.value.fiscalYearId = t('entries.form.yearRequired'); ok = false }
  if (!entryDate.value) { fieldErrs.value.entryDate = t('entries.form.dateRequired'); ok = false }
  else if (year.value && (entryDate.value < year.value.startDate || entryDate.value > year.value.endDate)) {
    fieldErrs.value.entryDate = t('entries.form.dateOutOfYear'); ok = false
  }

  // completely empty rows are ignored
  const used = lines.value.filter((l) => l.accountId !== null || l.debit || l.credit || l.description.trim() || l.detailId !== null)
  if (used.length < 2) { error.value = t('entries.form.minLines'); return null }

  used.forEach((l) => {
    const idx = lines.value.indexOf(l)
    const acc = l.accountId === null ? null : accountById.value.get(l.accountId)
    if (!acc) lineErrs.value[idx] = t('entries.form.accountRequired')
    else if (!!l.debit === !!l.credit) lineErrs.value[idx] = t('entries.form.amountOne')
    else if (acc.requiresDetail && l.detailId === null) lineErrs.value[idx] = t('entries.form.detailRequired')
  })
  if (Object.keys(lineErrs.value).length) ok = false

  if (forPost && ok && !balanced.value) { error.value = t('entries.form.cannotPostUnbalanced'); ok = false }
  return ok ? used : null
}

function showServerErrors(e: unknown) {
  const err = toApiError(e)
  if (err.status === 422 && Object.keys(err.errors).length) {
    const rest: string[] = []
    for (const [key, msgs] of Object.entries(err.errors)) {
      const text = errorText.text(msgs[0] ?? '')
      const m = /^lines\.(\d+)/.exec(key)
      if (m) lineErrs.value[Number(m[1])] = text
      else if (key === 'fiscalYearId' || key === 'entryDate') fieldErrs.value[key] = text
      else rest.push(text)
    }
    if (rest.length) error.value = rest.join(' ')
    else if (!Object.keys(fieldErrs.value).length && !Object.keys(lineErrs.value).length) error.value = errorText.of(e)
  } else {
    error.value = errorText.of(e)
  }
}

async function save(post: boolean) {
  const used = validate(post)
  if (!used) return
  saving.value = true
  const body = {
    fiscalYearId: Number(yearId.value),
    entryDate: entryDate.value,
    description: description.value.trim() || null,
    lines: used.map((l) => ({
      accountId: l.accountId,
      detailId: l.detailId,
      description: l.description.trim() || null,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
    })),
  }
  let created: JournalEntry
  try {
    // editing a draft updates it in place (same id); otherwise a new draft is created
    created = replace.value && fromId.value
        ? await api.put<JournalEntry>(`/entries/${fromId.value}`, body)
        : await api.post<JournalEntry>('/entries', body)
  } catch (e) {
    showServerErrors(e)
    saving.value = false
    return
  }

  if (post) {
    try { await api.post(`/entries/${created.id}/post`) } catch (e) {
      flash.value = { kind: 'error', text: t('entries.form.postFailedNote', { reason: errorText.of(e) }) }
    }
  }
  saving.value = false
  await navigateTo(`/entries/${created.id}`)
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ replace ? $t('entries.form.titleEdit') : $t('entries.form.title') }}</h1>
      <p v-if="replace" class="mt-1 text-sm text-slate-600">{{ $t('entries.form.editingNote') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>
    <AppAlert v-else-if="years.length === 0" kind="warning">
      {{ $t('entries.form.noOpenYear') }} <NuxtLink to="/fiscal-years" class="underline">{{ $t('menu.fiscalYears') }}</NuxtLink>
    </AppAlert>

    <form v-else class="space-y-4" novalidate @submit.prevent>
      <AppAlert v-if="error">{{ error }}</AppAlert>

      <div class="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <AppSelect v-model="yearId" :label="$t('entries.form.year')" :options="yearOptions" :error="fieldErrs.fiscalYearId" />
        <DateInput v-model="entryDate" :label="$t('entries.form.date')" :error="fieldErrs.entryDate" />
        <div class="sm:col-span-2">
          <AppInput v-model="description" :label="$t('entries.form.description')" />
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div class="min-w-[920px]">
          <div class="grid grid-cols-[2.5rem_minmax(220px,2fr)_minmax(170px,1.4fr)_minmax(140px,1.4fr)_9.5rem_9.5rem_2.5rem] gap-2 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500">
            <span>#</span><span>{{ $t('entries.form.account') }}</span><span>{{ $t('entries.form.detail') }}</span><span>{{ $t('entries.form.lineDescription') }}</span>
            <span class="text-end">{{ $t('entries.form.debit') }}</span><span class="text-end">{{ $t('entries.form.credit') }}</span><span />
          </div>
          <div v-for="(l, i) in lines" :key="l.key" :data-line="i" class="border-t border-slate-100 px-3 py-2">
            <div class="grid grid-cols-[2.5rem_minmax(220px,2fr)_minmax(170px,1.4fr)_minmax(140px,1.4fr)_9.5rem_9.5rem_2.5rem] items-center gap-2">
              <span class="text-sm text-slate-500">{{ fmt.money(i + 1) }}</span>
              <ComboBox v-model="l.accountId" :options="accountOptions" :invalid="!!lineErrs[i]" :aria-label="$t('entries.form.account')"
                        :placeholder="$t('entries.form.searchAccount')" @update:model-value="onAccountChange(l)" />
              <DetailPicker v-model="l.detailId" :initial-label="l.detailLabel" :aria-label="$t('entries.form.detail')"
                            :invalid="!!l.accountId && !!accountById.get(l.accountId)?.requiresDetail && l.detailId === null"
                            :placeholder="accountById.get(l.accountId ?? -1)?.requiresDetail ? $t('entries.form.detailRequiredShort') : $t('entries.form.optional')" />
              <input v-model="l.description" type="text" :aria-label="$t('entries.form.lineDescription')"
                     class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
              <MoneyInput :model-value="l.debit" :aria-label="$t('entries.form.debit')" :invalid="!!lineErrs[i]" @update:model-value="onDebit(l, $event)" @keydown.enter.prevent="onAmountEnter(i)" />
              <MoneyInput :model-value="l.credit" :aria-label="$t('entries.form.credit')" :invalid="!!lineErrs[i]" @update:model-value="onCredit(l, $event)" @keydown.enter.prevent="onAmountEnter(i)" />
              <button type="button" class="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30" :disabled="lines.length <= 2"
                      :title="$t('entries.form.removeLine')" @click="removeLine(i)"><AppIcon name="trash" /></button>
            </div>
            <p v-if="lineErrs[i]" class="mt-1 ps-10 text-xs text-red-600">{{ lineErrs[i] }}</p>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-3">
            <AppButton variant="secondary" @click="addLine(true)"><AppIcon name="plus" />{{ $t('entries.form.addLine') }}</AppButton>
            <div class="flex items-center gap-6 text-sm">
              <span class="text-slate-500">{{ $t('entries.form.totalDebit') }}: <b class="text-slate-900" dir="ltr">{{ fmt.money(totalDebit) }}</b></span>
              <span class="text-slate-500">{{ $t('entries.form.totalCredit') }}: <b class="text-slate-900" dir="ltr">{{ fmt.money(totalCredit) }}</b></span>
              <span v-if="balanced" class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{{ $t('entries.form.balanced') }}</span>
              <span v-else class="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">{{ $t('entries.form.difference') }}: <span dir="ltr">{{ fmt.money(Math.abs(diff)) }}</span></span>
            </div>
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-500">{{ $t('entries.form.hint') }}</p>

      <div class="flex flex-wrap justify-end gap-3">
        <NuxtLink to="/entries"><AppButton variant="secondary">{{ $t('common.cancel') }}</AppButton></NuxtLink>
        <AppButton variant="secondary" :loading="saving" @click="save(false)">{{ $t('entries.form.saveDraft') }}</AppButton>
        <AppButton v-if="canPost" :loading="saving" @click="save(true)">{{ $t('entries.form.savePost') }}</AppButton>
      </div>
    </form>
  </div>
</template>