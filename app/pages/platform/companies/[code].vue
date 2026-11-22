<script setup lang="ts">
import type { PlatformAuditRow, PlatformCompanyDetail, PlatformPlan, PlatformPlans } from '~/types/platform'

definePageMeta({ layout: 'platform', middleware: 'platform-auth' })

const { t, te } = useI18n()
const route = useRoute()
const api = usePlatformApi()
const perr = usePlatformError()
const notify = useNotify()
const fmt = useFormat()

const code = computed(() => String(route.params.code))
const company = ref<PlatformCompanyDetail | null>(null)
const plans = ref<PlatformPlan[]>([])
const audit = ref<PlatformAuditRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
useHead({ title: computed(() => company.value?.name ?? t('platform.companies.title')) })

const day = (v: string | null | undefined) => (v ? fmt.date(v.slice(0, 10)) : '—')
const dayTime = (v: string | null | undefined) => (v ? `${fmt.date(v.slice(0, 10))} ${/[T ](\d{2}:\d{2})/.exec(v)?.[1] ?? ''}` : '—')
const featureLabel = (c: string) => (te(`platform.feature.${permKey(c)}`) ? t(`platform.feature.${permKey(c)}`) : c)
const limitLabel = (c: string) => (te(`platform.limit.${permKey(c)}`) ? t(`platform.limit.${permKey(c)}`) : c)

async function load() {
  loadError.value = null
  try {
    company.value = await api.get<PlatformCompanyDetail>(`/platform/companies/${code.value}`)
    audit.value = (await api.get<{ data: PlatformAuditRow[] }>('/platform/audit', { company: code.value, limit: 15 })).data
  } catch (e) {
    const err = toApiError(e)
    loadError.value = err.status === 404 && err.code === 'company_not_found' ? t('platform.err.company_not_found') : perr.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  load()
  try { plans.value = (await api.get<PlatformPlans>('/platform/plans')).data } catch { /* only needed for the plan dialog */ }
})
watch(code, () => { loading.value = true; load() })

function took(res: PlatformCompanyDetail) {
  company.value = res
  // the log changes with every action: reload it quietly
  api.get<{ data: PlatformAuditRow[] }>('/platform/audit', { company: code.value, limit: 15 }).then((r) => { audit.value = r.data }).catch(() => {})
}

// ---- renew
const renewOpen = ref(false)

// ---- rename
const renameOpen = ref(false)
const renameName = ref('')
const renameError = ref<unknown>(null)
const busy = ref(false)
function askRename() { renameName.value = company.value?.name ?? ''; renameError.value = null; renameOpen.value = true }
async function rename() {
  busy.value = true
  renameError.value = null
  try {
    took(await api.patch<PlatformCompanyDetail>(`/platform/companies/${code.value}`, { name: renameName.value }))
    notify.success(t('platform.toast.renamed'))
    renameOpen.value = false
  } catch (e) { renameError.value = e } finally { busy.value = false }
}

// ---- plan
const planOpen = ref(false)
const planValue = ref('')
const planError = ref<unknown>(null)
const planOptions = computed(() => [
  { value: '', label: t('platform.noPlan') },
  ...plans.value.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
])
function askPlan() { planValue.value = company.value?.plan?.code ?? ''; planError.value = null; planOpen.value = true }
async function savePlan() {
  busy.value = true
  planError.value = null
  try {
    took(await api.put<PlatformCompanyDetail>(`/platform/companies/${code.value}/plan`, { plan: planValue.value || null }))
    notify.success(t('platform.toast.planChanged'))
    planOpen.value = false
  } catch (e) { planError.value = e } finally { busy.value = false }
}

