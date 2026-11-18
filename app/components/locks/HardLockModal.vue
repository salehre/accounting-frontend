<script setup lang="ts">
import type { HardLockPreview, PeriodLockStatus } from '~/types/api'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ current: string | null }>()
const emit = defineEmits<{ applied: [status: PeriodLockStatus] }>()

const { t, te } = useI18n()
const api = useApi()
const errorText = useErrorText()
const fmt = useFormat()

const step = ref<'pick' | 'confirm'>('pick')
const date = ref('')
const preview = ref<HardLockPreview | null>(null)
const previewing = ref(false)
const applying = ref(false)
const error = ref<string | null>(null)
const dateError = ref<string | null>(null)

const reason = ref('')
const password = ref('')
const phrase = ref('')
const acknowledge = ref(false)
const errs = ref<Record<string, string>>({})

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

watch(open, (v) => {
  if (!v) return
  step.value = 'pick'
  date.value = ''
  preview.value = null
  error.value = null
  dateError.value = null
  resetConfirm()
})
function resetConfirm() {
  reason.value = ''
  password.value = ''
  phrase.value = ''
  acknowledge.value = false
  errs.value = {}
}

async function runPreview() {
  error.value = null
  dateError.value = null
  if (!date.value) { dateError.value = t('locks.hard.dateRequired'); return }
  if (date.value > todayIso()) { dateError.value = t('locks.notFuture'); return }
  previewing.value = true
  try {
    preview.value = await api.get<HardLockPreview>('/period-locks/hard/preview', { date: date.value })
    resetConfirm()
    step.value = 'confirm'
  } catch (e) {
    const err = toApiError(e)
    if (err.status === 422 && err.errors.date) dateError.value = errorText.text(err.errors.date[0] ?? '')
    else error.value = errorText.of(e)
  } finally {
    previewing.value = false
  }
}

function blockerText(b: HardLockPreview['blockers'][number]): string {
  if (b.code === 'not_forward') {
    const d = /up to ([\d-]+)\./.exec(b.message)?.[1] ?? ''
    return t('locks.hard.blockers.not_forward', { date: fmt.date(d) })
  }
  if (b.code === 'draft_entries') return t('locks.hard.blockers.draft_entries', { n: fmt.money(b.count ?? 0) })
  return te(`locks.hard.blockers.${b.code}`) ? t(`locks.hard.blockers.${b.code}`) : b.message
}
function warningText(w: HardLockPreview['warnings'][number]): string {
  if (w.code === 'year_end_not_posted') {
    const titles = /entries: (.+)\. After/.exec(w.message)?.[1] ?? ''
    return t('locks.hard.warnings.year_end_not_posted', { titles })
  }
  if (w.code === 'lock_inside_year') {
    const title = /"(.+?)"/.exec(w.message)?.[1] ?? ''
    const end = /until ([\d-]+)\./.exec(w.message)?.[1] ?? ''
    return t('locks.hard.warnings.lock_inside_year', { title, end: fmt.date(end) })
  }
  return te(`locks.hard.warnings.${w.code}`) ? t(`locks.hard.warnings.${w.code}`) : w.message
}

const canApply = computed(() =>
    !!preview.value?.canLock
    && phrase.value.trim() === preview.value.confirmationPhrase
    && reason.value.trim().length >= 10
    && password.value.length > 0
    && (!preview.value.needsAcknowledgement || acknowledge.value),
)

