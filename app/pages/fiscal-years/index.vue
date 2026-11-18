<script setup lang="ts">
import type { FiscalYear } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('menu.fiscalYears')) })

const years = ref<FiscalYear[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const notice = ref<string[]>([])

const canManage = computed(() => session.can('fiscal-years.manage') && !session.readOnly)
const canClose = computed(() => session.can('fiscal-years.close') && !session.readOnly)

async function load() {
  loadError.value = null
  try {
    const list = await api.get<FiscalYear[]>('/fiscal-years')
    years.value = list.map((y) => ({
      ...y,
      id: Number(y.id),
      postedEntries: Number(y.postedEntries),
      draftEntries: Number(y.draftEntries),
    }))
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---- add / edit
const formOpen = ref(false)
const formYear = ref<FiscalYear | null>(null)
function add() { formYear.value = null; formOpen.value = true }
function edit(y: FiscalYear) { formYear.value = y; formOpen.value = true }
function saved(warnings: string[]) { notice.value = warnings; load() }

// ---- close / reopen
const closeOpen = ref(false)
const reopenOpen = ref(false)
const target = ref<FiscalYear | null>(null)
function askClose(y: FiscalYear) { target.value = y; closeOpen.value = true }
function askReopen(y: FiscalYear) { target.value = y; reopenOpen.value = true }

// ---- delete
const deleteOpen = ref(false)
const deleteBusy = ref(false)
function askDelete(y: FiscalYear) { target.value = y; deleteOpen.value = true }
async function doDelete() {
  if (!target.value) return
  actionError.value = null
  deleteBusy.value = true
  try {
    await api.del(`/fiscal-years/${target.value.id}`)
    deleteOpen.value = false
    await load()
  } catch (e) {
    deleteOpen.value = false
    actionError.value = errorText.of(e)
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.fiscalYears') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('fiscal.subtitle') }}</p>
      </div>
      <AppButton v-if="canManage" @click="add"><AppIcon name="plus" />{{ $t('fiscal.add') }}</AppButton>
    </div>

    <AppAlert v-if="actionError">{{ actionError }}</AppAlert>
    <AppAlert v-if="notice.length" kind="warning">
      <ul class="list-disc space-y-0.5 ps-5"><li v-for="(w, i) in notice" :key="i">{{ w }}</li></ul>
    </AppAlert>
    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-170 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-3 text-start font-medium">{{ $t('fiscal.title') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('fiscal.start') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('fiscal.end') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('fiscal.entries') }}</th>
          <th class="px-4 py-3 text-start font-medium">{{ $t('fiscal.status') }}</th>
          <th class="px-4 py-3" />
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-if="loading"><td colspan="6" class="px-4 py-10 text-center text-slate-500">{{ $t('common.loading') }}</td></tr>
        <tr v-else-if="years.length === 0"><td colspan="6" class="px-4 py-10 text-center text-slate-500">{{ $t('fiscal.empty') }}</td></tr>
        <tr v-for="y in years" :key="y.id">
          <td class="px-4 py-2.5 font-medium">{{ y.title }}</td>
          <td class="px-4 py-2.5" dir="ltr">{{ fmt.date(y.startDate) }}</td>
          <td class="px-4 py-2.5" dir="ltr">{{ fmt.date(y.endDate) }}</td>
          <td class="px-4 py-2.5 text-slate-600">
            {{ $t('fiscal.entriesCount', { posted: fmt.money(y.postedEntries), drafts: fmt.money(y.draftEntries) }) }}
          </td>
          <td class="px-4 py-2.5">
              <span class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="y.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'">
                {{ $t(`fiscal.statuses.${y.status}`) }}
              </span>
          </td>
          <td class="px-4 py-2.5">
            <div class="flex justify-end gap-1 text-slate-500">
              <button v-if="canManage" class="rounded p-1.5 hover:bg-slate-100 hover:text-indigo-600" :title="$t('common.edit')" @click="edit(y)"><AppIcon name="edit" /></button>
              <button v-if="canClose && y.status === 'open'" class="rounded p-1.5 hover:bg-slate-100 hover:text-amber-600" :title="$t('fiscal.close')" @click="askClose(y)"><AppIcon name="lock" /></button>
              <button v-if="canClose && y.status === 'closed'" class="rounded p-1.5 hover:bg-slate-100 hover:text-emerald-600" :title="$t('fiscal.reopen')" @click="askReopen(y)"><AppIcon name="unlock" /></button>
              <button v-if="canManage && y.status === 'open' && !y.hasEntries" class="rounded p-1.5 hover:bg-slate-100 hover:text-red-600" :title="$t('common.delete')" @click="askDelete(y)"><AppIcon name="trash" /></button>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <FiscalYearFormModal v-model:open="formOpen" :year="formYear" @saved="saved" />
    <CloseYearModal v-model:open="closeOpen" :year="target" @closed="load" />
    <ReopenYearModal v-model:open="reopenOpen" :year="target" @reopened="load" />
    <ConfirmDialog v-model:open="deleteOpen" :title="$t('fiscal.deleteTitle')"
                   :message="$t('fiscal.deleteMessage', { title: target?.title ?? '' })"
                   :confirm-label="$t('common.delete')" :loading="deleteBusy" @confirm="doDelete" />
  </div>
</template>