// ---- suspend / activate
const suspendOpen = ref(false)
const suspendReason = ref('')
const suspendError = ref<unknown>(null)
function askSuspend() { suspendReason.value = ''; suspendError.value = null; suspendOpen.value = true }
async function suspend() {
  busy.value = true
  suspendError.value = null
  try {
    took(await api.post<PlatformCompanyDetail>(`/platform/companies/${code.value}/suspend`, { reason: suspendReason.value }))
    notify.warning(t('platform.toast.suspended', { name: company.value?.name ?? '' }))
    suspendOpen.value = false
  } catch (e) { suspendError.value = e } finally { busy.value = false }
}
async function activate() {
  busy.value = true
  try {
    took(await api.post<PlatformCompanyDetail>(`/platform/companies/${code.value}/activate`))
    notify.success(t('platform.toast.activated', { name: company.value?.name ?? '' }))
  } catch (e) { notify.error(perr.of(e)) } finally { busy.value = false }
}

// ---- license
const keyOpen = ref(false)
const newKey = ref('')
const reissueOpen = ref(false)
const revokeOpen = ref(false)
async function issue() {
  busy.value = true
  try {
    const res = await api.post<{ key: string; company: PlatformCompanyDetail }>(`/platform/companies/${code.value}/license`, {})
    took(res.company)
    newKey.value = res.key
    reissueOpen.value = false
    keyOpen.value = true
  } catch (e) { notify.error(perr.of(e)) } finally { busy.value = false }
}
function askIssue() {
  if (company.value?.license.active) reissueOpen.value = true
  else issue()
}
watch(keyOpen, (v) => { if (!v) newKey.value = '' }) // the key is not kept once the dialog is closed
async function revoke() {
  busy.value = true
  try {
    took(await api.del<PlatformCompanyDetail>(`/platform/companies/${code.value}/license`))
    notify.info(t('platform.toast.revoked'))
  } catch (e) { notify.error(perr.of(e)) } finally { busy.value = false; revokeOpen.value = false }
}

