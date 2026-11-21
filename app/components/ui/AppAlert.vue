<script setup lang="ts">
withDefaults(defineProps<{ kind?: 'error' | 'warning' | 'info' | 'success' }>(), { kind: 'error' })
</script>

<template>
  <div
      role="alert"
      class="rounded-lg border px-4 py-3 text-sm"
      :class="{
      'border-red-200 bg-red-50 text-red-800': kind === 'error',
      'border-amber-200 bg-amber-50 text-amber-900': kind === 'warning',
      'border-sky-200 bg-sky-50 text-sky-900': kind === 'info',
      'border-emerald-200 bg-emerald-50 text-emerald-900': kind === 'success',
    }"
  >
    <slot />
  </div>
</template>