<script setup lang="ts">
import type { SettingKey, TreasurySettings } from '~/types/treasury'
import { SETTING_KEYS } from '~/types/treasury'
import {useTreasuryLookups} from "~/composables/useTreasuryLookups.ts";

const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
useHead({ title: computed(() => t('treasury.settings.title')) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)
const loading = ref(true)
const loadError = ref<string | null>(null)
const form = reactive<Record<SettingKey, number | string | null>>({ cheques_receivable: null, cheques_in_collection: null, cheques_payable: null })
const labels = reactive<Record<SettingKey, string>>({ cheques_receivable: '', cheques_in_collection: '', cheques_payable: '' })
const fieldErrs = reactive<Record<string, string | null>>({})
const saving = ref(false)
const formError = ref<string | null>(null)

onMounted(async () => {
  try {
    const [settings] = await Promise.all([api.get<TreasurySettings>('/treasury/settings'), lookups.load()])
    for (const k of SETTING_KEYS) {
      const s = settings[k]
      form[k] = s?.accountId ?? null
      labels[k] = s ? `${s.code} ${s.name}` : ''
    }
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
})

const complete = computed(() => SETTING_KEYS.every((k) => form[k] !== null))

async function save() {
  formError.value = null
  for (const k of SETTING_KEYS) fieldErrs[k] = null
  saving.value = true
  try {
    const body: Record<string, number> = {}
    for (const k of SETTING_KEYS) if (form[k] !== null) body[k] = Number(form[k])
    await api.put('/treasury/settings', body)
    notify.success(t('toast.settingsSaved'))
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422) {
      let any = false
      for (const k of SETTING_KEYS) { const m = err.field(k); if (m) { fieldErrs[k] = errorText.text(m); any = true } }
      if (!any) formError.value = errorText.of(e)
    } else formError.value = errorText.of(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <NuxtLink to="/treasury" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.title') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('treasury.settings.title') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.settings.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }}</AppAlert>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <section v-else class="rounded-xl border border-slate-200 bg-white p-5">
      <AppAlert v-if="!complete" class="mb-4">{{ $t('treasury.settings.incomplete') }}</AppAlert>
      <AppAlert v-if="formError" class="mb-4">{{ formError }}</AppAlert>
      <div class="space-y-4">
        <div v-for="k in SETTING_KEYS" :key="k">
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t(`treasury.settings.fields.${k}`) }}</label>
          <ComboBox v-model="form[k]" :options="lookups.accountOptions.value" :initial-label="labels[k]" :disabled="!canManage"
                    :invalid="!!fieldErrs[k]" :aria-label="$t(`treasury.settings.fields.${k}`)" :placeholder="$t('entries.form.searchAccount')" />
          <p class="mt-1 text-xs" :class="fieldErrs[k] ? 'text-red-600' : 'text-slate-500'">{{ fieldErrs[k] ?? $t(`treasury.settings.hints.${k}`) }}</p>
        </div>
      </div>
      <div v-if="canManage" class="mt-5 flex justify-end">
        <AppButton :loading="saving" @click="save">{{ $t('common.save') }}</AppButton>
      </div>
    </section>
  </div>
</template>