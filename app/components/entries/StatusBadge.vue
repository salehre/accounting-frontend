<script setup lang="ts">
defineProps<{ status: 'draft' | 'posted' }>()
</script>

<template>
  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="status === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
    {{ $t(`entries.statuses.${status}`) }}
  </span>
</template>