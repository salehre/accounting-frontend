<script setup lang="ts">
import type { BankStatementRow } from '~/types/bank'

const { t } = useI18n()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('menu.bank')) })

const rows = ref<BankStatementRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const canManage = computed(() => session.can('bank.manage') && !session.readOnly)

async function load() {
  loading.value = true
  error.value = null
  try {
    rows.value = await api.get<BankStatementRow[]>('/bank-statements')
  } catch (e) {
    error.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.bank') }}</h1>
        <p class="mt-1 text-sm text-slate-600">{{ $t('bank.subtitle') }}</p>
      </div>
      <NuxtLink v-if="canManage" to="/bank/new"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
        <AppIcon name="plus" />{{ $t('bank.new') }}
      </NuxtLink>
    </div>

    <AppAlert v-if="error">{{ error }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>

    <p v-else-if="loading" class="text-sm text-slate-500">{{ $t('common.loading') }}</p>

    <div v-else-if="!rows.length" class="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p class="font-medium text-slate-700">{{ $t('bank.empty') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ $t('bank.emptyHint') }}</p>
    </div>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-180 text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
        <tr>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('bank.cols.title') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('bank.cols.account') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('bank.cols.period') }}</th>
          <th class="px-4 py-2.5 text-end font-medium">{{ $t('bank.cols.openLines') }}</th>
          <th class="px-4 py-2.5 text-start font-medium">{{ $t('bank.cols.status') }}</th>
        </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <tr v-for="r in rows" :key="r.id" class="hover:bg-slate-50">
          <td class="px-4 py-2.5">
            <NuxtLink :to="`/bank/${r.id}`" class="font-medium text-indigo-700 hover:underline">{{ r.title }}</NuxtLink>
          </td>
          <td class="px-4 py-2.5">
            <span class="text-slate-500" dir="ltr">{{ r.accountCode }}</span> {{ r.accountName }}
            <span v-if="r.detailName" class="text-slate-500"> · {{ r.detailName }}</span>
          </td>
          <td class="px-4 py-2.5 text-slate-600"><span dir="ltr">{{ fmt.date(r.dateFrom) }} – {{ fmt.date(r.dateTo) }}</span></td>
          <td class="px-4 py-2.5 text-end tabular-nums">{{ fmt.money(r.openLineCount) }} / {{ fmt.money(r.lineCount) }}</td>
          <td class="px-4 py-2.5">
              <span class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="r.status === 'reconciled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">{{ $t(`bank.status.${r.status}`) }}</span>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>