<script setup lang="ts">
import type { PlatformPlan, PlatformPlans } from '~/types/platform'

definePageMeta({ layout: 'platform', middleware: 'platform-auth' })

const { t, te } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
const notify = useNotify()
useHead({ title: computed(() => t('platform.plans.title')) })

const data = ref<PlatformPlans | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

async function load() {
  loadError.value = null
  try { data.value = await api.get<PlatformPlans>('/platform/plans') } catch (e) { loadError.value = perr.of(e) } finally { loading.value = false }
}
onMounted(load)

const featureLabel = (c: string) => {
  if (te(`platform.feature.${permKey(c)}`)) return t(`platform.feature.${permKey(c)}`)
  return data.value?.catalog.features[c] ?? c
}
const limitLabel = (c: string) => (te(`platform.limit.${permKey(c)}`) ? t(`platform.limit.${permKey(c)}`) : c)

// ---- delete
const delOpen = ref(false)
const delPlan = ref<PlatformPlan | null>(null)
function askDelete(p: PlatformPlan) { delPlan.value = p; delOpen.value = true }
async function remove() {
  if (!delPlan.value) return
  busy.value = true
  try {
    await api.del(`/platform/plans/${delPlan.value.code}`)
    notify.success(t('platform.toast.planDeleted', { name: delPlan.value.name }))
    delOpen.value = false
    await load()
  } catch (e) {
    delOpen.value = false
    notify.error(perr.of(e))
  } finally { busy.value = false }
}

// ---- create / edit
const open = ref(false)
const isNew = ref(true)
const busy = ref(false)
const error = ref<unknown>(null)
const fe = useFieldErrors()
const form = reactive({
  code: '',
  name: '',
  features: [] as string[],
  limits: {} as Record<string, { unlimited: boolean; value: string }>,
})

const featureCodes = computed(() => Object.keys(data.value?.catalog.features ?? {}))
// ticking "unlimited" clears the typed number; the field is disabled by the template
function setUnlimited(code: string, on: boolean) {
  const l = form.limits[code]
  if (!l) return
  l.unlimited = on
  if (on) l.value = ''
}

const limitCodes = computed(() => Object.keys(data.value?.catalog.limits ?? {}))

function ask(plan: PlatformPlan | null) {
  isNew.value = plan === null
  error.value = null
  fe.clear()
  form.code = plan?.code ?? ''
  form.name = plan?.name ?? ''
  form.features = [...(plan?.features ?? [])]
  form.limits = {}
  for (const code of limitCodes.value) {
    const has = plan !== null && code in plan.limits
    const max = has ? plan!.limits[code] : null
    // a limit that the plan does not mention is unlimited (the same as the backend)
    form.limits[code] = { unlimited: max === null, value: max === null ? '' : String(max) }
  }
  open.value = true
}

function toggle(code: string) {
  const i = form.features.indexOf(code)
  if (i >= 0) form.features.splice(i, 1)
  else form.features.push(code)
}

// the same rules as the server: nothing is sent until every one of them is met
const PLAN_CODE = /^[a-z0-9][a-z0-9-]{1,29}$/
watch(() => form.code, () => fe.drop('code'))
watch(() => form.name, () => fe.drop('name'))
watch(() => form.limits, () => fe.drop('limits'), { deep: true })

function check(): Record<string, number | null> | null {
  fe.clear()
  if (isNew.value) {
    const c = form.code.trim().toLowerCase()
    if (c === '') fe.fail('code', t('platform.check.codeRequired'))
    else if (!PLAN_CODE.test(c)) fe.fail('code', t('platform.check.planCode'))
  }
  const nm = form.name.trim()
  if (nm === '') fe.fail('name', t('platform.check.nameRequired'))
  else if (nm.length > 100) fe.fail('name', t('platform.check.nameLong', { n: 100 }))
  const limits: Record<string, number | null> = {}
  for (const code of limitCodes.value) {
    const l = form.limits[code]
    if (!l) continue
    if (l.unlimited) { limits[code] = null; continue }
    const n = Number(normalizeDigits(l.value))
    if (l.value.trim() === '' || !Number.isInteger(n) || n < 0) { fe.fail('limits', t('platform.plans.badLimit')); continue }
    limits[code] = n
  }
  return fe.ok() ? limits : null
}

async function save() {
  error.value = null
  const limits = check()
  if (limits === null) return
  busy.value = true
  try {
    const code = form.code.trim().toLowerCase()
    await api.put(`/platform/plans/${code}`, { name: form.name.trim(), features: form.features, limits })
    notify.success(t(isNew.value ? 'platform.toast.planCreated' : 'platform.toast.planSaved', { name: form.name.trim() }))
    open.value = false
    await load()
  } catch (e) { error.value = e } finally { busy.value = false }
}

