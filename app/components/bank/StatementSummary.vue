<script setup lang="ts">
import type { BankSummary } from '~/types/bank'

const props = defineProps<{ summary: BankSummary }>()
const fmt = useFormat()

const balanced = computed(() => props.summary.difference === 0)
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="text-xs text-slate-500">{{ $t('bank.sum.bookBalance') }}</div>
        <div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(summary.bookBalance) }}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="text-xs text-slate-500">{{ $t('bank.sum.bankBalance') }}</div>
        <div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(summary.bankClosingBalance) }}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="text-xs text-slate-500">{{ $t('bank.sum.notInBooks') }}</div>
        <div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(summary.unmatchedStatementTotal) }}</div>
        <div class="mt-0.5 text-xs text-slate-500">{{ $t('bank.sum.linesCount', { n: fmt.money(summary.openLineCount) }) }}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="text-xs text-slate-500">{{ $t('bank.sum.notAtBank') }}</div>
        <div class="mt-1 font-bold tabular-nums" dir="ltr">{{ fmt.money(summary.unmatchedBookTotal) }}</div>
        <div class="mt-0.5 text-xs text-slate-500">{{ $t('bank.sum.linesCount', { n: fmt.money(summary.openBookLineCount) }) }}</div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
         :class="balanced ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'">
      <div class="text-sm" :class="balanced ? 'text-emerald-800' : 'text-amber-900'">
        {{ balanced ? $t('bank.sum.balanced') : $t('bank.sum.notBalanced') }}
        <span class="ms-2 text-xs opacity-80">{{ $t('bank.sum.formula') }}</span>
      </div>
      <div class="text-sm font-bold tabular-nums" :class="balanced ? 'text-emerald-800' : 'text-amber-900'">
        {{ $t('bank.sum.difference') }}: <span dir="ltr">{{ fmt.money(summary.difference) }}</span>
      </div>
    </div>
  </div>
</template>