<script setup lang="ts">
import type { Account, DetailAccount } from '~/types/api'
import type { BankStatement } from '~/types/bank'
import type { Mapping } from '~/utils/bankImport'

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('bank.newTitle')) })

// ---- the account of the bank
const accounts = ref<Account[]>([])
const details = ref<DetailAccount[]>([])
const loadError = ref<string | null>(null)
const accountId = ref<number | string | null>(null)
const detailId = ref<number | string | null>(null)
const title = ref('')

onMounted(async () => {
  try {
    const [a, d] = await Promise.all([
      api.get<Account[]>('/accounts', { activeOnly: 1 }),
      api.get<DetailAccount[]>('/detail-accounts', { limit: 500 }),
    ])
    accounts.value = a.filter((x) => x.level === 3 && x.isPostable)
    details.value = (Array.isArray(d) ? d : []).filter((x) => x.isActive)
  } catch (e) {
    loadError.value = errorText.of(e)
  }
})
const accountOptions = computed(() => accounts.value.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })))
const detailOptions = computed(() => [...details.value]
    .sort((x, y) => Number(y.kind === 'bank') - Number(x.kind === 'bank'))
    .map((d) => ({ value: d.id, label: `${d.code} ${d.name}`, sub: d.kind === 'bank' ? t('bank.new_.bankKind') : undefined })))

// ---- the file
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const fileName = ref('')
const fileError = ref<string | null>(null)
const rows = ref<string[][]>([])
const mapping = ref<Mapping | null>(null)

async function pick(f: File | null | undefined) {
  fileError.value = null
  rows.value = []
  mapping.value = null
  if (!f) return
  if (f.size > 5 * 1024 * 1024) { fileError.value = t('bank.new_.fileSize'); return }
  if (!/\.(csv|txt|tsv)$/i.test(f.name)) { fileError.value = t('bank.new_.fileType'); return }
  const parsed = parseCsv(await readTextFile(f))
  if (parsed.rows.length < 2) { fileError.value = t('bank.new_.fileEmpty'); return }
  fileName.value = f.name
  rows.value = parsed.rows
  mapping.value = guessMapping(parsed.rows[0]!)
}
function onPick(e: Event) { void pick((e.target as HTMLInputElement).files?.[0]) }
function onDrop(e: DragEvent) { dragging.value = false; void pick(e.dataTransfer?.files?.[0]) }

const columnOptions = computed(() => {
  const first = rows.value[0] ?? []
  return first.map((h, i) => ({ value: String(i), label: mapping.value?.hasHeader && h.trim() ? `${i + 1} · ${h.trim()}` : `${i + 1}` }))
})
const optionalColumns = computed(() => [{ value: '-1', label: t('bank.new_.none') }, ...columnOptions.value])

// the selects speak strings; the mapping holds numbers
function col(key: 'date' | 'description' | 'reference' | 'amount' | 'deposit' | 'withdrawal') {
  return computed({
    get: () => String(mapping.value?.[key] ?? -1),
    set: (v: string) => { if (mapping.value) mapping.value[key] = Number(v) },
  })
}
const dateCol = col('date')
const descCol = col('description')
const refCol = col('reference')
const amountCol = col('amount')
const depositCol = col('deposit')
const withdrawalCol = col('withdrawal')
const mode = computed({
  get: () => mapping.value?.mode ?? 'split',
  set: (v: 'single' | 'split') => { if (mapping.value) mapping.value.mode = v },
})

const parsed = computed(() => (mapping.value && rows.value.length ? parseLines(rows.value, mapping.value) : { lines: [], issues: [] }))
const ignoreBad = ref(false)
const usable = computed(() => parsed.value.lines)
const total = computed(() => usable.value.reduce((s, l) => s + l.amount, 0))
const blocked = computed(() => parsed.value.issues.length > 0 && !ignoreBad.value)

// ---- the period and the balances
const dateFrom = ref('')
const dateTo = ref('')
const touchedDates = ref(false)
watch(usable, (lines) => {
  if (touchedDates.value || !lines.length) return
  const dates = lines.map((l) => l.date).sort()
  dateFrom.value = dates[0]!
  dateTo.value = dates[dates.length - 1]!
})
watch([dateFrom, dateTo], ([a, b], [oa, ob]) => { if ((oa && a !== oa) || (ob && b !== ob)) touchedDates.value = true })

const opening = ref('')
const closing = ref('')
const openingNumber = computed(() => parseAmount(opening.value))
const closingNumber = computed(() => parseAmount(closing.value))
const expectedClosing = computed(() => (openingNumber.value ?? 0) + total.value)
const balanceOk = computed(() => closingNumber.value !== null && closingNumber.value === expectedClosing.value)

const outside = computed(() => usable.value.filter((l) => (dateFrom.value && l.date < dateFrom.value) || (dateTo.value && l.date > dateTo.value)).length)

