<script setup lang="ts">
import type { Role, UserItem, UserPage } from '~/types/api'
import UserFormModal from "~/pages/users/UserFormModal.vue";
import ResetPasswordModal from "~/pages/users/ResetPasswordModal.vue";

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
const roleLabel = useRoleLabel()
useHead({ title: computed(() => t('users.title')) })

const PAGE_SIZE = 25

const data = ref<UserPage>({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 })
const roles = ref<Role[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const search = ref('')
const status = ref('')
const page = ref(1)

const canManage = computed(() => session.can('users.manage') && !session.readOnly)
const statusOptions = computed(() => [
  { value: '', label: t('users.allStatuses') },
  { value: '1', label: t('users.active') },
  { value: '0', label: t('users.inactive') },
])

let seq = 0
async function load() {
  const mine = ++seq
  loadError.value = null
  try {
    const query: Record<string, unknown> = { page: page.value, pageSize: PAGE_SIZE }
    const q = search.value.trim()
    if (q) query.search = q
    if (status.value) query.isActive = status.value
    const res = await api.get<UserPage>('/users', query)
    if (mine === seq) data.value = res
  } catch (e) {
    if (mine === seq) loadError.value = errorText.of(e)
  } finally {
    if (mine === seq) loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 300) })
watch(status, () => { page.value = 1; load() })
watch(page, load)
onBeforeUnmount(() => clearTimeout(timer))
onMounted(async () => {
  load()
  try { roles.value = await api.get<Role[]>('/roles') } catch (e) { loadError.value = errorText.of(e) }
})

// ---- add / edit / reset password
const formOpen = ref(false)
const formUser = ref<UserItem | null>(null)
function add() { formUser.value = null; formOpen.value = true }
function edit(u: UserItem) { formUser.value = u; formOpen.value = true }
const resetOpen = ref(false)
const resetUser = ref<UserItem | null>(null)
function askReset(u: UserItem) { resetUser.value = u; resetOpen.value = true }

// ---- disable / enable
const busyId = ref<number | null>(null)
const disableOpen = ref(false)
const disableTarget = ref<UserItem | null>(null)
async function setActive(u: UserItem, active: boolean) {
  busyId.value = u.id
  try {
    await api.patch(`/users/${u.id}`, { isActive: active })
    if (active) notify.success(t(active ? 'toast.userEnabled' : 'toast.userDisabled', { name: u.fullName }))
    else notify.info(t(active ? 'toast.userEnabled' : 'toast.userDisabled', { name: u.fullName }))
    await load()
  } catch (e) {
    notify.error(errorText.of(e))
  } finally {
    busyId.value = null
    disableOpen.value = false
  }
}
function toggle(u: UserItem) {
  if (u.isActive) { disableTarget.value = u; disableOpen.value = true } else setActive(u, true)
}

function lastLogin(v: string | null): string {
  if (!v) return t('users.never')
  const time = /[T ](\d{2}:\d{2})/.exec(v)?.[1] ?? ''
  return `${fmt.date(v.slice(0, 10))} ${time}`
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('users.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('users.subtitle') }}</p>
      </div>
      <div class="flex justify-end gap-2">
        <NuxtLink to="/roles" class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{{ $t('roles.title') }}</NuxtLink>
        <AppButton v-if="canManage" @click="add"><AppIcon name="plus" />{{ $t('users.add') }}</AppButton>
      </div>
    </div>

    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div class="min-w-56 flex-1"><AppInput v-model="search" :label="$t('users.search')" /></div>
      <div class="w-48"><AppSelect v-model="status" :label="$t('users.status')" :options="statusOptions" /></div>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-205 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('users.fullName') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('users.username') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('users.role') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('users.status') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('users.lastLogin') }}</th>
          <th v-if="canManage" class="px-4 py-2.5" />
        </tr>
        </thead>
        <tbody>
        <tr v-if="data.items.length === 0"><td colspan="6" class="px-4 py-10 text-center text-slate-500">{{ $t('users.empty') }}</td></tr>
        <tr v-for="u in data.items" :key="u.id" class="border-t border-slate-100 hover:bg-slate-50/60" :class="u.isActive ? '' : 'text-slate-400'">
          <td class="px-4 py-2.5 font-medium">{{ u.fullName }}<span v-if="u.id === session.user?.id" class="ms-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-normal text-indigo-700">{{ $t('users.you') }}</span></td>
          <td class="px-4 py-2.5" dir="ltr">{{ u.username }}</td>
          <td class="px-4 py-2.5"><span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{{ roleLabel(u.role) }}</span></td>
          <td class="px-4 py-2.5">
            <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ u.isActive ? $t('users.active') : $t('users.inactive') }}</span>
          </td>
          <td class="whitespace-nowrap px-4 py-2.5" dir="ltr">{{ lastLogin(u.lastLoginAt) }}</td>
          <td v-if="canManage" class="px-4 py-2.5">
            <div class="flex justify-end gap-1">
              <button class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" :title="$t('common.edit')" @click="edit(u)"><AppIcon name="edit" /></button>
              <template v-if="u.id !== session.user?.id">
                <button class="rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100" @click="askReset(u)">{{ $t('users.resetBtn') }}</button>
                <button class="rounded-lg px-2.5 py-1.5 text-xs hover:bg-slate-100" :class="u.isActive ? 'text-red-600' : 'text-emerald-700'" :disabled="busyId === u.id" @click="toggle(u)">
                  {{ u.isActive ? $t('users.disable') : $t('users.enable') }}
                </button>
              </template>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <AppPagination v-if="data.total > PAGE_SIZE" v-model:page="page" :page-size="PAGE_SIZE" :total="data.total" />

    <UserFormModal v-model:open="formOpen" :user="formUser" :roles="roles" @saved="load" />
    <ResetPasswordModal v-model:open="resetOpen" :user="resetUser" />
    <ConfirmDialog
        v-model:open="disableOpen"
        :title="$t('users.disableTitle', { name: disableTarget?.fullName ?? '' })"
        :message="$t('users.disableMessage')"
        :confirm-label="$t('users.disable')"
        :loading="busyId !== null"
        @confirm="disableTarget && setActive(disableTarget, false)"
    />
  </div>
</template>