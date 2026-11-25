<script setup lang="ts">
import { DETAIL_KINDS, type DetailAccount } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
useHead({ title: computed(() => t('menu.detailAccounts')) })

const LIMIT = 200

const items = ref<DetailAccount[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const search = ref('')
const kind = ref('')
const includeInactive = ref(true)

const canManage = computed(() => session.can('accounts.manage') && !session.readOnly)
const kindFilter = computed(() => [{ value: '', label: t('detail.allKinds') }, ...DETAIL_KINDS.map((k) => ({ value: k, label: t(`detail.kind.${k}`) }))])

let seq = 0
async function load() {
  const mine = ++seq
  loadError.value = null
  try {
    const query: Record<string, unknown> = { limit: LIMIT }
    const q = normalizeDigits(search.value.trim())
    if (q) query.search = q
    if (kind.value) query.kind = kind.value
    if (includeInactive.value) query.includeInactive = 1
    const list = await api.get<any[]>('/detail-accounts', query)
    if (mine !== seq) return // a newer request is on its way
    items.value = list.map((d) => ({
      id: Number(d.id),
      code: String(d.code),
      name: String(d.name),
      kind: d.kind,
      isActive: d.isActive ?? d.is_active ?? true,
    }))
  } catch (e) {
    if (mine === seq) loadError.value = errorText.of(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => { clearTimeout(timer); timer = setTimeout(load, 300) })
watch([kind, includeInactive], load)
onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))

// ---- add / edit
const formOpen = ref(false)
const formAccount = ref<DetailAccount | null>(null)
function add() { formAccount.value = null; formOpen.value = true }
function edit(d: DetailAccount) { formAccount.value = d; formOpen.value = true }

// ---- disable / enable / delete
const busyId = ref<number | null>(null)
async function setActive(d: DetailAccount, active: boolean) {
  busyId.value = d.id
  try {
    await api.patch(`/detail-accounts/${d.id}`, { isActive: active })
    if (active) notify.success(t(active ? 'toast.detailEnabled' : 'toast.detailDisabled', { name: d.name }))
    else notify.info(t(active ? 'toast.detailEnabled' : 'toast.detailDisabled', { name: d.name }))
    await load()
  } catch (e) {
    notify.error(errorText.of(e))
  } finally {
    busyId.value = null
  }
}

const deleting = ref<DetailAccount | null>(null)
const deleteOpen = ref(false)
const deleteBusy = ref(false)
function askDelete(d: DetailAccount) { deleting.value = d; deleteOpen.value = true }
async function doDelete() {
  if (!deleting.value) return
  deleteBusy.value = true
  try {
    const name = deleting.value.name
    await api.del(`/detail-accounts/${deleting.value.id}`)
    notify.success(t('toast.detailDeleted', { name }))
    deleteOpen.value = false
    await load()
  } catch (e) {
    deleteOpen.value = false
    notify.error(errorText.of(e))
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.detailAccounts') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('detail.subtitle') }}</p>
      </div>
      <AppButton v-if="canManage" @click="add"><AppIcon name="plus" />{{ $t('detail.add') }}</AppButton>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div class="relative min-w-56 flex-1 sm:max-w-sm">
        <span class="pointer-events-none absolute inset-y-0 inset-s-3 flex items-center text-slate-400"><AppIcon name="search" /></span>
        <input v-model="search" type="search" :placeholder="$t('detail.searchPlaceholder')" :aria-label="$t('detail.searchPlaceholder')"
               class="block w-full rounded-lg border border-slate-300 bg-white py-2.5 ps-10 pe-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
      </div>
      <div class="w-48"><AppSelect v-model="kind" :label="$t('detail.kindLabel')" :options="kindFilter" /></div>
      <label class="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
        <input v-model="includeInactive" type="checkbox" class="size-4 rounded border-slate-300">{{ $t('accounts.showInactive') }}
      </label>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-140 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-3 text-start font-medium">{{ $t('detail.name') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('detail.code') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('detail.kindLabel') }}</th>
          <th class="px-4 py-3" />
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-if="loading"><td colspan="4" class="px-4 py-10 text-center text-slate-500">{{ $t('common.loading') }}</td></tr>
        <tr v-else-if="items.length === 0">
          <td colspan="4" class="px-4 py-10 text-center text-slate-500">{{ search || kind ? $t('accounts.noMatch') : $t('detail.empty') }}</td>
        </tr>
        <tr v-for="d in items" :key="d.id" :class="d.isActive ? '' : 'bg-slate-50 text-slate-400'">
          <td class="px-4 py-2.5">
            {{ d.name }}
            <span v-if="!d.isActive" class="ms-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">{{ $t('accounts.inactive') }}</span>
          </td>
          <td class="px-4 py-2.5 font-mono" dir="ltr">{{ d.code }}</td>
          <td class="px-4 py-2.5">{{ $t(`detail.kind.${d.kind}`) }}</td>
          <td class="px-4 py-2.5">
            <div v-if="canManage" class="flex justify-end gap-1 text-slate-500">
              <button class="rounded p-1.5 hover:bg-slate-100 hover:text-indigo-600" :title="$t('common.edit')" @click="edit(d)"><AppIcon name="edit" /></button>
              <button class="rounded p-1.5 hover:bg-slate-100 hover:text-amber-600 disabled:opacity-50" :disabled="busyId === d.id"
                      :title="d.isActive ? $t('accounts.disable') : $t('accounts.enable')" @click="setActive(d, !d.isActive)"><AppIcon name="power" /></button>
              <button class="rounded p-1.5 hover:bg-slate-100 hover:text-red-600" :title="$t('common.delete')" @click="askDelete(d)"><AppIcon name="trash" /></button>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
    <p v-if="items.length >= LIMIT" class="text-xs text-slate-500">{{ $t('detail.limitNote', { n: LIMIT }) }}</p>

    <DetailFormModal v-model:open="formOpen" :account="formAccount" @saved="load" />
    <ConfirmDialog v-model:open="deleteOpen" :title="$t('detail.deleteTitle')"
                   :message="$t('detail.deleteMessage', { name: deleting?.name ?? '', code: deleting?.code ?? '' })"
                   :confirm-label="$t('common.delete')" :loading="deleteBusy" @confirm="doDelete" />
  </div>
</template>