const canSubmit = computed(() => accountId.value !== null && title.value.trim() !== '' && usable.value.length > 0
    && !blocked.value && dateFrom.value !== '' && dateTo.value !== '' && openingNumber.value !== null && balanceOk.value && outside.value === 0)

// ---- sending
const saving = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  formError.value = null
  errs.value = {}
  try {
    const statement = await api.post<BankStatement>('/bank-statements', {
      accountId: Number(accountId.value),
      detailId: detailId.value === null ? null : Number(detailId.value),
      title: title.value.trim(),
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      openingBalance: openingNumber.value,
      closingBalance: closingNumber.value,
      lines: usable.value.map((l) => ({ date: l.date, description: l.description || null, reference: l.reference || null, amount: l.amount })),
    })
    notify.success(t('bank.toast.created', { title: statement.title }))
    await navigateTo(`/bank/${statement.id}`)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['accountId', 'detailId', 'title', 'dateFrom', 'dateTo', 'openingBalance', 'closingBalance']) {
        const m = err.field(f)
        if (m) errs.value[f] = errorText.text(m)
      }
      const other = Object.keys(err.errors).filter((k) => !(k in errs.value))
      if (other.length || !Object.keys(errs.value).length) formError.value = errorText.text(err.field(other[0] ?? '') ?? err.message)
    } else {
      formError.value = errorText.of(e)
    }
  } finally {
    saving.value = false
  }
}

