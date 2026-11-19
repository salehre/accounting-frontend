<script setup lang="ts">
import type { StatementGroup } from '~/types/api'

defineProps<{ title: string; section: StatementGroup; totalLabel: string }>()
const fmt = useFormat()
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <h2 class="bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">{{ title }}</h2>
    <table class="w-full text-sm">
      <tbody>
      <tr v-if="section.rows.length === 0"><td class="px-4 py-6 text-center text-slate-400">{{ $t('reports.empty') }}</td></tr>
      <tr v-for="r in section.rows" :key="r.accountId" class="border-t border-slate-100">
        <td class="w-24 whitespace-nowrap px-4 py-2 text-slate-400" dir="ltr">{{ r.code }}</td>
        <td class="px-2 py-2">{{ r.name }}</td>
        <td class="whitespace-nowrap px-4 py-2 text-end tabular-nums" dir="ltr">{{ r.amount ? fmt.money(r.amount) : '—' }}</td>
      </tr>
      </tbody>
      <tfoot>
      <tr class="border-t-2 border-slate-300 bg-slate-50 font-semibold">
        <td colspan="2" class="px-4 py-2.5">{{ totalLabel }}</td>
        <td class="whitespace-nowrap px-4 py-2.5 text-end tabular-nums" dir="ltr">{{ fmt.money(section.total) }}</td>
      </tr>
      </tfoot>
    </table>
  </section>
</template>