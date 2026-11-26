<script setup lang="ts">
import type { PlatformCompanyDetail, PlatformOverride, PlatformPlans } from '~/types/platform'

/**
 * Features and limits of ONE company: what it has now, where that comes from (its plan or a change made
 * for this company), and the buttons to change it. A change can stop on a day, and needs a reason.
 */
const props = defineProps<{ company: PlatformCompanyDetail }>()
const emit = defineEmits<{ changed: [company: PlatformCompanyDetail] }>()

const { t, te } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
const notify = useNotify()
const fmt = useFormat()

const catalog = ref<PlatformPlans['catalog']>({ features: {}, limits: {} })
onMounted(async () => {
  try { catalog.value = (await api.get<PlatformPlans>('/platform/plans')).catalog } catch { /* the lists stay empty */ }
})

const featureLabel = (c: string) => (te(`platform.feature.${permKey(c)}`) ? t(`platform.feature.${permKey(c)}`) : (catalog.value.features[c] ?? c))
const limitLabel = (c: string) => (te(`platform.limit.${permKey(c)}`) ? t(`platform.limit.${permKey(c)}`) : (catalog.value.limits[c] ?? c))

const today = new Date().toISOString().slice(0, 10)
const find = (kind: 'feature' | 'limit', code: string): PlatformOverride | undefined => props.company.overrides.find((o) => o.kind === kind && o.code === code)
const expired = (o?: PlatformOverride) => !!o?.until && o.until.slice(0, 10) < today

const features = computed(() => Object.keys(catalog.value.features).map((code) => {
  const o = find('feature', code)
  return { code, on: props.company.features.includes(code), override: o, expired: expired(o) }
}))
const limits = computed(() => Object.keys(catalog.value.limits).map((code) => {
  const o = find('limit', code)
  const max = code in props.company.limits ? props.company.limits[code] : null
  return { code, max: max ?? null, override: o, expired: expired(o) }
}))

// ---- the dialog
const open = ref(false)
const busy = ref(false)
const error = ref<unknown>(null)
const form = reactive({ kind: 'feature' as 'feature' | 'limit', code: '', enabled: true, unlimited: false, value: '', until: '', reason: '' })

function askFeature(code: string, enabled: boolean) {
  Object.assign(form, { kind: 'feature', code, enabled, unlimited: false, value: '', until: '', reason: '' })
  error.value = null
  open.value = true
}
function askLimit(code: string, max: number | null) {
  Object.assign(form, { kind: 'limit', code, enabled: true, unlimited: max === null, value: max === null ? '' : String(max), until: '', reason: '' })
  error.value = null
  open.value = true
}

const title = computed(() => (form.kind === 'feature'
    ? t(form.enabled ? 'platform.access.turnOnTitle' : 'platform.access.turnOffTitle', { name: featureLabel(form.code) })
    : t('platform.access.limitTitle', { name: limitLabel(form.code) })))

async function save() {
  error.value = null
  const body: Record<string, unknown> = { until: form.until || null, reason: form.reason.trim() }
  if (form.kind === 'feature') {
    body.enabled = form.enabled
  } else if (form.unlimited) {
    body.value = null
  } else {
    const n = Number(normalizeDigits(form.value))
    if (form.value.trim() === '' || !Number.isInteger(n) || n < 0) {
      error.value = { _local: t('platform.access.badValue') }
      return
    }
    body.value = n
  }
  busy.value = true
  try {
    emit('changed', await api.put<PlatformCompanyDetail>(`/platform/companies/${props.company.code}/overrides/${form.code}`, body))
    notify.success(t('platform.access.saved'))
    open.value = false
  } catch (e) { error.value = e } finally { busy.value = false }
}

async function clear(code: string) {
  busy.value = true
  try {
    emit('changed', await api.del<PlatformCompanyDetail>(`/platform/companies/${props.company.code}/overrides/${code}`))
    notify.success(t('platform.access.cleared'))
  } catch (e) { notify.error(perr.of(e)) } finally { busy.value = false }
}

