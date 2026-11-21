<script setup lang="ts">
import type { PermissionCatalog, Role } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ role: Role | null; catalog: PermissionCatalog }>()
const emit = defineEmits<{ saved: [] }>()

const { t, te } = useI18n()
const api = useApi()
const notify = useNotify()
const errorText = useErrorText()
const roleLabel = useRoleLabel()

const name = ref('')
const selected = ref<string[]>([])
const saving = ref(false)
const error = ref<string | null>(null)
const errs = ref<Record<string, string | null>>({})

const editing = computed(() => props.role !== null)
const nameLocked = computed(() => props.role?.builtIn === true)

watch(open, (v) => {
  if (!v) return
  error.value = null
  errs.value = {}
  name.value = props.role?.name ?? ''
  selected.value = [...(props.role?.permissions ?? [])]
})

// permissions grouped by area: "accounts.read" belongs to "accounts"
const groups = computed(() => {
  const map = new Map<string, string[]>()
  for (const p of props.catalog.permissions) {
    const g = p.split('.')[0]!
    map.set(g, [...(map.get(g) ?? []), p])
  }
  return [...map.entries()].map(([g, list]) => ({ key: g, list }))
})

const groupLabel = (g: string) => (te(`permGroup.${permKey(g)}`) ? t(`permGroup.${permKey(g)}`) : g)
const permName = (p: string) => (te(`perm.${permKey(p)}.name`) ? t(`perm.${permKey(p)}.name`) : p)
const permHint = (p: string) => (te(`perm.${permKey(p)}.hint`) ? t(`perm.${permKey(p)}.hint`) : '')

/**
 * Ticking a permission ticks the ones it needs ("write" needs "read");
 * unticking one unticks the ones that need it. The server checks the same rule.
 */
function toggle(p: string, on: boolean) {
  const set = new Set(selected.value)
  if (on) {
    set.add(p)
    for (const need of props.catalog.requires[p] ?? []) set.add(need)
  } else {
    set.delete(p)
    for (const [dependent, needs] of Object.entries(props.catalog.requires)) {
      if (needs.includes(p)) set.delete(dependent)
    }
  }
  selected.value = props.catalog.permissions.filter((x) => set.has(x))
}
const needsText = (p: string) => (props.catalog.requires[p] ?? []).map(permName).join('، ')

function toggleGroup(list: string[], on: boolean) {
  for (const p of list) toggle(p, on)
}
const groupAll = (list: string[]) => list.every((p) => selected.value.includes(p))

function validate(): boolean {
  errs.value = {}
  if (!nameLocked.value) {
    name.value = name.value.trim()
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name.value) || name.value.length < 2 || name.value.length > 50) errs.value.name = t('roles.errors.name')
  }
  if (selected.value.length === 0) errs.value.permissions = t('roles.errors.permissionsRequired')
  return !Object.values(errs.value).some(Boolean)
}

async function save() {
  error.value = null
  if (!validate()) return
  saving.value = true
  let message: string | null = null
  try {
    if (!props.role) {
      await api.post('/roles', { name: name.value, permissions: selected.value })
      message = t('toast.roleCreated', { name: name.value })
    } else {
      const body: Record<string, unknown> = {}
      if (!nameLocked.value && name.value !== props.role.name) body.name = name.value
      const same = selected.value.length === props.role.permissions.length && selected.value.every((p) => props.role!.permissions.includes(p))
      if (!same) body.permissions = selected.value
      if (Object.keys(body).length > 0) {
        await api.patch(`/roles/${props.role.id}`, body)
        message = t('toast.roleUpdated', { name: roleLabel(name.value) })
      }
    }
    open.value = false
    emit('saved')
    if (message) notify.success(message)
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && Object.keys(err.errors).length > 0) {
      for (const [field, msgs] of Object.entries(err.errors)) errs.value[field] = errorText.text(msgs[0] ?? '')
    } else {
      error.value = errorText.of(e)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" size="lg" :title="editing ? $t('roles.editTitle') : $t('roles.newTitle')">
    <form id="role-form" class="space-y-5" novalidate @submit.prevent="save">
      <AppAlert v-if="error">{{ error }}</AppAlert>
      <AppInput v-model="name" ltr autocomplete="off" :label="$t('roles.name')" :disabled="nameLocked" :error="errs.name" :hint="nameLocked ? $t('roles.builtInFixed') : $t('roles.nameHint')" />

      <div>
        <h3 class="mb-2 text-sm font-medium text-slate-700">{{ $t('roles.permissions') }}</h3>
        <p v-if="errs.permissions" class="mb-2 text-xs text-red-600">{{ errs.permissions }}</p>
        <div class="space-y-3">
          <fieldset v-for="g in groups" :key="g.key" class="rounded-xl border border-slate-200">
            <div class="flex items-center justify-between bg-slate-50 px-4 py-2">
              <legend class="float-start text-sm font-semibold text-slate-800">{{ groupLabel(g.key) }}</legend>
              <button type="button" class="text-xs font-medium text-indigo-600 hover:underline" @click="toggleGroup(g.list, !groupAll(g.list))">
                {{ groupAll(g.list) ? $t('roles.clearGroup') : $t('roles.selectGroup') }}
              </button>
            </div>
            <ul class="divide-y divide-slate-100">
              <li v-for="p in g.list" :key="p">
                <label class="flex cursor-pointer items-start gap-3 px-4 py-2.5">
                  <input type="checkbox" class="mt-0.5 size-4 rounded border-slate-300" :checked="selected.includes(p)" @change="toggle(p, ($event.target as HTMLInputElement).checked)">
                  <span class="min-w-0">
                    <span class="block text-sm text-slate-900">{{ permName(p) }}</span>
                    <span v-if="permHint(p)" class="block text-xs text-slate-500">{{ permHint(p) }}</span>
                    <span v-if="(catalog.requires[p] ?? []).length" class="block text-xs text-slate-400">{{ $t('roles.needs', { list: needsText(p) }) }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </fieldset>
        </div>
      </div>
    </form>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton type="submit" form="role-form" :loading="saving">{{ $t('common.save') }}</AppButton>
    </template>
  </AppModal>
</template>