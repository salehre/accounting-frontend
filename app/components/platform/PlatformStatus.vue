<script setup lang="ts">
defineProps<{ kind: 'active' | 'grace' | 'expired' | 'suspended' }>()
</script>

<template>
  <span
      class="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
      :class="{
      'bg-emerald-50 text-emerald-700': kind === 'active',
      'bg-amber-50 text-amber-800': kind === 'grace',
      'bg-red-50 text-red-700': kind === 'expired' || kind === 'suspended',
    }"
  >{{ $t(`platform.state.${kind}`) }}</span>
</template>