<script setup lang="ts">
import type { Account, AccountCategoryRow, AccountingSettings, ComboOption } from '~/types/api'
import { ACCOUNT_CATEGORIES } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
useHead({ title: computed(() => t('menu.accountingSettings')) })

const canManage = computed(() => session.can('accounts.manage') && !session.readOnly)

const accounts = ref<Account[]>([])
const groups = ref<AccountCategoryRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const FIELDS = ['profitLossAccountId', 'retainedEarningsAccountId', 'closingAccountId', 'openingAccountId'] as const
type Field = (typeof FIELDS)[number]
const form = reactive<Record<Field, number | null>>({
  profitLossAccountId: null, retainedEarningsAccountId: null, closingAccountId: null, openingAccountId: null,
})
const labels = reactive<Record<Field, string>>({ profitLossAccountId: '', retainedEarningsAccountId: '', closingAccountId: '', openingAccountId: '' })

function idOf(v: unknown): number | null {
  if (v && typeof v === 'object') return Number((v as { id: unknown }).id)
  return v == null ? null : Number(v)
}

async function load() {
  loadError.value = null
  try {
    const [acc, cats, s] = await Promise.all([
      api.get<Account[]>('/accounts'),
      api.get<AccountCategoryRow[]>('/account-categories'),
      api.get<AccountingSettings>('/accounting-settings'),
    ])
    accounts.value = acc
    groups.value = cats.map((g) => ({ ...g, id: Number(g.id) }))
    for (const f of FIELDS) {
      form[f] = idOf(s[f])
      const v = s[f]
      labels[f] = v && typeof v === 'object' ? `${v.code} ${v.name ?? ''}`.trim() : ''
    }
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---- technical accounts
const byId = computed(() => new Map(accounts.value.map((a) => [a.id, a])))
const groupCategory = computed(() => new Map(groups.value.map((g) => [g.id, g.category])))

/** The group (level 1) an account belongs to */
function groupOf(a: Account): number | null {
  let cur: Account | undefined = a
  while (cur && cur.level > 1) cur = cur.parentId == null ? undefined : byId.value.get(cur.parentId)
  return cur?.id ?? null
}

const baseOptions = computed(() => accounts.value.filter((a) => a.level === 3 && a.isPostable && a.isActive && !a.requiresDetail))
function options(f: Field): ComboOption[] {
  let list = baseOptions.value
  if (f === 'retainedEarningsAccountId') {
    const equity = list.filter((a) => groupCategory.value.get(groupOf(a) ?? -1) === 'equity')
    if (equity.length) list = equity
  }
  return list.map((a) => ({ value: a.id, label: a.name, sub: a.code }))
}

const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrs = reactive<Record<string, string | null>>({})

const complete = computed(() => FIELDS.every((f) => form[f] !== null))

async function saveSettings() {
  formError.value = null
  for (const f of FIELDS) fieldErrs[f] = null
  if (!complete.value) { formError.value = t('acctSettings.allRequired'); return }
  saving.value = true
  try {
    await api.put('/accounting-settings', { ...form })
    notify.success(t('toast.settingsSaved'))
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      let any = false
      for (const f of FIELDS) { const m = err.field(f); if (m) { fieldErrs[f] = errorText.text(m); any = true } }
      if (!any) formError.value = errorText.of(e)
    } else formError.value = errorText.of(e)
  } finally {
    saving.value = false
  }
}

// ---- categories
const catOptions = computed(() => ACCOUNT_CATEGORIES.map((c) => ({ value: c, label: t(`acctSettings.categories.${c}`) })))
const busyGroup = ref<number | null>(null)

async function setCategory(g: AccountCategoryRow, value: string) {
  if (!value || value === g.category) return
  const before = g.category
  busyGroup.value = g.id
  g.category = value as AccountCategoryRow['category']
  try {
    await api.put(`/account-categories/${g.id}`, { category: value })
    notify.success(t('toast.categorySaved', { name: g.name ?? g.code }))
  } catch (e) {
    g.category = before
    notify.error(errorText.of(e))
  } finally {
    busyGroup.value = null
  }
}

const unclassified = computed(() => groups.value.filter((g) => !g.category).length)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.accountingSettings') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('acctSettings.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else>
      <section class="rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="text-base font-semibold text-slate-900">{{ $t('acctSettings.technicalTitle') }}</h2>
        <p class="mt-1 text-sm text-slate-600">{{ $t('acctSettings.technicalHint') }}</p>
        <AppAlert v-if="formError" class="mt-3">{{ formError }}</AppAlert>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div v-for="f in FIELDS" :key="f">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t(`acctSettings.fields.${f}`) }}</label>
            <ComboBox v-model="form[f]" :options="options(f)" :initial-label="labels[f]" :disabled="!canManage"
                      :invalid="!!fieldErrs[f]" :aria-label="$t(`acctSettings.fields.${f}`)" :placeholder="$t('entries.form.searchAccount')" />
            <p class="mt-1 text-xs" :class="fieldErrs[f] ? 'text-red-600' : 'text-slate-500'">{{ fieldErrs[f] ?? $t(`acctSettings.fieldHints.${f}`) }}</p>
          </div>
        </div>
        <div v-if="canManage" class="mt-5 flex justify-end">
          <AppButton :loading="saving" @click="saveSettings">{{ $t('common.save') }}</AppButton>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white">
        <div class="p-5 pb-3">
          <h2 class="text-base font-semibold text-slate-900">{{ $t('acctSettings.categoriesTitle') }}</h2>
          <p class="mt-1 text-sm text-slate-600">{{ $t('acctSettings.categoriesHint') }}</p>
          <AppAlert v-if="unclassified" kind="warning" class="mt-3">{{ $t('acctSettings.unclassified', { n: unclassified }) }}</AppAlert>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-130 text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-5 py-2.5 text-start font-medium">{{ $t('acctSettings.group') }}</th>
              <th class="px-5 py-2.5 text-start font-medium">{{ $t('acctSettings.category') }}</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
            <tr v-for="g in groups" :key="g.id">
              <td class="px-5 py-2.5">
                <span class="text-slate-500" dir="ltr">{{ g.code }}</span>
                {{ g.name ?? byId.get(g.id)?.name }}
                <span v-if="g.hasEntries" class="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{ $t('acctSettings.hasEntries') }}</span>
              </td>
              <td class="w-56 px-5 py-2">
                <AppSelect :model-value="g.category ?? ''" compact size="sm" :options="catOptions"
                           :placeholder="$t('acctSettings.notSet')" :invalid="!g.category" :disabled="!canManage || busyGroup === g.id"
                           :aria-label="$t('acctSettings.category')" @update:model-value="(v: string) => setCategory(g, v)" />
              </td>
            </tr>
            <tr v-if="!groups.length"><td colspan="2" class="px-5 py-8 text-center text-slate-500">{{ $t('acctSettings.noGroups') }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>