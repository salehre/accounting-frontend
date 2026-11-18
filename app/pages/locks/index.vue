<script setup lang="ts">
import type { PeriodLockStatus } from '~/types/api'

const { t } = useI18n()
const api = useApi()
const session = useSessionStore()
const errorText = useErrorText()
const fmt = useFormat()
useHead({ title: computed(() => t('menu.locks')) })

const status = ref<PeriodLockStatus | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)

const canSoft = computed(() => session.can('fiscal-years.close') && !session.readOnly)
const canHard = computed(() => session.can('fiscal-years.hard-lock') && !session.readOnly)

async function load() {
  loadError.value = null
  try {
    status.value = await api.get<PeriodLockStatus>('/period-locks')
  } catch (e) {
    loadError.value = errorText.of(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const softOpen = ref(false)
const hardOpen = ref(false)
function onSaved(s: PeriodLockStatus) { status.value = s; notice.value = t('locks.saved') }
function onApplied(s: PeriodLockStatus) { status.value = s; notice.value = t('locks.hardApplied') }

function time(createdAt: string): string {
  const m = /[T ](\d{2}:\d{2})/.exec(createdAt)
  return m ? m[1]! : ''
}
function change(kind: 'soft' | 'hard', oldDate: string | null, newDate: string | null): string {
  if (kind === 'soft' && newDate === null) return t('locks.history.removed', { date: fmt.date(oldDate) })
  return `${oldDate ? fmt.date(oldDate) : '—'}  ←  ${fmt.date(newDate)}`
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">{{ $t('menu.locks') }}</h1>
      <p class="mt-1 text-sm text-slate-600">{{ $t('locks.subtitle') }}</p>
    </div>

    <AppAlert v-if="loadError">{{ loadError }} <button class="underline" @click="load">{{ $t('common.retry') }}</button></AppAlert>
    <AppAlert v-if="notice" kind="info">{{ notice }}</AppAlert>
    <p v-if="loading" class="py-10 text-center text-slate-500">{{ $t('common.loading') }}</p>

    <template v-if="status">
      <div class="grid gap-4 md:grid-cols-2">
        <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div class="flex items-center gap-2"><AppIcon name="unlock" /><h2 class="font-semibold text-slate-900">{{ $t('locks.soft.name') }}</h2></div>
          <p class="text-sm text-slate-600">{{ $t('locks.soft.short') }}</p>
          <p class="text-lg font-bold text-slate-900" dir="ltr">
            <template v-if="status.softLockDate">{{ fmt.date(status.softLockDate) }}</template>
            <span v-else class="text-sm font-normal text-slate-500">{{ $t('locks.none') }}</span>
          </p>
          <AppButton v-if="canSoft" variant="secondary" @click="softOpen = true">{{ $t('locks.soft.change') }}</AppButton>
        </section>

        <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div class="flex items-center gap-2"><AppIcon name="lock" /><h2 class="font-semibold text-slate-900">{{ $t('locks.hard.name') }}</h2></div>
          <p class="text-sm text-slate-600">{{ $t('locks.hard.short') }}</p>
          <p class="text-lg font-bold text-slate-900" dir="ltr">
            <template v-if="status.hardLockDate">{{ fmt.date(status.hardLockDate) }}</template>
            <span v-else class="text-sm font-normal text-slate-500">{{ $t('locks.none') }}</span>
          </p>
          <AppButton v-if="canHard" variant="danger" @click="hardOpen = true">{{ $t('locks.hard.apply') }}</AppButton>
        </section>
      </div>

      <p v-if="status.effectiveLockDate" class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {{ $t('locks.effective', { date: fmt.date(status.effectiveLockDate) }) }}
      </p>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 class="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">{{ $t('locks.history.title') }}</h2>
        <p v-if="status.events.length === 0" class="px-5 py-8 text-center text-sm text-slate-500">{{ $t('locks.history.empty') }}</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-180 text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-4 py-2.5 text-start font-medium">{{ $t('locks.history.when') }}</th>
              <th class="px-4 py-2.5 text-start font-medium">{{ $t('locks.history.kind') }}</th>
              <th class="px-4 py-2.5 text-start font-medium">{{ $t('locks.history.change') }}</th>
              <th class="px-4 py-2.5 text-start font-medium">{{ $t('locks.reason') }}</th>
              <th class="px-4 py-2.5 text-start font-medium">{{ $t('locks.history.by') }}</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="e in status.events" :key="e.id" class="border-t border-slate-100 align-top">
              <td class="whitespace-nowrap px-4 py-3"><span dir="ltr">{{ fmt.date(e.createdAt.slice(0, 10)) }} {{ time(e.createdAt) }}</span></td>
              <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="e.kind === 'hard' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'">
                    {{ e.kind === 'hard' ? $t('locks.hard.name') : $t('locks.soft.name') }}
                  </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3" dir="ltr">
                {{ change(e.kind, e.oldDate, e.newDate) }}
                <span v-if="e.postedEntries !== null" class="block text-xs text-slate-500">{{ $t('locks.history.entries', { n: fmt.money(e.postedEntries) }) }}</span>
              </td>
              <td class="px-4 py-3 text-slate-700">{{ e.reason }}</td>
              <td class="whitespace-nowrap px-4 py-3">{{ e.fullName || e.username }}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <SoftLockModal v-model:open="softOpen" :current="status?.softLockDate ?? null" @saved="onSaved" />
    <HardLockModal v-model:open="hardOpen" :current="status?.hardLockDate ?? null" @applied="onApplied" />
  </div>
</template>