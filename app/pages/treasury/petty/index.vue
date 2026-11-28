<script setup lang="ts">
import type { PettyFund } from '~/types/treasury'

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
const fmt = useFormat()
useHead({ title: computed(() => t('treasury.petty.title')) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)

const funds = ref<PettyFund[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const status = ref('active')

const statusOptions = computed(() => [
  { value: 'active', label: t('treasury.petty.status.active') },
  { value: 'closed', label: t('treasury.petty.status.closed') },
  { value: '', label: t('treasury.filters.all') },
])

async function load() {
  loading.value = true
  error.value = null
  try {
    funds.value = (await api.get<{ items: PettyFund[] }>('/petty-funds', { status: status.value || undefined })).items
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => { void load(); void lookups.load() })
watch(status, () => { void load() })

// ---- new fund
const open = ref(false)
const name = ref('')
const accountId = ref<number | string | null>(null)
const custodianId = ref<number | string | null>(null)
const ceiling = ref<number | null>(null)
const busy = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

function startNew() {
  name.value = ''
  accountId.value = null
  custodianId.value = null
  ceiling.value = null
  formError.value = null
  errs.value = {}
  open.value = true
}
watch([name, accountId, custodianId, ceiling], () => { errs.value = {} })

// the same rules as the server: nothing is sent until every one of them is met
function check(): boolean {
  const e: Record<string, string> = {}
  if (name.value.trim() === '') e.name = t('treasury.check.nameRequired')
  if (accountId.value === null) e.fundAccountId = t('treasury.check.accountRequired')
  if (!ceiling.value || ceiling.value <= 0) e.ceiling = t('treasury.check.ceilingRequired')
  errs.value = e
  return Object.keys(e).length === 0
}

async function save() {
  formError.value = null
  if (!check()) return
  busy.value = true
  errs.value = {}
  try {
    const f = await api.post<PettyFund>('/petty-funds', {
      name: name.value.trim(),
      fundAccountId: Number(accountId.value),
      custodianDetailId: custodianId.value === null ? null : Number(custodianId.value),
      ceiling: ceiling.value,
    })
    notify.success(t('treasury.petty.toast.created', { name: f.name }))
    open.value = false
    await navigateTo(`/treasury/petty/${f.id}`)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['name', 'fundAccountId', 'custodianDetailId', 'ceiling']) { const m = err.field(f); if (m) errs.value[f] = errorText.text(m) }
      if (!Object.keys(errs.value).length) formError.value = errorText.of(e)
    } else {
      formError.value = errorText.of(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('treasury.petty.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.petty.subtitle') }}</p>
      </div>
      <AppButton v-if="canManage" @click="startNew"><AppIcon name="plus" />{{ $t('treasury.petty.new') }}</AppButton>
    </div>

    <div class="w-44"><AppSelect v-model="status" :label="$t('treasury.filters.status')" :options="statusOptions" /></div>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="!funds.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p class="font-medium text-slate-800">{{ $t('treasury.petty.empty') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ $t('treasury.petty.emptyHint') }}</p>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink v-for="f in funds" :key="f.id" :to="`/treasury/petty/${f.id}`"
                class="block space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="font-semibold text-slate-900">{{ f.name }}</div>
            <div class="text-xs text-slate-500">{{ f.custodianName ?? $t('treasury.petty.noCustodian') }}</div>
          </div>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="f.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'">{{ $t(`treasury.petty.status.${f.status}`) }}</span>
        </div>
        <div>
          <div class="text-xs text-slate-500">{{ $t('treasury.petty.onHand') }}</div>
          <div class="text-xl font-bold tabular-nums text-slate-900">{{ fmt.money(f.onHand) }} <span class="text-sm font-normal text-slate-500">{{ $t('common.rial') }}</span></div>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
          <div class="h-full bg-indigo-500" :style="{ width: Math.min(100, Math.round((f.funded / f.ceiling) * 100)) + '%' }" />
        </div>
        <div class="flex justify-between text-xs text-slate-500">
          <span>{{ $t('treasury.petty.funded') }}: {{ fmt.money(f.funded) }}</span>
          <span>{{ $t('treasury.petty.ceiling') }}: {{ fmt.money(f.ceiling) }}</span>
        </div>
      </NuxtLink>
    </div>

    <AppModal v-model:open="open" :title="$t('treasury.petty.newTitle')">
      <div class="space-y-4">
        <AppAlert v-if="formError">{{ formError }}</AppAlert>
        <AppInput v-model="name" :label="$t('treasury.petty.form.name')" :error="errs.name" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.petty.form.account') }}</label>
          <ComboBox v-model="accountId" :options="lookups.accountOptions.value" :invalid="!!errs.fundAccountId"
                    :aria-label="$t('treasury.petty.form.account')" :placeholder="$t('entries.form.searchAccount')" />
          <p class="mt-1 text-xs" :class="errs.fundAccountId ? 'text-red-600' : 'text-slate-500'">{{ errs.fundAccountId ?? $t('treasury.petty.form.accountHint') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.petty.form.custodian') }}</label>
          <ComboBox v-model="custodianId" :options="lookups.detailOptions.value" :invalid="!!errs.custodianDetailId"
                    :aria-label="$t('treasury.petty.form.custodian')" :placeholder="$t('treasury.form.detailPlaceholder')" />
          <p v-if="errs.custodianDetailId" class="mt-1 text-xs text-red-600">{{ errs.custodianDetailId }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.petty.ceiling') }}</label>
          <MoneyInput v-model="ceiling" :invalid="!!errs.ceiling" :aria-label="$t('treasury.petty.ceiling')" />
          <p v-if="errs.ceiling" class="mt-1 text-xs text-red-600">{{ errs.ceiling }}</p>
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="busy" @click="save">{{ $t('common.save') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>