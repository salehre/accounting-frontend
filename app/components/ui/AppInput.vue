<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{
  label: string
  type?: string
  error?: string | null
  autocomplete?: string
  ltr?: boolean      // codes, user names, e-mail, passwords: always typed left to right
  autofocus?: boolean
  hint?: string
}>()
const id = useId()
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-sm font-medium text-slate-700">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
      :dir="ltr ? 'ltr' : undefined"
      :aria-invalid="error ? 'true' : undefined"
      class="block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition
             focus:ring-2 focus:ring-indigo-500/40"
      :class="error ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-indigo-500'"
    >
    <p v-if="hint && !error" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
