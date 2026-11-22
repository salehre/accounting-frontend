<script setup lang="ts">
import type { PlatformCompanyDetail } from '~/types/platform'
import {usePlatformApi} from "~/composables/usePlatformApi.ts";
import {usePlatformError} from "~/composables/usePlatformError.ts";

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ company: PlatformCompanyDetail }>()
const emit = defineEmits<{ saved: [company: PlatformCompanyDetail] }>()

const { t } = useI18n()
const api = usePlatformApi()
const perr = usePlatformError()
const notify = useNotify()
const fmt = useFormat()

const mode = ref<'months' | 'date'>('months')
const months = ref('12')
const endsAt = ref('')
const saving = ref(false)
const error = ref<unknown>(null)

const modeOptions = computed(() => [
  { value: 'months', label: t('platform.renew.byMonths') },
  { value: 'date', label: t('platform.renew.byDate') },
])
const monthOptions = computed(() => [1, 2, 3, 6, 12, 24, 36].map((n) => ({ value: String(n), label: t('platform.renew.nMonths', { n }) })))

watch(open, (v) => {
  if (!v) return
  mode.value = 'months'; months.value = '12'; endsAt.value = ''; error.value = null
})

const f = (field: string) => (error.value ? perr.field(error.value, field) : null)

async function submit() {
  saving.value = true
  error.value = null
  try {
    const body = mode.value === 'months' ? { months: Number(months.value) } : { endsAt: endsAt.value }
    const res = await api.post<PlatformCompanyDetail>(`/platform/companies/${props.company.code}/renew`, body)
    notify.success(t('platform.toast.renewed', { date: fmt.date(res.subscription.endsAt) }))
    emit('saved', res)
    open.value = false
  } catch (e) {
    error.value = e
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('platform.renew.title', { name: company.name })">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <AppAlert v-if="error && !f('months') && !f('endsAt')">{{ perr.of(error) }}</AppAlert>

      <p class="text-sm text-slate-600">
        {{ company.subscription.endsAt ? $t('platform.renew.current', { date: fmt.date(company.subscription.endsAt) }) : $t('platform.renew.noEnd') }}
      </p>

      <AppSelect v-model="mode" :label="$t('platform.renew.how')" :options="modeOptions" />
      <AppSelect v-if="mode === 'months'" v-model="months" :label="$t('platform.renew.months')" :hint="$t('platform.renew.monthsHint')" :options="monthOptions" :error="f('months')" />
      <DateInput v-else v-model="endsAt" :label="$t('platform.renew.date')" :hint="$t('platform.renew.dateHint')" :error="f('endsAt')" />
    </form>

    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton :loading="saving" :disabled="mode === 'date' && !endsAt" @click="submit">{{ $t('platform.renew.submit') }}</AppButton>
    </template>
  </AppModal>
</template>