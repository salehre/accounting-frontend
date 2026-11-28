<script setup lang="ts">
import type { ChequeBookDetail, ChequeLeaf } from '~/types/treasury'

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()

const id = computed(() => Number(route.params.id))
const book = ref<ChequeBookDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
useHead({ title: computed(() => book.value?.name ?? t('treasury.books.title')) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)
const active = computed(() => book.value?.status === 'active')

async function load() {
  loading.value = true
  error.value = null
  try {
    book.value = await api.get<ChequeBookDetail>(`/cheque-books/${id.value}`)
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const LEAF_STYLE: Record<string, string> = {
  unused: 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300',
  issued: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  voided: 'border-slate-200 bg-slate-100 text-slate-400 line-through',
}

// ---- void a leaf / close the book
type Modal = 'void' | 'close' | null
const modal = ref<Modal>(null)
const isOpen = computed({ get: () => modal.value !== null, set: (v: boolean) => { if (!v) modal.value = null } })
const leaf = ref<ChequeLeaf | null>(null)
const reason = ref('')
const busy = ref(false)
const formError = ref<string | null>(null)
const reasonError = ref<string | null>(null)

function startVoid(l: ChequeLeaf) {
  if (!canManage.value || !active.value || l.status !== 'unused') return
  leaf.value = l
  reason.value = ''
  formError.value = null
  reasonError.value = null
  modal.value = 'void'
}
function startClose() {
  formError.value = null
  modal.value = 'close'
}

watch(reason, () => { reasonError.value = null })

async function submit() {
  formError.value = null
  reasonError.value = null
  // the same rule as the server: nothing is sent until it is met
  if (modal.value === 'void' && reason.value.trim().length < 3) { reasonError.value = t('treasury.check.voidReasonShort'); return }
  busy.value = true
  try {
    if (modal.value === 'void') {
      book.value = await api.post<ChequeBookDetail>(`/cheque-books/${id.value}/leaves/${leaf.value!.id}/void`, { reason: reason.value.trim() })
      notify.success(t('treasury.books.toast.voided'))
    } else {
      book.value = await api.post<ChequeBookDetail>(`/cheque-books/${id.value}/close`)
      notify.success(t('treasury.books.toast.closed'))
    }
    modal.value = null
  } catch (e) {
    const err = toApiError(e)
    const m = err.status === 422 ? err.field('reason') : null
    if (m) reasonError.value = errorText.text(m)
    else formError.value = errorText.of(e)
    if (err.status === 409) { notify.error(formError.value ?? ''); modal.value = null; await load() }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <NuxtLink to="/treasury/books" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.books.title') }}</NuxtLink>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="book">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
            <span>{{ book.name }}</span>
            <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'">{{ $t(`treasury.books.status.${book.status}`) }}</span>
          </h1>
          <p class="mt-1 text-sm text-slate-600">{{ book.bankName }}<span v-if="book.branch"> · {{ book.branch }}</span> · {{ book.bankAccount }}<span v-if="book.bankDetailName"> · {{ book.bankDetailName }}</span></p>
        </div>
        <div v-if="canManage && active" class="flex flex-wrap gap-2">
          <NuxtLink v-if="book.nextLeafId" :to="{ path: '/treasury/new', query: { book: book.id } }"
                    class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">{{ $t('treasury.books.issueCheque') }}</NuxtLink>
          <AppButton variant="secondary" @click="startClose">{{ $t('treasury.books.close') }}</AppButton>
        </div>
      </div>

      <section class="grid gap-3 sm:grid-cols-4">
        <div v-for="c in [
          { k: 'unused', v: book.unused }, { k: 'issued', v: book.issued }, { k: 'voided', v: book.voided }, { k: 'leafCount', v: book.leafCount },
        ]" :key="c.k" class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="text-xs text-slate-500">{{ $t(`treasury.books.${c.k}`) }}</div>
          <div class="mt-1 text-xl font-bold tabular-nums text-slate-900">{{ fmt.money(c.v) }}</div>
        </div>
      </section>

      <p v-if="canManage && active" class="text-xs text-slate-500">{{ $t('treasury.books.leafHint') }}</p>

      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <li v-for="l in book.leaves" :key="l.id">
          <NuxtLink v-if="l.chequeId" :to="`/treasury/${l.chequeId}`" class="block rounded-lg border p-3 text-sm" :class="LEAF_STYLE[l.status === 'voided' ? 'voided' : 'issued']">
            <div class="font-semibold tabular-nums" dir="ltr">{{ l.number }}</div>
            <div class="text-xs">{{ l.status === 'voided' ? $t('treasury.books.leafStatus.voided') : $t('treasury.books.leafStatus.issued') }}</div>
            <div v-if="l.chequeAmount" class="mt-1 text-xs tabular-nums">{{ fmt.money(l.chequeAmount) }}</div>
          </NuxtLink>
          <component :is="canManage && active && l.status === 'unused' ? 'button' : 'div'" v-else :type="canManage && active && l.status === 'unused' ? 'button' : undefined"
                     class="block w-full rounded-lg border p-3 text-start text-sm" :class="LEAF_STYLE[l.status]" @click="startVoid(l)">
            <div class="font-semibold tabular-nums" dir="ltr">{{ l.number }}</div>
            <div class="text-xs">{{ $t(`treasury.books.leafStatus.${l.status}`) }}</div>
            <div v-if="l.voidReason" class="mt-1 text-xs">{{ l.voidReason }}</div>
          </component>
        </li>
      </ul>
    </template>

    <AppModal v-model:open="isOpen" :title="modal === 'close' ? $t('treasury.books.closeTitle') : $t('treasury.books.voidTitle', { n: leaf?.number ?? '' })">
      <div class="space-y-4">
        <AppAlert v-if="formError">{{ formError }}</AppAlert>
        <template v-if="modal === 'void'">
          <p class="text-sm text-slate-600">{{ $t('treasury.books.voidHint') }}</p>
          <AppInput v-model="reason" :label="$t('treasury.books.voidReason')" :error="reasonError" />
        </template>
        <p v-else class="text-sm text-slate-600">{{ $t('treasury.books.closeHint') }}</p>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="modal = null">{{ $t('common.cancel') }}</AppButton>
        <AppButton variant="danger" :loading="busy" @click="submit">{{ $t('treasury.petty.confirm') }}</AppButton>
      </template>
    </AppModal>
  </div>
</template>