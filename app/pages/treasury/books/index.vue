<script setup lang="ts">
import type { ChequeBook } from '~/types/treasury'
import {useTreasuryLookups} from "~/composables/useTreasuryLookups.ts";

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
useHead({ title: computed(() => t('treasury.books.title')) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)

const books = ref<ChequeBook[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const status = ref('active')
const statusOptions = computed(() => [
  { value: 'active', label: t('treasury.books.status.active') },
  { value: 'closed', label: t('treasury.books.status.closed') },
  { value: '', label: t('treasury.filters.all') },
])

async function load() {
  loading.value = true
  error.value = null
  try {
    books.value = (await api.get<{ items: ChequeBook[] }>('/cheque-books', { status: status.value || undefined })).items
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => { void load(); void lookups.load() })
watch(status, () => { void load() })

// ---- new book
const open = ref(false)
const name = ref('')
const bankName = ref('')
const branch = ref('')
const accountId = ref<number | string | null>(null)
const detailId = ref<number | string | null>(null)
const firstNumber = ref('')
const leafCount = ref('25')
const busy = ref(false)
const formError = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

function startNew() {
  name.value = ''
  bankName.value = ''
  branch.value = ''
  accountId.value = null
  detailId.value = null
  firstNumber.value = ''
  leafCount.value = '25'
  formError.value = null
  errs.value = {}
  open.value = true
}

const canSave = computed(() => name.value.trim() !== '' && bankName.value.trim() !== '' && accountId.value !== null
    && /^\d+$/.test(firstNumber.value) && /^\d+$/.test(leafCount.value) && Number(leafCount.value) >= 1 && Number(leafCount.value) <= 200)

async function save() {
  if (!canSave.value) return
  busy.value = true
  formError.value = null
  errs.value = {}
  try {
    const b = await api.post<ChequeBook>('/cheque-books', {
      name: name.value.trim(), bankName: bankName.value.trim(), branch: branch.value.trim() || null,
      bankAccountId: Number(accountId.value), bankDetailId: detailId.value === null ? null : Number(detailId.value),
      firstNumber: Number(firstNumber.value), leafCount: Number(leafCount.value),
    })
    notify.success(t('treasury.books.toast.created', { name: b.name }))
    open.value = false
    await navigateTo(`/treasury/books/${b.id}`)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      for (const f of ['name', 'bankName', 'bankAccountId', 'bankDetailId', 'firstNumber', 'leafCount']) { const m = err.field(f); if (m) errs.value[f] = errorText.text(m) }
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
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('treasury.books.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.books.subtitle') }}</p>
      </div>
      <AppButton v-if="canManage" @click="startNew"><AppIcon name="plus" />{{ $t('treasury.books.new') }}</AppButton>
    </div>

    <div class="w-44"><AppSelect v-model="status" :label="$t('treasury.filters.status')" :options="statusOptions" /></div>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="!books.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p class="font-medium text-slate-800">{{ $t('treasury.books.empty') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ $t('treasury.books.emptyHint') }}</p>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink v-for="b in books" :key="b.id" :to="`/treasury/books/${b.id}`"
                class="block space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="font-semibold text-slate-900">{{ b.name }}</div>
            <div class="text-xs text-slate-500">{{ b.bankName }} · <span dir="ltr">{{ b.firstNumber }}–{{ b.firstNumber + b.leafCount - 1 }}</span></div>
          </div>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'">{{ $t(`treasury.books.status.${b.status}`) }}</span>
        </div>
        <div class="flex gap-1" role="presentation">
          <div class="h-2 rounded-full bg-indigo-500" :style="{ width: (b.issued / b.leafCount) * 100 + '%' }" />
          <div class="h-2 rounded-full bg-slate-400" :style="{ width: (b.voided / b.leafCount) * 100 + '%' }" />
          <div class="h-2 flex-1 rounded-full bg-slate-100" />
        </div>
        <div class="flex justify-between text-xs text-slate-500">
          <span>{{ $t('treasury.books.unused') }}: {{ b.unused }}</span>
          <span>{{ $t('treasury.books.issued') }}: {{ b.issued }}</span>
          <span>{{ $t('treasury.books.voided') }}: {{ b.voided }}</span>
        </div>
        <div v-if="b.nextNumber" class="text-xs text-slate-500">{{ $t('treasury.books.next') }}: <span dir="ltr" class="font-medium text-slate-800">{{ b.nextNumber }}</span></div>
      </NuxtLink>
    </div>

    <AppModal v-model:open="open" :title="$t('treasury.books.newTitle')">
      <div class="space-y-4">
        <AppAlert v-if="formError">{{ formError }}</AppAlert>
        <AppInput v-model="name" :label="$t('treasury.books.form.name')" :error="errs.name" />
        <AppInput v-model="bankName" :label="$t('treasury.form.bankName')" :error="errs.bankName" />
        <AppInput v-model="branch" :label="$t('treasury.form.branch')" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.bankAccount') }}</label>
          <ComboBox v-model="accountId" :options="lookups.bankOptions.value" :invalid="!!errs.bankAccountId"
                    :aria-label="$t('treasury.form.bankAccount')" :placeholder="$t('entries.form.searchAccount')" />
          <p v-if="errs.bankAccountId" class="mt-1 text-xs text-red-600">{{ errs.bankAccountId }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.form.bankDetail') }}</label>
          <ComboBox v-model="detailId" :options="lookups.bankDetailOptions.value" :aria-label="$t('treasury.form.bankDetail')" :placeholder="$t('treasury.form.detailPlaceholder')" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <AppInput v-model="firstNumber" ltr :label="$t('treasury.books.form.firstNumber')" :error="errs.firstNumber" />
          <AppInput v-model="leafCount" ltr :label="$t('treasury.books.form.leafCount')" :hint="$t('treasury.books.form.leafHint')" :error="errs.leafCount" />
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="busy" :disabled="!canSave" @click="save">{{ $t('common.save') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>