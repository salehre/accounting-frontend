<script setup lang="ts">
import type { YearEndEntry } from '~/types/api'

defineProps<{ entry: YearEndEntry; index: number }>()
const fmt = useFormat()
const open = ref(false)
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white">
    <header class="flex flex-wrap items-start justify-between gap-3 p-4">
      <div class="flex min-w-0 gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{{ fmt.money(index) }}</span>
        <div class="min-w-0">
          <h3 class="font-semibold text-slate-900">{{ $t(`yearEnd.types.${entry.type}.title`) }}</h3>
          <p class="mt-0.5 text-xs text-slate-500">{{ $t(`yearEnd.types.${entry.type}.hint`) }}</p>
          <p class="mt-1 text-xs text-slate-500">
            {{ $t('yearEnd.date') }}: <span dir="ltr">{{ fmt.date(entry.entryDate) }}</span>
            · {{ $t('yearEnd.lines', { n: fmt.money(entry.lines.length) }) }}
          </p>
        </div>
      </div>
      <div class="text-end">
        <div class="text-xs text-slate-500">{{ $t('yearEnd.totals') }}</div>
        <div class="font-semibold tabular-nums text-slate-900" dir="ltr">{{ fmt.money(entry.totalDebit) }}</div>
        <button type="button" class="mt-1 text-xs text-indigo-600 hover:underline" @click="open = !open">
          {{ open ? $t('yearEnd.hideLines') : $t('yearEnd.showLines') }}
        </button>
      </div>
    </header>
    <div v-if="open" class="overflow-x-auto border-t border-slate-100">
      <table class="w-full min-w-140 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-2 text-start font-medium">{{ $t('yearEnd.account') }}</th>
          <th class="px-4 py-2 text-start font-medium">{{ $t('yearEnd.detail') }}</th>
          <th class="px-4 py-2 text-end font-medium">{{ $t('yearEnd.debit') }}</th>
          <th class="px-4 py-2 text-end font-medium">{{ $t('yearEnd.credit') }}</th>
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-for="(l, i) in entry.lines" :key="i">
          <td class="px-4 py-2"><span class="text-slate-500" dir="ltr">{{ l.accountCode }}</span> {{ l.accountName }}</td>
          <td class="px-4 py-2 text-slate-600">{{ l.detailName ?? '—' }}</td>
          <td class="px-4 py-2 text-end tabular-nums" dir="ltr">{{ l.debit ? fmt.money(l.debit) : '' }}</td>
          <td class="px-4 py-2 text-end tabular-nums" dir="ltr">{{ l.credit ? fmt.money(l.credit) : '' }}</td>
        </tr>
        </tbody>
        <tfoot class="bg-slate-50 font-semibold">
        <tr>
          <td class="px-4 py-2" colspan="2">{{ $t('yearEnd.totals') }}</td>
          <td class="px-4 py-2 text-end tabular-nums" dir="ltr">{{ fmt.money(entry.totalDebit) }}</td>
          <td class="px-4 py-2 text-end tabular-nums" dir="ltr">{{ fmt.money(entry.totalCredit) }}</td>
        </tr>
        </tfoot>
      </table>
    </div>
  </section>
</template>