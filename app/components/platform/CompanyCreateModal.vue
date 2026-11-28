<script setup lang="ts">
import type { PlatformCreated, PlatformPlan } from '~/types/platform'
import SecretBox from "~/components/platform/SecretBox.vue";
import {usePlatformApi} from "~/composables/usePlatformApi.ts";
import {usePlatformError} from "~/composables/usePlatformError.ts";

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ plans: PlatformPlan[] }>()
const emit = defineEmits<{ created: [code: string] }>()

const { t } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
const notify = useNotify()

const code = ref('')
const name = ref('')
const endsAt = ref('')
const plan = ref('')
const withAdmin = ref(true)
const adminUsername = ref('admin')
const adminFullName = ref('')
const adminPassword = ref('')

const saving = ref(false)
const error = ref<unknown>(null)
const fe = useFieldErrors()
const result = ref<PlatformCreated | null>(null)

const planOptions = computed(() => [
  { value: '', label: t('platform.noPlan') },
  ...props.plans.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
])

watch(open, (v) => {
  if (!v) return
  code.value = ''; name.value = ''; endsAt.value = ''; plan.value = ''
  withAdmin.value = true; adminUsername.value = 'admin'; adminFullName.value = ''; adminPassword.value = ''
  error.value = null; result.value = null; fe.clear()
})

watch(code, () => fe.drop('code'))
watch(name, () => fe.drop('name'))
watch(adminUsername, () => fe.drop('admin.username'))
watch(adminFullName, () => fe.drop('admin.fullName'))
watch(adminPassword, () => fe.drop('admin.password'))
watch(withAdmin, () => { fe.drop('admin.username'); fe.drop('admin.fullName'); fe.drop('admin.password') })

const f = (field: string) => fe.errs.value[field] ?? (error.value ? perr.field(error.value, field) : null)
const topError = computed(() => {
  if (!error.value) return null
  const e = toApiError(error.value)
  // a message that belongs to a field is shown under the field, the rest here
  return Object.keys(e.errors).length > 0 ? null : perr.of(error.value)
})

// the same rules as the server: nothing is sent until every one of them is met
const COMPANY_CODE = /^[a-z0-9][a-z0-9-]{1,29}$/
function check(): boolean {
  fe.clear()
  const c = code.value.trim().toLowerCase()
  if (c === '') fe.fail('code', t('platform.check.codeRequired'))
  else if (!COMPANY_CODE.test(c)) fe.fail('code', t('platform.check.companyCode'))
  const nm = name.value.trim()
  if (nm === '') fe.fail('name', t('platform.check.nameRequired'))
  else if (nm.length > 255) fe.fail('name', t('platform.check.nameLong', { n: 255 }))
  if (withAdmin.value) {
    const u = adminUsername.value.trim()
    if (u === '') fe.fail('admin.username', t('platform.check.usernameRequired'))
    else if (u.length > 60) fe.fail('admin.username', t('platform.check.usernameLong', { n: 60 }))
    if (adminFullName.value.trim() === '') fe.fail('admin.fullName', t('platform.check.fullNameRequired'))
    if (adminPassword.value !== '') {
      if (adminPassword.value.length < 10) fe.fail('admin.password', t('platform.check.passwordShort', { n: 10 }))
      else if (byteLength(adminPassword.value) > 72) fe.fail('admin.password', t('platform.check.passwordLong'))
    }
  }
  return fe.ok()
}

async function submit() {
  error.value = null
  if (!check()) return
  saving.value = true
  try {
    const body: Record<string, unknown> = { code: code.value.trim().toLowerCase(), name: name.value.trim() }
    if (endsAt.value) body.endsAt = endsAt.value
    if (plan.value) body.plan = plan.value
    if (withAdmin.value) {
      body.admin = {
        username: adminUsername.value.trim(),
        fullName: adminFullName.value.trim(),
        ...(adminPassword.value ? { password: adminPassword.value } : {}),
      }
    }
    result.value = await api.post<PlatformCreated>('/platform/companies', body)
    notify.success(t('platform.toast.created', { name: result.value.company.name }))
  } catch (e) {
    error.value = e
  } finally {
    saving.value = false
  }
}

function finish() {
  const created = result.value?.company.code
  open.value = false
  if (created) emit('created', created)
}
</script>

<template>
  <AppModal v-model:open="open" :title="result ? $t('platform.create.doneTitle') : $t('platform.create.title')" size="lg">
    <!-- the result: the first password is shown here once -->
    <div v-if="result" class="space-y-4">
      <AppAlert kind="success">{{ $t('platform.create.done', { name: result.company.name, code: result.company.code }) }}</AppAlert>

      <div v-if="result.admin">
        <p class="mb-1 text-sm font-medium text-slate-700">{{ $t('platform.create.adminUser') }}</p>
        <SecretBox :value="result.admin.username" />
      </div>
      <div v-if="result.admin?.password">
        <p class="mb-1 text-sm font-medium text-slate-700">{{ $t('platform.create.adminPassword') }}</p>
        <SecretBox :value="result.admin.password" />
        <AppAlert kind="warning" class="mt-3">{{ $t('platform.create.once') }}</AppAlert>
      </div>
      <p v-else-if="result.admin" class="text-sm text-slate-600">{{ $t('platform.create.passwordYours') }}</p>
      <p v-else class="text-sm text-slate-600">{{ $t('platform.create.noAdmin', { code: result.company.code }) }}</p>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <AppAlert v-if="topError">{{ topError }}</AppAlert>

      <div class="grid gap-4 sm:grid-cols-2">
        <AppInput v-model="code" :label="$t('platform.create.code')" :hint="$t('platform.create.codeHint')" :error="f('code')" ltr autofocus />
        <AppInput v-model="name" :label="$t('platform.create.name')" :error="f('name')" />
        <AppSelect v-model="plan" :label="$t('platform.create.plan')" :options="planOptions" :error="f('plan')" />
        <DateInput v-model="endsAt" :label="$t('platform.create.endsAt')" :hint="$t('platform.create.endsAtHint')" :error="f('endsAt')" />
      </div>

      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="withAdmin" type="checkbox" class="size-4 rounded border-slate-300 text-indigo-600">
        {{ $t('platform.create.withAdmin') }}
      </label>

      <div v-if="withAdmin" class="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <AppInput v-model="adminUsername" :label="$t('platform.create.adminUsername')" :error="f('admin.username')" ltr />
        <AppInput v-model="adminFullName" :label="$t('platform.create.adminFullName')" :error="f('admin.fullName')" />
        <div class="sm:col-span-2">
          <AppInput v-model="adminPassword" :label="$t('platform.create.adminPasswordOptional')" :hint="$t('platform.create.adminPasswordHint')" :error="f('admin.password')" type="password" ltr autocomplete="new-password" />
        </div>
      </div>
    </form>

    <template #footer>
      <template v-if="result"><AppButton @click="finish">{{ $t('platform.create.open') }}</AppButton></template>
      <template v-else>
        <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton :loading="saving" @click="submit">{{ $t('platform.create.submit') }}</AppButton>
      </template>
    </template>
  </AppModal>
</template>