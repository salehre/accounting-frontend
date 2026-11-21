<script setup lang="ts">
import type { PermissionCatalog, Role } from '~/types/api'
import RoleFormModal from "~/pages/roles/RoleFormModal.vue";

const { t, te } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
const roleLabel = useRoleLabel()
useHead({ title: computed(() => t('roles.title')) })

const roles = ref<Role[]>([])
const catalog = ref<PermissionCatalog>({ permissions: [], requires: {} })
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)

// custom roles are a feature of the plan: without it the page only shows the roles
const canEdit = computed(() => session.can('users.manage') && session.hasFeature('roles.custom') && !session.readOnly)
const planLimited = computed(() => !session.hasFeature('roles.custom'))

async function load() {
  loadError.value = null
  try {
    const [r, c] = await Promise.all([api.get<Role[]>('/roles'), api.get<PermissionCatalog>('/permissions')])
    roles.value = r
    catalog.value = c
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const permName = (p: string) => (te(`perm.${permKey(p)}.name`) ? t(`perm.${permKey(p)}.name`) : p)
const shown = (r: Role) => r.permissions.filter((p) => !p.endsWith('.read')).slice(0, 4)

const formOpen = ref(false)
const formRole = ref<Role | null>(null)
function add() { formRole.value = null; formOpen.value = true }
function edit(r: Role) { formRole.value = r; formOpen.value = true }

const deleting = ref<Role | null>(null)
const deleteOpen = ref(false)
const deleteBusy = ref(false)
function askDelete(r: Role) { deleting.value = r; deleteOpen.value = true }
async function doDelete() {
  if (!deleting.value) return
  actionError.value = null
  deleteBusy.value = true
  try {
    const name = deleting.value.name
    await api.del(`/roles/${deleting.value.id}`)
    notify.success(t('toast.roleDeleted', { name }))
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
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/users" class="text-sm text-indigo-600 hover:underline">{{ $t('users.title') }}</NuxtLink>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('roles.title') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('roles.subtitle') }}</p>
      </div>
      <AppButton v-if="canEdit" @click="add"><AppIcon name="plus" />{{ $t('roles.add') }}</AppButton>
    </div>

    <AppAlert v-if="planLimited" kind="info">{{ $t('roles.planLimited') }}</AppAlert>
    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <AppAlert v-if="actionError">{{ actionError }}</AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <section v-for="r in roles" :key="r.id" class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-slate-900">{{ roleLabel(r.name) }}</h2>
            <p class="text-xs text-slate-500">{{ $t('roles.userCount', { n: fmt.money(r.userCount) }) }}</p>
          </div>
          <span v-if="r.builtIn" class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{{ $t('roles.builtInBadge') }}</span>
        </div>

        <p v-if="r.permissions.includes('*')" class="text-sm text-slate-700">{{ $t('roles.everything') }}</p>
        <div v-else class="flex flex-wrap gap-1.5">
          <span v-for="p in shown(r)" :key="p" class="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{{ permName(p) }}</span>
          <span v-if="r.permissions.length > shown(r).length" class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{ $t('roles.permCount', { n: fmt.money(r.permissions.length) }) }}</span>
        </div>

        <div v-if="canEdit && !r.permissions.includes('*')" class="mt-auto flex justify-end gap-2 pt-1">
          <AppButton variant="secondary" @click="edit(r)">{{ $t('common.edit') }}</AppButton>
          <AppButton v-if="!r.builtIn" variant="danger" :disabled="r.userCount > 0" :title="r.userCount > 0 ? $t('roles.inUse') : undefined" @click="askDelete(r)">{{ $t('common.delete') }}</AppButton>
        </div>
      </section>
    </div>

    <RoleFormModal v-model:open="formOpen" :role="formRole" :catalog="catalog" @saved="load" />
    <ConfirmDialog
        v-model:open="deleteOpen"
        :title="$t('roles.deleteTitle', { name: deleting?.name ?? '' })"
        :message="$t('roles.deleteMessage')"
        :confirm-label="$t('common.delete')"
        :loading="deleteBusy"
        @confirm="doDelete"
    />
  </div>
</template>