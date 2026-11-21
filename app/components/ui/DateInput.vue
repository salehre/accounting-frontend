<script setup lang="ts">
/**
 * v-model is always an ISO (Gregorian) date "YYYY-MM-DD", or "" while incomplete: that is what the
 * backend stores. In Persian the person types a Jalali date (year / month / day).
 */
const model = defineModel<string>({ default: '' })
defineProps<{ label: string; error?: string | null; disabled?: boolean; hint?: string }>()

const { locale, t } = useI18n()
const jalali = computed(() => locale.value === 'fa')
const id = useId()

const y = ref('')
const m = ref('')
const d = ref('')

function currentIso(): string {
  return jalaliToIso(Number(normalizeDigits(y.value)), Number(m.value), Number(normalizeDigits(d.value))) ?? ''
}
function fromModel() {
  const j = model.value ? isoToJalali(model.value) : null
  y.value = j ? String(j.jy) : ''
  m.value = j ? String(j.jm) : ''
  d.value = j ? String(j.jd) : ''
}
watch(() => model.value, (v) => { if (v !== currentIso()) fromModel() }, { immediate: true })
watch([y, m, d], () => { if (jalali.value) model.value = currentIso() })

const monthOptions = JALALI_MONTHS_FA.map((name, i) => ({ value: String(i + 1), label: name }))
const partial = computed(() => jalali.value && (y.value || m.value || d.value))
const invalid = computed(() => !!(y.value && m.value && d.value) && currentIso() === '')

const box = 'rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 disabled:bg-slate-100 disabled:text-slate-500'
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-sm font-medium text-slate-700">{{ label }}</label>

    <div v-if="jalali" class="flex gap-2" :aria-describedby="`${id}-msg`">
      <input :id="id" v-model="y" inputmode="numeric" dir="ltr" maxlength="4" :disabled="disabled" :placeholder="t('date.year')"
             :class="[box, 'w-24', error || invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500']">
      <div class="min-w-0 flex-1">
        <AppSelect v-model="m" compact :options="monthOptions" :placeholder="t('date.month')" :aria-label="t('date.month')"
                   :disabled="disabled" :invalid="!!(error || invalid)" />
      </div>
      <input v-model="d" inputmode="numeric" dir="ltr" maxlength="2" :disabled="disabled" :placeholder="t('date.day')"
             :class="[box, 'w-20', error || invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500']">
    </div>
    <input v-else :id="id" v-model="model" type="date" dir="ltr" :disabled="disabled"
           :class="[box, 'block w-full', error ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500']">

    <p :id="`${id}-msg`" class="mt-1 text-xs" :class="error || invalid ? 'text-red-600' : 'text-slate-500'">
      <template v-if="error">{{ error }}</template>
      <template v-else-if="invalid">{{ t('date.invalid') }}</template>
      <template v-else-if="hint && !partial">{{ hint }}</template>
    </p>
  </div>
</template>