function detailsText(row: PlatformAuditRow): string {
  if (!row.details) return ''
  return Object.entries(row.details).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')
}
const actionLabel = (a: string) => (te(`platform.action.${a}`) ? t(`platform.action.${a}`) : a)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <NuxtLink to="/platform" class="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
      <AppIcon name="chevron" class="!size-4 ltr:rotate-180" />{{ $t('platform.companies.title') }}
    </NuxtLink>

    <AppAlert v-if="loadError">{{ loadError }}</AppAlert>
    <p v-else-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="company">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold text-slate-900">{{ company.name }}</h1>
            <PlatformStatus :kind="company.status" />
            <button class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" :title="$t('common.edit')" @click="askRename"><AppIcon name="edit" /></button>
          </div>
          <p class="mt-1 text-sm text-slate-500" dir="ltr">{{ company.code }} · {{ company.database }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton @click="renewOpen = true">{{ $t('platform.detail.renew') }}</AppButton>
          <AppButton variant="secondary" @click="askPlan">{{ $t('platform.detail.changePlan') }}</AppButton>
          <AppButton v-if="company.status === 'active'" variant="danger" @click="askSuspend">{{ $t('platform.detail.suspend') }}</AppButton>
          <AppButton v-else variant="secondary" :loading="busy" @click="activate">{{ $t('platform.detail.activate') }}</AppButton>
        </div>
      </div>

      <AppAlert v-if="company.status === 'suspended'" kind="error">{{ $t('platform.detail.suspendedNote') }}</AppAlert>
      <AppAlert v-else-if="company.subscription.state === 'grace'" kind="warning">{{ $t('platform.detail.graceNote', { date: day(company.subscription.graceEndsAt) }) }}</AppAlert>
      <AppAlert v-else-if="company.subscription.state === 'expired'" kind="error">{{ $t('platform.detail.expiredNote') }}</AppAlert>

      <div class="grid gap-4 md:grid-cols-3">
        <section class="rounded-xl border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-semibold text-slate-900">{{ $t('platform.detail.subscription') }}</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-slate-500">{{ $t('platform.detail.state') }}</dt><dd><PlatformStatus :kind="company.subscription.state" /></dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">{{ $t('platform.detail.endsAt') }}</dt><dd>{{ company.subscription.endsAt ? day(company.subscription.endsAt) : $t('platform.noEnd') }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">{{ $t('platform.detail.graceEndsAt') }}</dt><dd>{{ day(company.subscription.graceEndsAt) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-slate-500">{{ $t('platform.detail.createdAt') }}</dt><dd>{{ day(company.createdAt) }}</dd></div>
          </dl>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-semibold text-slate-900">{{ $t('platform.detail.plan') }}</h2>
          <p class="text-sm font-medium text-slate-900">{{ company.plan ? company.plan.name : $t('platform.noPlan') }}</p>
          <p v-if="!company.plan" class="mt-1 text-xs text-slate-500">{{ $t('platform.noPlanNote') }}</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span v-for="fcode in company.features" :key="fcode" class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">{{ featureLabel(fcode) }}</span>
            <span v-if="company.features.length === 0" class="text-xs text-slate-500">{{ $t('platform.detail.coreOnly') }}</span>
          </div>
          <ul class="mt-3 space-y-1 text-sm">
            <li v-for="(max, lcode) in company.limits" :key="lcode" class="flex justify-between gap-3">
              <span class="text-slate-500">{{ limitLabel(String(lcode)) }}</span>
              <span>{{ max === null ? $t('platform.unlimited') : max }}</span>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-semibold text-slate-900">{{ $t('platform.detail.license') }}</h2>
          <template v-if="company.license.active">
            <p class="text-sm" dir="ltr">ACC-…-{{ company.license.hint }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ $t('platform.detail.issuedAt', { date: day(company.license.issuedAt) }) }}</p>
          </template>
          <p v-else class="text-sm text-slate-500">{{ $t('platform.detail.noLicense') }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <AppButton variant="secondary" :loading="busy" @click="askIssue">{{ company.license.active ? $t('platform.detail.reissue') : $t('platform.detail.issue') }}</AppButton>
            <AppButton v-if="company.license.active" variant="secondary" @click="revokeOpen = true">{{ $t('platform.detail.revoke') }}</AppButton>
          </div>
        </section>
      </div>

      <section v-if="company.overrides.length" class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 class="text-sm font-semibold text-slate-900">{{ $t('platform.detail.overrides') }}</h2>
          <p class="mt-0.5 text-xs text-slate-500">{{ $t('platform.detail.overridesNote') }}</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.item') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.value') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.until') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.reason') }}</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="o in company.overrides" :key="o.kind + o.code" class="border-t border-slate-100">
              <td class="px-4 py-2">{{ o.kind === 'feature' ? featureLabel(o.code) : limitLabel(o.code) }}</td>
              <td class="px-4 py-2">{{ o.kind === 'feature' ? (o.enabled ? $t('platform.on') : $t('platform.off')) : (o.value === null ? $t('platform.unlimited') : o.value) }}</td>
              <td class="px-4 py-2">{{ o.until ? day(o.until) : '—' }}</td>
              <td class="px-4 py-2">{{ o.reason }}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="company.licenses.length" class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">{{ $t('platform.detail.licenseHistory') }}</h2></div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.key') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.state') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.issued') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.revokedAt') }}</th>
              <th class="px-4 py-2 text-start font-medium">{{ $t('platform.detail.lastChecked') }}</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="l in company.licenses" :key="l.id" class="border-t border-slate-100" :class="l.status === 'revoked' ? 'text-slate-400' : ''">
              <td class="px-4 py-2" dir="ltr">ACC-…-{{ l.hint }}</td>
              <td class="px-4 py-2">{{ l.status === 'active' ? $t('platform.license.active') : $t('platform.license.revoked') }}</td>
              <td class="whitespace-nowrap px-4 py-2">{{ dayTime(l.createdAt) }}</td>
              <td class="whitespace-nowrap px-4 py-2">{{ dayTime(l.revokedAt) }}</td>
              <td class="whitespace-nowrap px-4 py-2">{{ l.lastCheckedAt ? dayTime(l.lastCheckedAt) : '—' }}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-100 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">{{ $t('platform.detail.recent') }}</h2></div>
        <ul class="divide-y divide-slate-100 text-sm">
          <li v-if="audit.length === 0" class="px-4 py-6 text-center text-slate-500">{{ $t('platform.audit.empty') }}</li>
          <li v-for="a in audit" :key="a.id" class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <div class="min-w-0">
              <span class="font-medium text-slate-900">{{ actionLabel(a.action) }}</span>
              <span v-if="detailsText(a)" class="ms-2 break-words text-xs text-slate-500" dir="ltr">{{ detailsText(a) }}</span>
            </div>
            <div class="whitespace-nowrap text-xs text-slate-500"><span dir="ltr">{{ a.by }}</span> · {{ dayTime(a.at) }}</div>
          </li>
        </ul>
      </section>

      <RenewModal v-model:open="renewOpen" :company="company" @saved="took" />
      <LicenseKeyModal v-model:open="keyOpen" :license-key="newKey" :company-name="company.name" />

      <AppModal v-model:open="renameOpen" :title="$t('platform.detail.rename')">
        <form novalidate @submit.prevent="rename">
          <AppInput v-model="renameName" :label="$t('platform.create.name')" :error="renameError ? perr.field(renameError, 'name') : null" autofocus />
          <AppAlert v-if="renameError && !perr.field(renameError, 'name')" class="mt-3">{{ perr.of(renameError) }}</AppAlert>
        </form>
        <template #footer>
          <AppButton variant="secondary" @click="renameOpen = false">{{ $t('common.cancel') }}</AppButton>
          <AppButton :loading="busy" @click="rename">{{ $t('common.save') }}</AppButton>
        </template>
      </AppModal>

      <AppModal v-model:open="planOpen" :title="$t('platform.detail.changePlan')">
        <form class="space-y-3" novalidate @submit.prevent="savePlan">
          <AppSelect v-model="planValue" :label="$t('platform.create.plan')" :options="planOptions" />
          <p class="text-xs text-slate-500">{{ $t('platform.detail.planNote') }}</p>
          <AppAlert v-if="planError">{{ perr.of(planError) }}</AppAlert>
        </form>
        <template #footer>
          <AppButton variant="secondary" @click="planOpen = false">{{ $t('common.cancel') }}</AppButton>
          <AppButton :loading="busy" @click="savePlan">{{ $t('common.save') }}</AppButton>
        </template>
      </AppModal>

      <AppModal v-model:open="suspendOpen" :title="$t('platform.detail.suspendTitle', { name: company.name })">
        <form class="space-y-3" novalidate @submit.prevent="suspend">
          <p class="text-sm text-slate-700">{{ $t('platform.detail.suspendMessage') }}</p>
          <AppInput v-model="suspendReason" :label="$t('platform.detail.reason')" :hint="$t('platform.detail.reasonHint')" :error="suspendError ? perr.field(suspendError, 'reason') : null" autofocus />
          <AppAlert v-if="suspendError && !perr.field(suspendError, 'reason')">{{ perr.of(suspendError) }}</AppAlert>
        </form>
        <template #footer>
          <AppButton variant="secondary" @click="suspendOpen = false">{{ $t('common.cancel') }}</AppButton>
          <AppButton variant="danger" :loading="busy" @click="suspend">{{ $t('platform.detail.suspend') }}</AppButton>
        </template>
      </AppModal>

      <ConfirmDialog
          v-model:open="reissueOpen"
          :title="$t('platform.detail.reissue')"
          :message="$t('platform.detail.reissueMessage')"
          :confirm-label="$t('platform.detail.reissue')"
          :loading="busy"
          @confirm="issue"
      />
      <ConfirmDialog
          v-model:open="revokeOpen"
          :title="$t('platform.detail.revoke')"
          :message="$t('platform.detail.revokeMessage')"
          :confirm-label="$t('platform.detail.revoke')"
          :loading="busy"
          @confirm="revoke"
      />
    </template>
  </div>
</template>