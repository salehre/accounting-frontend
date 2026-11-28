<script setup lang="ts">
import type { FiscalYear, YearEndIssue, YearEndPreview } from '~/types/api'

const route = useRoute()
const { t, te } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()

const yearId = computed(() => Number(route.params.id))
const year = ref<FiscalYear | null>(null)
const data = ref<YearEndPreview | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const busy = ref<'generate' | 'discard' | 'post' | null>(null)

useHead({ title: computed(() => t('yearEnd.link')) })

const canManage = computed(() => session.can('fiscal-years.manage') && !session.readOnly)
const canClose = computed(() => session.can('fiscal-years.close') && !session.readOnly)

async function load() {
  loadError.value = null
  try {
    const [list, preview] = await Promise.all([
      api.get<FiscalYear[]>('/fiscal-years'),
      api.get<YearEndPreview>(`/fiscal-years/${yearId.value}/year-end`),
    ])
    year.value = list.find((y) => Number(y.id) === yearId.value) ?? null
    data.value = preview
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---- actions
async function run(kind: 'generate' | 'discard' | 'post', toastKey: string) {
  busy.value = kind
  try {
    const path = kind === 'discard' ? '/year-end' : `/year-end/${kind}`
    const url = `/fiscal-years/${yearId.value}${path}`
    if (kind === 'discard') await api.del(url)
    else await api.post(url)
    if (kind === 'discard') notify.info(t(toastKey))
    else notify.success(t(toastKey))
    return true
  } catch (e) {
    notify.error(errorText.of(e))
    return false
  } finally {
    busy.value = null
    await load()
  }
}
const generate = () => run('generate', 'toast.yearEndGenerated')

const discardOpen = ref(false)
async function doDiscard() {
  await run('discard', 'toast.yearEndDiscarded')
  discardOpen.value = false
}
const postOpen = ref(false)
async function doPost() {
  await run('post', 'toast.yearEndPosted')
  postOpen.value = false
}
const reverseOpen = ref(false)

// ---- texts
const titleText = computed(() => t('yearEnd.title', { title: year.value?.title ?? '' }))
const net = computed(() => data.value?.summary?.netProfit ?? 0)

function listOf(items: YearEndIssue['accounts']): string {
  return (items ?? []).map((a) => (typeof a === 'string' ? a : a.code)).join('، ')
}
function fieldsOf(items: string[] | undefined): string {
  return (items ?? []).map((f) => t(`yearEnd.fields.${f}`)).join('، ')
}
function issue(kind: 'blockers' | 'warnings', i: YearEndIssue): string {
  const key = `yearEnd.${kind}.${i.code}`
  if (!te(key)) return i.message
  const quoted = i.message.match(/\("(.+?)"\)/)?.[1] ?? ''
  const days = i.message.match(/gap of (\d+) day/)?.[1] ?? ''
  const date = i.message.match(/dated (\d{4}-\d{2}-\d{2})/)?.[1]
  return t(key, {
    count: fmt.money(i.count ?? 0),
    fields: fieldsOf(i.fields),
    accounts: listOf(i.accounts),
    groups: (i.groups ?? []).map((g) => `${g.code} ${g.name}`).join('، '),
    title: quoted,
    days: fmt.money(days),
    date: date ? fmt.date(date) : '',
  })
}
const stateColor = {
  none: 'bg-slate-100 text-slate-700',
  drafts: 'bg-amber-50 text-amber-700',
  posted: 'bg-emerald-50 text-emerald-700',
} as const
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <div>
      <NuxtLink to="/fiscal-years" class="text-sm text-indigo-600 hover:underline">{{ $t('yearEnd.back') }}</NuxtLink>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-bold text-slate-900">{{ titleText }}</h1>
        <span v-if="data" class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="stateColor[data.state]">{{ $t(`yearEnd.states.${data.state}`) }}</span>
      </div>
      <p class="mt-1 text-sm text-slate-600">{{ $t('yearEnd.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('yearEnd.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="data">
      <p class="text-sm text-slate-600">{{ $t(`yearEnd.stateHint.${data.state}`) }}</p>

      <AppAlert v-if="data.blockers.length">
        <div class="font-medium">{{ $t('yearEnd.blockers.title') }}</div>
        <ul class="mt-1 list-disc space-y-0.5 ps-5">
          <li v-for="(b, i) in data.blockers" :key="i">{{ issue('blockers', b) }}</li>
        </ul>
        <NuxtLink v-if="data.blockers.some((b) => ['settings_missing', 'settings_invalid', 'unclassified_accounts'].includes(b.code))"
                  to="/settings/accounting" class="mt-2 inline-block underline">{{ $t('menu.accountingSettings') }}</NuxtLink>
      </AppAlert>
      <AppAlert v-if="data.warnings.length" kind="warning">
        <div class="font-medium">{{ $t('yearEnd.warnings.title') }}</div>
        <ul class="mt-1 list-disc space-y-0.5 ps-5">
          <li v-for="(w, i) in data.warnings" :key="i">{{ issue('warnings', w) }}</li>
        </ul>
      </AppAlert>

      <div v-if="data.summary && data.entries.length" class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs text-slate-500">{{ net >= 0 ? $t('yearEnd.summary.profit') : $t('yearEnd.summary.loss') }}</div>
          <div class="mt-1 text-xl font-bold tabular-nums" :class="net >= 0 ? 'text-emerald-700' : 'text-red-600'" dir="ltr">{{ fmt.money(Math.abs(net)) }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs text-slate-500">{{ $t('yearEnd.summary.temporary') }}</div>
          <div class="mt-1 text-xl font-bold tabular-nums text-slate-900">{{ fmt.money(data.summary.temporaryAccounts) }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs text-slate-500">{{ $t('yearEnd.summary.permanent') }}</div>
          <div class="mt-1 text-xl font-bold tabular-nums text-slate-900">{{ fmt.money(data.summary.permanentAccounts) }}</div>
        </div>
      </div>

      <div class="flex flex-wrap justify-end gap-3">
        <AppButton v-if="canManage && data.actions.generate" :loading="busy === 'generate'" @click="generate">{{ $t('yearEnd.generate') }}</AppButton>
        <AppButton v-if="canClose && data.actions.post" @click="postOpen = true">{{ $t('yearEnd.post') }}</AppButton>
        <AppButton v-if="canManage && data.actions.discard" variant="secondary" @click="discardOpen = true">{{ $t('yearEnd.discard') }}</AppButton>
        <AppButton v-if="canClose && data.actions.reverse" variant="danger" @click="reverseOpen = true">{{ $t('yearEnd.reverse') }}</AppButton>
      </div>

      <section v-if="data.entries.length" class="space-y-3">
        <h2 class="text-base font-semibold text-slate-900">{{ data.state === 'drafts' ? $t('yearEnd.planDrafts') : $t('yearEnd.plan') }}</h2>
        <YearEndEntryCard v-for="(e, i) in data.entries" :key="e.type" :entry="e" :index="i + 1" />
      </section>
      <p v-else-if="data.state !== 'posted'" class="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{{ $t('yearEnd.noPlan') }}</p>

      <section v-if="data.existing.length" class="space-y-2">
        <h2 class="text-base font-semibold text-slate-900">{{ $t('yearEnd.existing') }}</h2>
        <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          <li v-for="x in data.existing" :key="x.id" class="flex items-center justify-between gap-3 px-4 py-2.5">
            <span class="min-w-0 truncate">{{ x.description ?? `#${x.id}` }}</span>
            <NuxtLink :to="`/entries/${x.id}`" class="shrink-0 text-indigo-600 hover:underline">{{ $t('yearEnd.openEntry') }}</NuxtLink>
          </li>
        </ul>
      </section>
    </template>

    <AppModal v-model:open="postOpen" :title="$t('yearEnd.postTitle')">
      <p class="text-sm text-slate-700">{{ $t('yearEnd.postMessage') }}</p>
      <template #footer>
        <AppButton variant="secondary" @click="postOpen = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="busy === 'post'" @click="doPost">{{ $t('yearEnd.post') }}</AppButton>
      </template>
    </AppModal>
    <ConfirmDialog v-model:open="discardOpen" :title="$t('yearEnd.discardTitle')" :message="$t('yearEnd.discardMessage')"
                   :confirm-label="$t('yearEnd.discard')" :loading="busy === 'discard'" @confirm="doDiscard" />
    <YearEndReverseModal v-model:open="reverseOpen" :fiscal-year-id="yearId" @done="load" />
  </div>
</template>