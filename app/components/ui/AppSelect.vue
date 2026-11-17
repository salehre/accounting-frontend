<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{
  label: string
  options: Array<{ value: string; label: string }>
  error?: string | null
  disabled?: boolean
  hint?: string
}>()
const id = useId()
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-sm font-medium text-slate-700">{{ label }}</label>
    <select
      :id="id"
      v-model="model"
      :disabled="disabled"
      class="block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 disabled:bg-slate-100 disabled:text-slate-500"
      :class="error ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500'"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <p v-if="hint && !error" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
