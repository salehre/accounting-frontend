<script setup lang="ts">
/**
 * A date field that opens a calendar dialog (vue3-persian-datetime-picker).
 * v-model is always an ISO (Gregorian) date "YYYY-MM-DD", or "" when empty: that is what the backend stores.
 * In Persian the dialog is the Jalali calendar and the field shows the Jalali date; in English and Arabic it is Gregorian.
 *   <DateInput v-model="date" :label="..." :error="..." :hint="..." />
 * min / max (ISO) are optional.
 */
import { defineAsyncComponent } from 'vue'

const model = defineModel<string>({ default: '' })
const props = defineProps<{ label: string; error?: string | null; disabled?: boolean; hint?: string; min?: string; max?: string; placeholder?: string }>()

const { locale, t } = useI18n()
const jalali = computed(() => locale.value === 'fa')
const id = useId()

// the calendar needs the browser (window): load it only when a date field is on the page
const Picker = defineAsyncComponent(async () => {
  const mod = (await import('vue3-persian-datetime-picker')) as unknown as { default?: { default?: unknown } }
  return (mod.default?.default ?? mod.default ?? mod) as never
})

const pad = (n: number) => String(n).padStart(2, '0')
const shown = computed(() => {
  if (!model.value) return ''
  if (!jalali.value) return model.value
  const j = isoToJalali(model.value)
  return j ? `${j.jy}/${pad(j.jm)}/${pad(j.jd)}` : model.value
})

// Esc closes only the calendar, never the dialog or page that holds the field
const open = ref(false)
function onEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  e.preventDefault()
  open.value = false
}
watch(open, (v) => {
  if (v) window.addEventListener('keydown', onEsc, true)
  else window.removeEventListener('keydown', onEsc, true)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc, true))

const input = ref<HTMLInputElement | null>(null)

// Typing works too (faster than the calendar for an accountant): 1405/09/04 or 2026-11-25, Persian digits included.
// Enter or leaving the field accepts it; Arrow Down opens the calendar for the keyboard (a mouse click opens it by itself).
const text = ref(shown.value)
const typedError = ref(false)
watch(shown, (v) => { text.value = v; typedError.value = false })

function commit() {
  const t = normalizeDigits(text.value.trim())
  if (t === '') { model.value = ''; typedError.value = false; return }
  const m = /^(\d{3,4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t)
  let iso: string | null = null
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (jalali.value) iso = jalaliToIso(y, mo, d)
    else {
      const dt = new Date(Date.UTC(y, mo - 1, d))
      iso = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null
    }
  }
  if (iso === null || (props.min && iso < props.min) || (props.max && iso > props.max)) { typedError.value = true; return }
  typedError.value = false
  model.value = iso
  text.value = shown.value
}
const openFromKey = () => input.value?.click()

const box = 'block w-full rounded-lg border bg-white py-2.5 ps-10 pe-9 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-sm font-medium text-slate-700">{{ label }}</label>

    <div class="relative">
      <span class="pointer-events-none absolute inset-y-0 inset-s-3 flex items-center text-slate-400"><AppIcon name="calendar" /></span>
      <input :id="id" ref="input" v-model="text" type="text" inputmode="numeric" autocomplete="off" dir="ltr" :disabled="disabled"
             :placeholder="placeholder ?? t('date.pick')" :aria-describedby="`${id}-msg`" :aria-invalid="error || typedError ? 'true' : undefined" aria-haspopup="dialog"
             :class="[box, 'text-start', error || typedError ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-indigo-500']"
             @change="commit" @blur="commit" @keydown.enter.prevent="commit" @keydown.down.prevent="openFromKey">
      <button v-if="model && !disabled" type="button" class="absolute inset-y-0 inset-e-1.5 my-auto flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              :aria-label="t('date.clear')" :title="t('date.clear')" @click="model = ''">
        <AppIcon name="x" />
      </button>

      <Picker v-if="!disabled" :model-value="model" type="date" :locale="jalali ? 'fa' : 'en'" auto-submit :show-now-btn="true" color="#4f46e5"
              format="YYYY-MM-DD" :display-format="jalali ? 'jYYYY/jMM/jDD' : 'YYYY-MM-DD'" :min="min" :max="max"
              :custom-input="`#${id}`" append-to="body" :show="open" @open="open = true" @close="open = false" @update:model-value="model = ($event as string) || ''" />
    </div>

    <p :id="`${id}-msg`" class="mt-1 text-xs" :class="error || typedError ? 'text-red-600' : 'text-slate-500'">
      <template v-if="error">{{ error }}</template>
      <template v-else-if="typedError">{{ t('date.invalid') }}</template>
      <template v-else-if="hint && !model">{{ hint }}</template>
    </p>
  </div>
</template>