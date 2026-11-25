<script setup lang="ts">
import type { Account } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
useHead({ title: computed(() => t('menu.accounts')) })

const accounts = ref<Account[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const search = ref('')
const showInactive = ref(true)
const expanded = ref<Set<number>>(new Set())

const canManage = computed(() => session.can('accounts.manage') && !session.readOnly)

async function load() {
  loadError.value = null
  try {
    const list = await api.get<Account[]>('/accounts')
    accounts.value = list.map((a) => ({ ...a, id: Number(a.id), parentId: a.parentId === null ? null : Number(a.parentId), level: Number(a.level) as Account['level'] }))
    // first time: open the top level so the person sees something useful
    if (expanded.value.size === 0) expanded.value = new Set(accounts.value.filter((a) => a.level === 1).map((a) => a.id))
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const children = computed(() => {
  const m = new Map<number | null, Account[]>()
  for (const a of accounts.value) {
    if (!showInactive.value && !a.isActive) continue
    const k = a.parentId
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(a)
  }
  return m
})

const query = computed(() => normalizeDigits(search.value.trim().toLowerCase()))

/** ids that match the search, plus all their ancestors (so the path to a hit is visible) */
const visibleIds = computed<Set<number> | null>(() => {
  const q = query.value
  if (!q) return null
  const byId = new Map(accounts.value.map((a) => [a.id, a]))
  const keep = new Set<number>()
  for (const a of accounts.value) {
    if (a.code.includes(q) || a.name.toLowerCase().includes(q)) {
      let cur: Account | undefined = a
      while (cur) {
        keep.add(cur.id)
        cur = cur.parentId === null ? undefined : byId.get(cur.parentId)
      }
    }
  }
  return keep
})

const rows = computed(() => {
  const out: Account[] = []
  const walk = (parent: number | null) => {
    for (const a of children.value.get(parent) ?? []) {
      if (visibleIds.value && !visibleIds.value.has(a.id)) continue
      out.push(a)
      if (visibleIds.value || expanded.value.has(a.id)) walk(a.id)
    }
  }
  walk(null)
  return out
})

function toggle(a: Account) {
  const s = new Set(expanded.value)
  if (s.has(a.id)) s.delete(a.id)
  else s.add(a.id)
  expanded.value = s
}
function expandAll(open: boolean) {
  expanded.value = open ? new Set(accounts.value.filter((a) => a.hasChildren).map((a) => a.id)) : new Set()
}

// ---- add / edit
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formParent = ref<Account | null>(null)
const formAccount = ref<Account | null>(null)

function addTop() { formMode.value = 'create'; formParent.value = null; formAccount.value = null; formOpen.value = true }
function addChild(a: Account) {
  formMode.value = 'create'; formParent.value = a; formAccount.value = null; formOpen.value = true
  expanded.value = new Set(expanded.value).add(a.id)
}
function edit(a: Account) { formMode.value = 'edit'; formParent.value = null; formAccount.value = a; formOpen.value = true }

// ---- disable / enable / delete
const busyId = ref<number | null>(null)
async function setActive(a: Account, active: boolean) {
  busyId.value = a.id
  try {
    await api.patch(`/accounts/${a.id}`, { isActive: active })
    if (active) notify.success(t(active ? 'toast.accountEnabled' : 'toast.accountDisabled', { name: a.name }))
    else notify.info(t(active ? 'toast.accountEnabled' : 'toast.accountDisabled', { name: a.name }))
    await load()
  } catch (e) {
    notify.error(errorText.of(e))
  } finally {
    busyId.value = null
  }
}

const deleting = ref<Account | null>(null)
const deleteOpen = ref(false)
const deleteBusy = ref(false)
function askDelete(a: Account) { deleting.value = a; deleteOpen.value = true }
async function doDelete() {
  if (!deleting.value) return
  deleteBusy.value = true
  try {
    const name = deleting.value.name
    await api.del(`/accounts/${deleting.value.id}`)
    notify.success(t('toast.accountDeleted', { name }))
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
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.accounts') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('accounts.subtitle') }}</p>
      </div>
      <AppButton v-if="canManage" @click="addTop"><AppIcon name="plus" />{{ $t('accounts.addGroup') }}</AppButton>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-56 flex-1 sm:max-w-sm">
        <span class="pointer-events-none absolute inset-y-0 inset-s-3 flex items-center text-slate-400"><AppIcon name="search" /></span>
        <input v-model="search" type="search" :placeholder="$t('accounts.searchPlaceholder')" :aria-label="$t('accounts.searchPlaceholder')"
               class="block w-full rounded-lg border border-slate-300 bg-white py-2.5 ps-10 pe-3 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="showInactive" type="checkbox" class="size-4 rounded border-slate-300">{{ $t('accounts.showInactive') }}
      </label>
      <div class="flex gap-2 text-sm">
        <button class="text-indigo-600 hover:underline" @click="expandAll(true)">{{ $t('accounts.expandAll') }}</button>
        <span class="text-slate-300">|</span>
        <button class="text-indigo-600 hover:underline" @click="expandAll(false)">{{ $t('accounts.collapseAll') }}</button>
      </div>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-160 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-3 text-start font-medium">{{ $t('accounts.name') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('accounts.code') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('accounts.natureLabel') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('accounts.type') }}</th>
          <th class="px-4 py-3" />
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-if="loading"><td colspan="5" class="px-4 py-10 text-center text-slate-500">{{ $t('common.loading') }}</td></tr>
        <tr v-else-if="rows.length === 0">
          <td colspan="5" class="px-4 py-10 text-center text-slate-500">{{ query ? $t('accounts.noMatch') : $t('accounts.empty') }}</td>
        </tr>
        <tr v-for="a in rows" :key="a.id" :class="a.isActive ? '' : 'bg-slate-50 text-slate-400'">
          <td class="px-4 py-2.5">
            <div class="flex items-center gap-1" :style="{ paddingInlineStart: `${(a.level - 1) * 1.5}rem` }">
              <button v-if="a.hasChildren && !visibleIds" class="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                      :aria-label="expanded.has(a.id) ? $t('accounts.collapse') : $t('accounts.expand')" @click="toggle(a)">
                <AppIcon name="chevron" class="size-4 transition-transform" :class="expanded.has(a.id) ? 'rotate-90' : 'rtl:rotate-180'" />
              </button>
              <span v-else class="inline-block size-5" />
              <span :class="a.level === 1 ? 'font-bold' : a.level === 2 ? 'font-semibold' : ''">{{ a.name }}</span>
              <span v-if="!a.isActive" class="ms-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">{{ $t('accounts.inactive') }}</span>
            </div>
          </td>
          <td class="px-4 py-2.5 font-mono" dir="ltr">{{ a.code }}</td>
          <td class="px-4 py-2.5">{{ $t(`accounts.nature.${a.nature}`) }}</td>
          <td class="px-4 py-2.5">
            <span class="text-xs">{{ $t(`accounts.level.${a.level}`) }}</span>
            <span v-if="a.requiresDetail" class="ms-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{{ $t('accounts.detailTag') }}</span>
          </td>
          <td class="px-4 py-2.5">
            <div v-if="canManage" class="flex justify-end gap-1 text-slate-500">
              <button v-if="a.level < 3 && a.isActive" class="rounded p-1.5 hover:bg-slate-100 hover:text-indigo-600" :title="$t('accounts.addChild')" @click="addChild(a)"><AppIcon name="plus" /></button>
              <button class="rounded p-1.5 hover:bg-slate-100 hover:text-indigo-600" :title="$t('common.edit')" @click="edit(a)"><AppIcon name="edit" /></button>
              <button class="rounded p-1.5 hover:bg-slate-100 hover:text-amber-600 disabled:opacity-50" :disabled="busyId === a.id"
                      :title="a.isActive ? $t('accounts.disable') : $t('accounts.enable')" @click="setActive(a, !a.isActive)"><AppIcon name="power" /></button>
              <button v-if="!a.hasChildren && !a.hasEntries" class="rounded p-1.5 hover:bg-slate-100 hover:text-red-600" :title="$t('common.delete')" @click="askDelete(a)"><AppIcon name="trash" /></button>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <AccountFormModal v-model:open="formOpen" :mode="formMode" :parent="formParent" :account="formAccount" @saved="load" />
    <ConfirmDialog v-model:open="deleteOpen" :title="$t('accounts.deleteTitle')"
                   :message="$t('accounts.deleteMessage', { name: deleting?.name ?? '', code: deleting?.code ?? '' })"
                   :confirm-label="$t('common.delete')" :loading="deleteBusy" @confirm="doDelete" />
  </div>
</template>