const localError = computed(() => (error.value && typeof error.value === 'object' && '_local' in (error.value as object) ? (error.value as { _local: string })._local : null))
const fieldError = (name: string) => (error.value && !localError.value ? perr.field(error.value, name) : null)
const generalError = computed(() => {
  if (!error.value) return null
  if (localError.value) return localError.value
  for (const f of ['enabled', 'value', 'until', 'reason']) if (perr.field(error.value, f)) return null
  return perr.of(error.value)
})
const day = (v: string) => fmt.date(v.slice(0, 10))
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white">
    <div class="border-b border-slate-100 px-4 py-3">
      <h2 class="text-sm font-semibold text-slate-900">{{ $t('platform.access.title') }}</h2>
      <p class="mt-0.5 text-xs text-slate-500">{{ $t('platform.access.note') }}</p>
    </div>

    <ul class="divide-y divide-slate-100">
      <li v-for="f in features" :key="f.code" class="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
        <span class="min-w-40 flex-1">{{ featureLabel(f.code) }}</span>
        <span class="rounded-full px-2.5 py-0.5 text-xs" :class="f.on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'">{{ f.on ? $t('platform.on') : $t('platform.off') }}</span>
        <span class="min-w-40 text-xs text-slate-500">
          <template v-if="f.override && !f.expired">{{ $t('platform.access.special') }}<template v-if="f.override.until"> · {{ $t('platform.access.until', { date: day(f.override.until) }) }}</template> · {{ f.override.reason }}</template>
          <template v-else-if="f.override">{{ $t('platform.access.expired', { date: day(f.override.until ?? '') }) }}</template>
          <template v-else>{{ $t('platform.access.fromPlan') }}</template>
        </span>
        <span class="flex gap-2">
          <AppButton variant="secondary" :disabled="busy" @click="askFeature(f.code, !f.on)">{{ f.on ? $t('platform.access.turnOff') : $t('platform.access.turnOn') }}</AppButton>
          <AppButton v-if="f.override" variant="secondary" :disabled="busy" @click="clear(f.code)">{{ $t('platform.access.remove') }}</AppButton>
        </span>
      </li>

      <li v-for="l in limits" :key="l.code" class="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
        <span class="min-w-40 flex-1">{{ limitLabel(l.code) }}</span>
        <span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">{{ l.max === null ? $t('platform.unlimited') : l.max }}</span>
        <span class="min-w-40 text-xs text-slate-500">
          <template v-if="l.override && !l.expired">{{ $t('platform.access.special') }}<template v-if="l.override.until"> · {{ $t('platform.access.until', { date: day(l.override.until) }) }}</template> · {{ l.override.reason }}</template>
          <template v-else-if="l.override">{{ $t('platform.access.expired', { date: day(l.override.until ?? '') }) }}</template>
          <template v-else>{{ $t('platform.access.fromPlan') }}</template>
        </span>
        <span class="flex gap-2">
          <AppButton variant="secondary" :disabled="busy" @click="askLimit(l.code, l.max)">{{ $t('platform.access.changeLimit') }}</AppButton>
          <AppButton v-if="l.override" variant="secondary" :disabled="busy" @click="clear(l.code)">{{ $t('platform.access.remove') }}</AppButton>
        </span>
      </li>
    </ul>

    <AppModal v-model:open="open" :title="title">
      <form class="space-y-3" novalidate @submit.prevent="save">
        <template v-if="form.kind === 'limit'">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="form.unlimited" type="checkbox" class="h-4 w-4 accent-indigo-600">
            {{ $t('platform.unlimited') }}
          </label>
          <AppInput v-model="form.value" :label="$t('platform.access.max')" :disabled="form.unlimited" :error="fieldError('value')" ltr />
        </template>
        <DateInput v-model="form.until" :label="$t('platform.access.untilLabel')" :hint="$t('platform.access.untilHint')" :error="fieldError('until')" />
        <AppInput v-model="form.reason" :label="$t('platform.detail.reason')" :hint="$t('platform.detail.reasonHint')" :error="fieldError('reason')" autofocus />
        <AppAlert v-if="generalError">{{ generalError }}</AppAlert>
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="busy" @click="save">{{ $t('common.save') }}</AppButton>
      </template>
    </AppModal>
  </section>
</template>