async function apply() {
  if (!preview.value || !canApply.value) return
  error.value = null
  errs.value = {}
  applying.value = true
  try {
    const status = await api.post<PeriodLockStatus>('/period-locks/hard', {
      date: preview.value.date,
      confirmationToken: preview.value.token,
      reason: reason.value.trim(),
      password: password.value,
      confirmation: phrase.value.trim(),
      acknowledgeWarnings: acknowledge.value,
    })
    open.value = false
    emit('applied', status)
  } catch (e) {
    const err = toApiError(e)
    password.value = ''
    if (err.status === 409 || err.code === 'confirmation_token_invalid') {
      // the books changed or the confirmation expired: look at the situation again
      error.value = err.code === 'ledger_changed' ? t('locks.hard.ledgerChanged') : t('locks.hard.tokenExpired')
      await runPreview()
      if (step.value === 'confirm') error.value = err.code === 'ledger_changed' ? t('locks.hard.ledgerChanged') : t('locks.hard.tokenExpired')
    } else if (err.status === 422 && Object.keys(err.errors).length) {
      for (const [k, msgs] of Object.entries(err.errors)) errs.value[k] = errorText.text(msgs[0] ?? '')
    } else if (err.status === 422) {
      error.value = errorText.of(e)
      await runPreview() // blockers appeared: show them
    } else {
      error.value = errorText.of(e)
    }
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :title="$t('locks.hard.title')">
    <div class="space-y-4">
      <AppAlert v-if="error">{{ error }}</AppAlert>

      <!-- step 1 -->
      <template v-if="step === 'pick'">
        <AppAlert kind="warning">{{ $t('locks.hard.explain') }}</AppAlert>
        <p v-if="current" class="text-sm text-slate-700">
          {{ $t('locks.hard.currently') }}: <b dir="ltr">{{ fmt.date(current) }}</b> — {{ $t('locks.hard.mustBeLater') }}
        </p>
        <DateInput v-model="date" :label="$t('locks.hard.date')" :error="dateError" :hint="$t('locks.hard.dateHint')" />
      </template>

      <!-- step 2 -->
      <template v-else-if="preview">
        <p class="text-sm text-slate-700">{{ $t('locks.hard.lockUpTo') }}: <b dir="ltr">{{ fmt.date(preview.date) }}</b></p>

        <dl class="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.posted') }}</dt><dd class="font-semibold">{{ fmt.money(preview.summary.postedEntries) }}</dd></div>
          <div><dt class="text-xs text-slate-500">{{ $t('locks.hard.lastEntry') }}</dt><dd class="font-semibold" dir="ltr">{{ fmt.date(preview.summary.lastEntryDate) || '—' }}</dd></div>
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.totalDebit') }}</dt><dd class="font-semibold" dir="ltr">{{ fmt.money(preview.summary.totalDebit) }}</dd></div>
          <div><dt class="text-xs text-slate-500">{{ $t('fiscal.totalCredit') }}</dt><dd class="font-semibold" dir="ltr">{{ fmt.money(preview.summary.totalCredit) }}</dd></div>
        </dl>

        <div v-if="preview.blockers.length" class="space-y-2">
          <h3 class="text-sm font-semibold text-red-700">{{ $t('fiscal.blockersTitle') }}</h3>
          <AppAlert v-for="b in preview.blockers" :key="b.code">
            {{ blockerText(b) }}
            <ul v-if="b.entries?.length" class="mt-2 list-disc space-y-0.5 ps-5 text-xs">
              <li v-for="e in b.entries" :key="e.id">
                <NuxtLink :to="`/entries/${e.id}`" class="underline" target="_blank"><span dir="ltr">{{ fmt.date(e.entryDate) }}</span></NuxtLink>
                — {{ e.description || $t('fiscal.noDescription') }}
              </li>
            </ul>
          </AppAlert>
        </div>

        <div v-if="preview.warnings.length" class="space-y-2">
          <h3 class="text-sm font-semibold text-amber-700">{{ $t('fiscal.warningsTitle') }}</h3>
          <AppAlert v-for="w in preview.warnings" :key="w.code" :kind="w.severity === 'important' ? 'warning' : 'info'">{{ warningText(w) }}</AppAlert>
        </div>

        <form v-if="preview.canLock" class="space-y-4 border-t border-slate-200 pt-4" novalidate @submit.prevent="apply">
          <AppAlert>{{ $t('locks.hard.irreversible') }}</AppAlert>

          <label v-if="preview.needsAcknowledgement" class="flex items-start gap-2 text-sm text-slate-800">
            <input v-model="acknowledge" type="checkbox" class="mt-0.5 size-4 rounded border-slate-300">
            <span>{{ $t('locks.hard.acknowledge') }}</span>
          </label>
          <p v-if="errs.acknowledgeWarnings" class="-mt-2 text-xs text-red-600">{{ errs.acknowledgeWarnings }}</p>

          <AppInput v-model="reason" :label="$t('locks.reason')" :error="errs.reason" :hint="$t('locks.reasonHint')" />
          <AppInput v-model="password" type="password" ltr autocomplete="current-password" :label="$t('locks.hard.password')" :error="errs.password" />
          <div>
            <AppInput v-model="phrase" ltr autocomplete="off" :label="$t('locks.hard.typePhrase')" :error="errs.confirmation" />
            <p class="mt-1 text-xs text-slate-500">{{ $t('locks.hard.phraseNote') }} <code dir="ltr" class="rounded bg-slate-100 px-1.5 py-0.5">{{ preview.confirmationPhrase }}</code></p>
          </div>
        </form>
      </template>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton v-if="step === 'confirm'" variant="secondary" :disabled="applying" @click="step = 'pick'">{{ $t('common.back') }}</AppButton>
      <AppButton v-if="step === 'pick'" :loading="previewing" @click="runPreview">{{ $t('locks.hard.previewBtn') }}</AppButton>
      <AppButton v-else-if="preview?.canLock" variant="danger" :loading="applying" :disabled="!canApply" @click="apply">{{ $t('locks.hard.applyBtn') }}</AppButton>
    </template>
  </AppModal>
</template>