const previewRows = computed(() => usable.value.slice(0, 15))
const sign = (n: number) => (n > 0 ? 'text-emerald-700' : 'text-rose-700')
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <NuxtLink to="/bank" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('menu.bank') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('bank.newTitle') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('bank.new_.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }}</AppAlert>
    <AppAlert v-if="formError">{{ formError }}</AppAlert>

    <!-- 1: which bank account -->
    <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-900">{{ $t('bank.new_.step1') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('bank.new_.account') }}</label>
          <ComboBox v-model="accountId" :options="accountOptions" :invalid="!!errs.accountId" :aria-label="$t('bank.new_.account')" :placeholder="$t('entries.form.searchAccount')" />
          <p v-if="errs.accountId" class="mt-1 text-xs text-red-600">{{ errs.accountId }}</p>
          <p v-else class="mt-1 text-xs text-slate-500">{{ $t('bank.new_.accountHint') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('bank.new_.detail') }}</label>
          <ComboBox v-model="detailId" :options="detailOptions" :aria-label="$t('bank.new_.detail')" :placeholder="$t('bank.new_.detailPlaceholder')" />
          <p class="mt-1 text-xs text-slate-500">{{ $t('bank.new_.detailHint') }}</p>
        </div>
        <div class="sm:col-span-2">
          <AppInput v-model="title" :label="$t('bank.new_.title')" :error="errs.title" :hint="$t('bank.new_.titleHint')" />
        </div>
      </div>
    </section>

    <!-- 2: the file -->
    <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-900">{{ $t('bank.new_.step2') }}</h2>
      <p class="text-sm text-slate-600">{{ $t('bank.new_.signHint') }}</p>

      <label class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition"
             :class="[dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300', fileError ? 'border-red-300' : '']"
             @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
        <AppIcon name="download" class="rotate-180 text-slate-400" />
        <span class="text-sm font-medium text-slate-700">{{ fileName || $t('bank.new_.drop') }}</span>
        <span class="text-xs text-slate-500">{{ $t('bank.new_.fileHint') }}</span>
        <input ref="fileInput" type="file" class="sr-only" accept=".csv,.txt,.tsv,text/csv" @change="onPick">
      </label>
      <p v-if="fileError" class="text-xs text-red-600">{{ fileError }}</p>

      <template v-if="mapping">
        <div class="grid gap-4 sm:grid-cols-3">
          <AppSelect v-model="dateCol" :label="$t('bank.new_.colDate')" :options="columnOptions" />
          <AppSelect v-model="descCol" :label="$t('bank.new_.colDescription')" :options="optionalColumns" />
          <AppSelect v-model="refCol" :label="$t('bank.new_.colReference')" :options="optionalColumns" />
        </div>

        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label class="inline-flex items-center gap-2"><input v-model="mode" type="radio" value="split" class="accent-indigo-600">{{ $t('bank.new_.modeSplit') }}</label>
          <label class="inline-flex items-center gap-2"><input v-model="mode" type="radio" value="single" class="accent-indigo-600">{{ $t('bank.new_.modeSingle') }}</label>
          <label class="inline-flex items-center gap-2"><input v-model="mapping.hasHeader" type="checkbox" class="accent-indigo-600">{{ $t('bank.new_.hasHeader') }}</label>
        </div>

        <div v-if="mode === 'split'" class="grid gap-4 sm:grid-cols-2">
          <AppSelect v-model="depositCol" :label="$t('bank.new_.colDeposit')" :options="optionalColumns" />
          <AppSelect v-model="withdrawalCol" :label="$t('bank.new_.colWithdrawal')" :options="optionalColumns" />
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <AppSelect v-model="amountCol" :label="$t('bank.new_.colAmount')" :options="optionalColumns" />
          <label class="mt-7 inline-flex items-center gap-2 text-sm"><input v-model="mapping.reverse" type="checkbox" class="accent-indigo-600">{{ $t('bank.new_.reverse') }}</label>
        </div>
      </template>
    </section>

    <!-- 3: what was read -->
    <section v-if="mapping" class="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-900">{{ $t('bank.new_.step3') }}</h2>

      <AppAlert v-if="parsed.issues.length" kind="warning">
        <p class="font-medium">{{ $t('bank.new_.issues', { n: fmt.money(parsed.issues.length) }) }}</p>
        <ul class="mt-1 list-disc space-y-0.5 ps-5">
          <li v-for="i in parsed.issues.slice(0, 8)" :key="i.row">{{ $t('bank.new_.issueRow', { n: fmt.money(i.row) }) }}: {{ $t(`bank.new_.issue_${i.kind}`) }} <span class="text-xs opacity-70" dir="ltr">{{ i.value }}</span></li>
        </ul>
        <p v-if="parsed.issues.length > 8" class="mt-1 text-xs">{{ $t('bank.new_.moreIssues', { n: fmt.money(parsed.issues.length - 8) }) }}</p>
        <label class="mt-2 inline-flex items-center gap-2"><input v-model="ignoreBad" type="checkbox" class="accent-indigo-600">{{ $t('bank.new_.ignoreBad') }}</label>
      </AppAlert>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-slate-500">{{ $t('bank.new_.lines') }}</div><div class="mt-1 font-bold tabular-nums">{{ fmt.money(usable.length) }}</div></div>
        <div class="rounded-lg bg-slate-50 p-3"><div class="text-xs text-slate-500">{{ $t('bank.new_.net') }}</div><div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(total) }}</div></div>
      </div>

      <div v-if="previewRows.length" class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="w-full min-w-140 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-3 py-2 text-start font-medium">{{ $t('bank.new_.colDate') }}</th>
            <th class="px-3 py-2 text-start font-medium">{{ $t('bank.new_.colDescription') }}</th>
            <th class="px-3 py-2 text-start font-medium">{{ $t('bank.new_.colReference') }}</th>
            <th class="px-3 py-2 text-end font-medium">{{ $t('bank.new_.amount') }}</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
          <tr v-for="l in previewRows" :key="l.row">
            <td class="px-3 py-1.5" dir="ltr">{{ fmt.date(l.date) }}</td>
            <td class="px-3 py-1.5">{{ l.description }}</td>
            <td class="px-3 py-1.5 text-slate-500" dir="ltr">{{ l.reference }}</td>
            <td class="px-3 py-1.5 text-end tabular-nums" :class="sign(l.amount)" dir="ltr">{{ fmt.money(l.amount) }}</td>
          </tr>
          </tbody>
        </table>
        <p v-if="usable.length > previewRows.length" class="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">{{ $t('bank.new_.morePreview', { n: fmt.money(usable.length - previewRows.length) }) }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <DateInput v-model="dateFrom" :label="$t('bank.new_.dateFrom')" :error="errs.dateFrom" />
        <DateInput v-model="dateTo" :label="$t('bank.new_.dateTo')" :error="errs.dateTo" />
        <AppInput v-model="opening" ltr :label="$t('bank.new_.opening')" :error="errs.openingBalance || (opening !== '' && openingNumber === null ? $t('bank.new_.notNumber') : null)" :hint="$t('bank.new_.openingHint')" />
        <AppInput v-model="closing" ltr :label="$t('bank.new_.closing')" :error="errs.closingBalance || (closing !== '' && closingNumber === null ? $t('bank.new_.notNumber') : null)" :hint="$t('bank.new_.closingHint')" />
      </div>
      <p v-if="outside" class="text-sm text-red-600">{{ $t('bank.new_.outside', { n: fmt.money(outside) }) }}</p>

      <AppAlert v-if="closingNumber !== null && !balanceOk" kind="warning">
        {{ $t('bank.new_.balanceBad', { expected: fmt.money(expectedClosing) }) }}
      </AppAlert>
      <AppAlert v-else-if="balanceOk" kind="success">{{ $t('bank.new_.balanceOk') }}</AppAlert>

      <div class="flex justify-end gap-3">
        <NuxtLink to="/bank" class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{{ $t('common.cancel') }}</NuxtLink>
        <AppButton :loading="saving" :disabled="!canSubmit" @click="submit">{{ $t('bank.new_.import') }}</AppButton>
      </div>
    </section>
  </div>
</template>