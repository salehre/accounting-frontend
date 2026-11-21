<script setup lang="ts">
import type { EntryRow, FiscalYear, Paginated } from '~/types/api'

const session = useSessionStore()
const api = useApi()
const fmt = useFormat()
const { t } = useI18n()
useHead({ title: computed(() => t('menu.dashboard')) })

// ---- subscription
const sub = computed(() => session.features?.subscription ?? null)
const planName = computed(() => {
  const p = session.features?.plan
  if (!p) return ''
  return typeof p === 'string' ? p : (p.name ?? p.code ?? '')
})
const daysLeft = computed(() => {
  const end = sub.value?.endsAt
  if (!end) return null
  const ms = new Date(end.slice(0, 10) + 'T23:59:59').getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
})
const subColor = computed(() => {
  const s = sub.value?.state
  if (s === 'active') return (daysLeft.value !== null && daysLeft.value <= 14) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
  if (s === 'grace') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
})
const limits = computed(() => Object.entries(session.features?.limits ?? {}))
function percent(l: { max: number | null; used: number }): number {
  return l.max ? Math.min(100, Math.round((l.used / l.max) * 100)) : 0
}

// ---- fiscal years and recent entries (each card loads on its own)
const canReadEntries = computed(() => session.can('entries.read'))
const canWrite = computed(() => session.can('entries.write') && !session.readOnly)
const years = ref<FiscalYear[] | null>(null)
const recent = ref<EntryRow[] | null>(null)

onMounted(async () => {
  if (!canReadEntries.value) return
  const [y, r] = await Promise.allSettled([
    api.get<FiscalYear[]>('/fiscal-years'),
    api.get<Paginated<EntryRow>>('/entries', { page: 1, pageSize: 5 }),
  ])
  if (y.status === 'fulfilled') years.value = y.value.map((x) => ({ ...x, id: Number(x.id), postedEntries: Number(x.postedEntries), draftEntries: Number(x.draftEntries) }))
  if (r.status === 'fulfilled') recent.value = r.value.items.map((x) => ({ ...x, id: Number(x.id), totalDebit: Number(x.totalDebit) }))
})

const openYears = computed(() => (years.value ?? []).filter((y) => y.status === 'open'))
const drafts = computed(() => openYears.value.reduce((s, y) => s + y.draftEntries, 0))

