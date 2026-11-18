<script setup lang="ts">
import type { JournalEntry } from '~/types/api'

const { t } = useI18n()
const route = useRoute()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
const flash = useState<{ kind: 'error' | 'warning'; text: string } | null>('flash', () => null)

const id = computed(() => Number(route.params.id))
const entry = ref<JournalEntry | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const notice = ref<{ kind: 'error' | 'warning'; text: string } | null>(null)
useHead({ title: computed(() => (entry.value?.number ? t('entries.detailTitle', { n: fmt.money(entry.value.number) }) : t('entries.draftTitle'))) })

const isYearEnd = computed(() => !!entry.value?.sourceType?.startsWith('year_end_'))
const readOnly = computed(() => session.readOnly)
const canWrite = computed(() => session.can('entries.write') && !readOnly.value && !isYearEnd.value)
const canPost = computed(() => session.can('entries.post') && !readOnly.value && !isYearEnd.value)
const canReverse = computed(() => session.can('entries.reverse') && !readOnly.value && !isYearEnd.value)

async function load() {
  loadError.value = null
  loading.value = true
  try {
    const e = await api.get<JournalEntry>(`/entries/${id.value}`)
    entry.value = {
      ...e,
      id: Number(e.id),
      totalDebit: Number(e.totalDebit),
      totalCredit: Number(e.totalCredit),
      lines: e.lines.map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit) })),
    }
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  notice.value = flash.value
  flash.value = null
  load()
})
watch(id, load)

// ---- post
const postOpen = ref(false)
const busy = ref(false)
async function doPost() {
  busy.value = true
  actionError.value = null
  try {
    await api.post(`/entries/${id.value}/post`)
    postOpen.value = false
    notice.value = null
    await load()
  } catch (e) {
    postOpen.value = false
    actionError.value = errorText.of(e)
  } finally {
    busy.value = false
  }
}

// ---- delete (drafts only)
const deleteOpen = ref(false)
async function doDelete() {
  busy.value = true
  actionError.value = null
  try {
    await api.del(`/entries/${id.value}`)
    await navigateTo('/entries')
  } catch (e) {
    deleteOpen.value = false
    actionError.value = errorText.of(e)
  } finally {
    busy.value = false
  }
}

const reverseOpen = ref(false)
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <NuxtLink to="/entries" class="text-sm text-indigo-700 hover:underline">{{ $t('entries.backToList') }}</NuxtLink>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <p v-else-if="loading && !entry" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-if="entry">
      <AppAlert v-if="notice" :kind="notice.kind">{{ notice.text }}</AppAlert>
      <AppAlert v-if="actionError">{{ actionError }}</AppAlert>
      <AppAlert v-if="isYearEnd" kind="info">{{ $t('entries.yearEndNote') }}</AppAlert>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="flex items-center gap-3 text-2xl font-bold text-slate-900">
            {{ entry.number ? $t('entries.detailTitle', { n: fmt.money(entry.number) }) : $t('entries.draftTitle') }}
            <StatusBadge :status="entry.status" />
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            {{ $t('entries.date') }}: <span dir="ltr">{{ fmt.date(entry.entryDate) }}</span>
            <template v-if="entry.reversesEntryId"> · <NuxtLink :to="`/entries/${entry.reversesEntryId}`" class="text-indigo-700 hover:underline">{{ $t('entries.reversalOf') }}</NuxtLink></template>
          </p>
          <p v-if="entry.description" class="mt-2 text-sm text-slate-800">{{ entry.description }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <template v-if="entry.status === 'draft'">
            <AppButton v-if="canPost" :disabled="!entry.isBalanced" @click="postOpen = true">{{ $t('entries.post') }}</AppButton>
            <NuxtLink v-if="canWrite" :to="`/entries/new?from=${entry.id}&replace=1`"><AppButton variant="secondary"><AppIcon name="edit" />{{ $t('entries.editDraft') }}</AppButton></NuxtLink>
            <AppButton v-if="canWrite" variant="danger" @click="deleteOpen = true"><AppIcon name="trash" />{{ $t('common.delete') }}</AppButton>
          </template>
          <template v-else>
            <AppButton v-if="canReverse" variant="secondary" @click="reverseOpen = true">{{ $t('entries.reverse') }}</AppButton>
          </template>
          <NuxtLink v-if="canWrite" :to="`/entries/new?from=${entry.id}`"><AppButton variant="secondary">{{ $t('entries.copy') }}</AppButton></NuxtLink>
        </div>
      </div>

      <AppAlert v-if="entry.status === 'draft' && !entry.isBalanced" kind="warning">{{ $t('entries.unbalancedDraft') }}</AppAlert>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="w-full min-w-180 text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-4 py-3 text-start font-medium">#</th>
            <th class="px-4 py-3 text-start font-medium">{{ $t('entries.form.account') }}</th>
            <th class="px-4 py-3 text-start font-medium">{{ $t('entries.form.detail') }}</th>
            <th class="px-4 py-3 text-start font-medium">{{ $t('entries.form.lineDescription') }}</th>
            <th class="px-4 py-3 text-end font-medium">{{ $t('entries.form.debit') }}</th>
            <th class="px-4 py-3 text-end font-medium">{{ $t('entries.form.credit') }}</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
          <tr v-for="l in entry.lines" :key="l.id">
            <td class="px-4 py-2.5 text-slate-500">{{ fmt.money(l.lineNo) }}</td>
            <td class="px-4 py-2.5"><span class="font-mono text-xs text-slate-500" dir="ltr">{{ l.accountCode }}</span> {{ l.accountName }}</td>
            <td class="px-4 py-2.5">{{ l.detailName || '—' }}</td>
            <td class="px-4 py-2.5 text-slate-600">{{ l.description || '—' }}</td>
            <td class="px-4 py-2.5 text-end tabular-nums" dir="ltr">{{ l.debit ? fmt.money(l.debit) : '' }}</td>
            <td class="px-4 py-2.5 text-end tabular-nums" dir="ltr">{{ l.credit ? fmt.money(l.credit) : '' }}</td>
          </tr>
          </tbody>
          <tfoot class="bg-slate-50 font-semibold">
          <tr>
            <td colspan="4" class="px-4 py-3 text-end">{{ $t('entries.total') }} ({{ $t('common.rial') }})</td>
            <td class="px-4 py-3 text-end tabular-nums" dir="ltr">{{ fmt.money(entry.totalDebit) }}</td>
            <td class="px-4 py-3 text-end tabular-nums" dir="ltr">{{ fmt.money(entry.totalCredit) }}</td>
          </tr>
          </tfoot>
        </table>
      </div>

      <ConfirmDialog v-model:open="postOpen" :title="$t('entries.postTitle')" :message="$t('entries.postMessage')"
                     :confirm-label="$t('entries.post')" :loading="busy" @confirm="doPost" />
      <ConfirmDialog v-model:open="deleteOpen" :title="$t('entries.deleteTitle')" :message="$t('entries.deleteMessage')"
                     :confirm-label="$t('common.delete')" :loading="busy" @confirm="doDelete" />
      <ReverseModal v-model:open="reverseOpen" :entry="entry" />
    </template>
  </div>
</template>