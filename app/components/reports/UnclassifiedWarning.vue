<script setup lang="ts">
import type { StatementWarning } from '~/types/api'

defineProps<{ warnings: StatementWarning[] }>()
const fmt = useFormat()
</script>

<template>
  <AppAlert v-for="w in warnings" :key="w.code" kind="warning">
    <template v-if="w.code === 'unclassified_accounts'">
      <p class="font-medium">{{ $t('reports.unclassified.text') }}</p>
      <ul class="mt-2 list-disc space-y-0.5 ps-5 text-xs">
        <li v-for="a in w.accounts" :key="a.accountId">
          <span dir="ltr">{{ a.code }}</span> {{ a.name }} — <span dir="ltr">{{ fmt.money(a.balance) }}</span>
        </li>
      </ul>
    </template>
    <template v-else>{{ w.message }}</template>
  </AppAlert>
</template>