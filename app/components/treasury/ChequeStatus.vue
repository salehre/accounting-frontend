<script setup lang="ts">
import type { ChequeStatus } from '~/types/treasury'

defineProps<{ status: ChequeStatus; overdue?: boolean }>()

const COLORS: Record<ChequeStatus, string> = {
  in_hand: 'bg-sky-100 text-sky-800',
  deposited: 'bg-indigo-100 text-indigo-800',
  cleared: 'bg-emerald-100 text-emerald-800',
  bounced: 'bg-rose-100 text-rose-800',
  returned: 'bg-slate-200 text-slate-700',
  endorsed: 'bg-violet-100 text-violet-800',
  issued: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-slate-200 text-slate-600',
}
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="COLORS[status]">{{ $t(`treasury.status.${status}`) }}</span>
    <span v-if="overdue" class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{{ $t('treasury.overdue') }}</span>
  </span>
</template>