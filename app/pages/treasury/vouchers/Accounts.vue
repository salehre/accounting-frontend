<script setup lang="ts">
import type { MoneyAccount } from '~/types/treasury'

/**
 * Which accounts hold money (cash boxes, banks). When this list is not empty, receipts and payments
 * can put their money lines only on these accounts. An empty list = no restriction.
 */
const { t } = useI18n()
const api = useApi()
const notify = useNotify()
const session = useSessionStore()
const errorText = useErrorText()
const lookups = useTreasuryLookups()
useHead({ title: computed(() => t('treasury.vouchers.money.title')) })

const canManage = computed(() => session.can('treasury.manage') && !session.readOnly)
const loading = ref(true)
const loadError = ref<string | null>(null)
const items = ref<MoneyAccount[]>([])
const adding = ref<number | string | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)

onMounted(async () => {
  try {
    const [res] = await Promise.all([api.get<{ items: MoneyAccount[] }>('/treasury-vouchers/money-accounts'), lookups.load()])
    items.value = res.items
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
})

// accounts that are not in the list yet
const options = computed(() => lookups.accountOptions.value.filter((o) => !items.value.some((i) => i.accountId === o.value)))

watch(adding, (id) => {
  if (id === null) return
  const a = lookups.accountById(id)
  if (a) items.value = [...items.value, { accountId: a.id, code: a.code, name: a.name }].sort((x, y) => x.code.localeCompare(y.code))
  nextTick(() => { adding.value = null })
})
const remove = (id: number) => { items.value = items.value.filter((i) => i.accountId !== id) }

async function save() {
  formError.value = null
  saving.value = true
  try {
    const res = await api.put<{ items: MoneyAccount[] }>('/treasury-vouchers/money-accounts', { accountIds: items.value.map((i) => i.accountId) })
    items.value = res.items
    notify.success(t('treasury.vouchers.money.saved'))
  } catch (e) {
    formError.value = errorText.of(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
    <div>
      <NuxtLink to="/treasury/vouchers" class="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"><AppIcon name="chevron" class="ltr:rotate-180" />{{ $t('treasury.vouchers.title') }}</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ $t('treasury.vouchers.money.title') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('treasury.vouchers.money.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }}</AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-else-if="!loadError">
      <AppAlert v-if="formError">{{ formError }}</AppAlert>

      <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div v-if="canManage">
          <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ $t('treasury.vouchers.money.add') }}</label>
          <ComboBox v-model="adding" :options="options" :aria-label="$t('treasury.vouchers.money.add')" :placeholder="$t('entries.form.searchAccount')" />
        </div>

        <p v-if="items.length === 0" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ $t('treasury.vouchers.money.empty') }}</p>
        <ul v-else class="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <li v-for="a in items" :key="a.accountId" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span><span class="text-slate-500" dir="ltr">{{ a.code }}</span> {{ a.name }}</span>
            <AppButton v-if="canManage" variant="secondary" @click="remove(a.accountId)">{{ $t('common.delete') }}</AppButton>
          </li>
        </ul>

        <div v-if="canManage" class="flex justify-end">
          <AppButton :loading="saving" @click="save">{{ $t('common.save') }}</AppButton>
        </div>
      </section>
    </template>
  </div>
</template>