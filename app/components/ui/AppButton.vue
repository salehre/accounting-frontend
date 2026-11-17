<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary'
  loading?: boolean
  type?: 'button' | 'submit'
}>(), { variant: 'primary', type: 'button' })
</script>

<template>
  <button
    :type="type"
    :disabled="loading"
    class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition
           focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
    :class="variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'"
  >
    <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>
