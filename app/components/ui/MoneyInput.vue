<script setup lang="ts">
/** Whole rials. v-model is a number (or null when empty). Accepts Persian/Arabic digits and shows thousands separators. */
const model = defineModel<number | null>({ default: null })
defineProps<{ invalid?: boolean; ariaLabel?: string; disabled?: boolean }>()

const text = ref('')
const group = (n: number | null) => (n === null || n === 0 ? '' : n.toLocaleString('en-US'))
watch(model, (v) => { if (Number(text.value.replace(/,/g, '') || 0) !== (v ?? 0)) text.value = group(v) }, { immediate: true })

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const digits = normalizeDigits(el.value).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (digits.length > 15) { el.value = text.value; return } // beyond 9,007,199,254,740,991 the numbers are no longer exact
  const n = digits === '' ? null : Number(digits)
  model.value = n === 0 ? null : n
  text.value = group(n)
  el.value = text.value
}
</script>

<template>
  <input :value="text" type="text" inputmode="numeric" dir="ltr" autocomplete="off" :aria-label="ariaLabel" :disabled="disabled"
         class="block w-full rounded-lg border bg-white px-3 py-2 text-end text-sm tabular-nums outline-none transition focus:ring-2 focus:ring-indigo-500/40"
         :class="invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'" @input="onInput">
</template>