const actions = computed(() => [
  { to: '/entries/new', label: 'dashboard.newEntry', icon: 'plus', show: canWrite.value },
  { to: '/reports/trial-balance', label: 'reports.trialBalance.name', icon: 'chart', show: session.can('reports.read') },
  { to: '/accounts', label: 'menu.accounts', icon: 'list', show: session.can('accounts.read') },
  { to: '/fiscal-years', label: 'menu.fiscalYears', icon: 'calendar', show: canReadEntries.value },
].filter((a) => a.show))
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('home.welcome', { name: session.user?.fullName }) }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('home.subtitle') }}</p>
    </div>

    <div v-if="actions.length" class="flex flex-wrap gap-2">
      <NuxtLink v-for="a in actions" :key="a.to" :to="a.to"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700">
        <AppIcon :name="a.icon" />{{ $t(a.label) }}
      </NuxtLink>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <!-- subscription -->
      <section class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">{{ $t('dashboard.subscription') }}</h2>
            <p v-if="planName" class="mt-0.5 text-xs text-slate-500">{{ $t('dashboard.plan', { name: planName }) }}</p>
          </div>
          <span v-if="sub" class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="subColor">{{ $t(`dashboard.states.${sub.state}`) }}</span>
        </div>
        <dl v-if="sub" class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-slate-500">{{ $t('dashboard.endsAt') }}</dt>
            <dd class="font-medium" dir="ltr">{{ sub.endsAt ? fmt.date(sub.endsAt) : $t('dashboard.noEnd') }}</dd>
          </div>
          <div v-if="daysLeft !== null && sub.state === 'active'" class="flex justify-between gap-3">
            <dt class="text-slate-500">{{ $t('dashboard.daysLeft') }}</dt>
            <dd class="font-medium" :class="daysLeft <= 14 ? 'text-amber-700' : ''">{{ $t('dashboard.days', { n: fmt.money(Math.max(daysLeft, 0)) }) }}</dd>
          </div>
          <div v-if="sub.state === 'grace' && sub.graceEndsAt" class="flex justify-between gap-3">
            <dt class="text-slate-500">{{ $t('dashboard.graceEnds') }}</dt>
            <dd class="font-medium text-amber-700" dir="ltr">{{ fmt.date(sub.graceEndsAt) }}</dd>
          </div>
        </dl>
        <p v-else class="mt-4 text-sm text-slate-500">{{ $t('dashboard.noSubscription') }}</p>

        <div v-if="limits.length" class="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <div v-for="[code, l] in limits" :key="code">
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">{{ $te(`limits.${code}`) ? $t(`limits.${code}`) : code }}</span>
              <span class="font-medium tabular-nums">{{ fmt.money(l.used) }} / {{ l.max === null ? '∞' : fmt.money(l.max) }}</span>
            </div>
            <div v-if="l.max" class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full" :class="percent(l) >= 90 ? 'bg-red-500' : percent(l) >= 70 ? 'bg-amber-500' : 'bg-indigo-500'" :style="{ width: percent(l) + '%' }" />
            </div>
          </div>
        </div>
      </section>

      <!-- fiscal year -->
      <section v-if="canReadEntries" class="rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="text-sm font-semibold text-slate-900">{{ $t('dashboard.fiscalYear') }}</h2>
        <p v-if="years === null" class="mt-4 text-sm text-slate-500">{{ $t('common.loading') }}</p>
        <template v-else-if="openYears.length === 0">
          <p class="mt-4 text-sm text-slate-600">{{ $t('dashboard.noOpenYear') }}</p>
          <NuxtLink v-if="session.can('fiscal-years.manage')" to="/fiscal-years" class="mt-2 inline-block text-sm text-indigo-600 hover:underline">{{ $t('menu.fiscalYears') }}</NuxtLink>
        </template>
        <ul v-else class="mt-3 space-y-3">
          <li v-for="y in openYears" :key="y.id" class="rounded-lg bg-slate-50 p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="font-medium">{{ y.title }}</span>
              <NuxtLink :to="`/entries?fiscalYearId=${y.id}`" class="text-xs text-indigo-600 hover:underline">{{ $t('menu.entries') }}</NuxtLink>
            </div>
            <div class="mt-1 text-xs text-slate-500" dir="ltr">{{ fmt.date(y.startDate) }} → {{ fmt.date(y.endDate) }}</div>
            <div class="mt-2 flex gap-4 text-sm">
              <span class="text-emerald-700">{{ $t('dashboard.posted', { n: fmt.money(y.postedEntries) }) }}</span>
              <span :class="y.draftEntries ? 'text-amber-700' : 'text-slate-500'">{{ $t('dashboard.drafts', { n: fmt.money(y.draftEntries) }) }}</span>
            </div>
          </li>
        </ul>
        <AppAlert v-if="drafts > 0" kind="warning" class="mt-3">{{ $t('dashboard.draftsNote', { n: fmt.money(drafts) }) }}</AppAlert>
      </section>
    </div>

    <!-- recent entries -->
    <section v-if="canReadEntries && recent && recent.length" class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-5 py-4">
        <h2 class="text-sm font-semibold text-slate-900">{{ $t('dashboard.recent') }}</h2>
        <NuxtLink to="/entries" class="text-xs text-indigo-600 hover:underline">{{ $t('dashboard.all') }}</NuxtLink>
      </div>
      <ul class="divide-y divide-slate-100 border-t border-slate-100 text-sm">
        <li v-for="e in recent" :key="e.id">
          <NuxtLink :to="`/entries/${e.id}`" class="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
            <span class="w-14 shrink-0 text-slate-500 tabular-nums" dir="ltr">{{ e.number === null ? '—' : fmt.money(e.number) }}</span>
            <span class="w-24 shrink-0 text-slate-600" dir="ltr">{{ fmt.date(e.entryDate) }}</span>
            <span class="min-w-0 flex-1 truncate">{{ e.description || '—' }}</span>
            <span class="hidden shrink-0 tabular-nums sm:block" dir="ltr">{{ fmt.money(e.totalDebit) }}</span>
            <StatusBadge :status="e.status" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>