const fieldError = (name: string) => fe.errs.value[name] ?? (error.value ? perr.field(error.value, name) : null)
const generalError = computed(() => {
  if (!error.value) return null
  for (const f of ['code', 'name', 'features', 'limits']) if (perr.field(error.value, f)) return null
  return perr.of(error.value)
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('platform.plans.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('platform.plans.subtitle') }}</p>
      </div>
      <AppButton v-if="data" @click="ask(null)">{{ $t('platform.plans.new') }}</AppButton>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="data" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <p v-if="data.data.length === 0" class="col-span-full py-10 text-center text-slate-500">{{ $t('platform.plans.empty') }}</p>
      <section v-for="p in data.data" :key="p.code" class="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="font-semibold text-slate-900">{{ p.name }}</h2>
          <span class="text-xs text-slate-500" dir="ltr">{{ p.code }}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="fcode in p.features" :key="fcode" class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">{{ featureLabel(fcode) }}</span>
          <span v-if="p.features.length === 0" class="text-xs text-slate-500">{{ $t('platform.detail.coreOnly') }}</span>
        </div>
        <ul class="mt-3 flex-1 space-y-1 text-sm">
          <li v-for="(max, lcode) in p.limits" :key="lcode" class="flex justify-between gap-3">
            <span class="text-slate-500">{{ limitLabel(String(lcode)) }}</span>
            <span>{{ max === null ? $t('platform.unlimited') : max }}</span>
          </li>
        </ul>
        <p class="mt-3 text-xs text-slate-500">{{ $t('platform.plans.companies', { n: p.companies }) }}</p>
        <div class="mt-3 flex flex-wrap justify-end gap-2">
          <AppButton variant="secondary" @click="ask(p)">{{ $t('common.edit') }}</AppButton>
          <AppButton v-if="p.code !== 'full'" variant="secondary" :disabled="p.companies > 0" :title="p.companies > 0 ? $t('platform.plans.deleteBlocked') : undefined" @click="askDelete(p)">{{ $t('common.delete') }}</AppButton>
        </div>
      </section>
    </div>

    <p class="text-xs text-slate-500">{{ $t('platform.plans.note') }}</p>

    <ConfirmDialog
        v-model:open="delOpen"
        :title="$t('platform.plans.deleteTitle', { name: delPlan?.name ?? '' })"
        :message="$t('platform.plans.deleteMessage')"
        :confirm-label="$t('common.delete')"
        :loading="busy"
        @confirm="remove"
    />

    <AppModal v-model:open="open" :title="$t(isNew ? 'platform.plans.newTitle' : 'platform.plans.editTitle')">
      <form class="space-y-4" novalidate @submit.prevent="save">
        <AppInput v-model="form.code" :label="$t('platform.plans.code')" :hint="$t('platform.plans.codeHint')" :error="fieldError('code')" :disabled="!isNew" ltr :autofocus="isNew" />
        <AppInput v-model="form.name" :label="$t('platform.plans.name')" :error="fieldError('name')" :autofocus="!isNew" />

        <fieldset>
          <legend class="mb-1.5 text-sm font-medium text-slate-700">{{ $t('platform.plans.features') }}</legend>
          <p class="mb-2 text-xs text-slate-500">{{ $t('platform.plans.featuresHint') }}</p>
          <div class="grid gap-1.5 sm:grid-cols-2">
            <label v-for="c in featureCodes" :key="c" class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              <input type="checkbox" class="h-4 w-4 accent-indigo-600" :checked="form.features.includes(c)" @change="toggle(c)">
              <span>{{ featureLabel(c) }}</span>
            </label>
          </div>
          <p v-if="fieldError('features')" class="mt-1 text-xs text-red-600">{{ fieldError('features') }}</p>
        </fieldset>

        <fieldset v-if="limitCodes.length">
          <legend class="mb-1.5 text-sm font-medium text-slate-700">{{ $t('platform.plans.limits') }}</legend>
          <div v-for="c in limitCodes" :key="c" class="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <span class="min-w-32 flex-1 text-sm">{{ limitLabel(c) }}</span>
            <input
                v-if="form.limits[c]"
                v-model="form.limits[c].value"
                :disabled="form.limits[c].unlimited"
                :aria-label="limitLabel(c)"
                inputmode="numeric"
                dir="ltr"
                class="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100"
            >
            <label v-if="form.limits[c]" class="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" class="h-4 w-4 accent-indigo-600" :checked="form.limits[c].unlimited" @change="setUnlimited(c, ($event.target as HTMLInputElement).checked)">
              {{ $t('platform.unlimited') }}
            </label>
          </div>
          <p v-if="fieldError('limits')" class="mt-1 text-xs text-red-600">{{ fieldError('limits') }}</p>
        </fieldset>

        <AppAlert v-if="generalError">{{ generalError }}</AppAlert>
      </form>
      <template #footer>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="busy" @click="save">{{ $t('common.save') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>