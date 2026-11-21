<script setup lang="ts">
/**
 * The dropdown of the app. It replaces the browser's <select>, which looks different in every browser
 * and cannot be styled. Same use as before:
 *   <AppSelect v-model="x" :label="..." :options="[{ value: 'a', label: 'A' }]" />
 * - label is optional (use aria-label instead); `compact` removes the message line and the label
 * - keyboard: Up/Down/Home/End move, Enter/Space choose, Esc closes, typing a letter jumps to an option
 */
interface Option { value: string; label: string; sub?: string; disabled?: boolean }

const model = defineModel<string>({ default: '' })
const props = defineProps<{
  options: Option[]
  label?: string
  ariaLabel?: string
  placeholder?: string
  error?: string | null
  invalid?: boolean
  disabled?: boolean
  hint?: string
  size?: 'md' | 'sm'
  compact?: boolean
}>()

const id = useId()
const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const active = ref(-1)
const rect = ref({ left: 0, top: 0, width: 0, height: 0 })
const placeAbove = ref(false)
const panelMax = ref(256)

const selected = computed(() => props.options.find((o) => o.value === model.value) ?? null)
const bad = computed(() => !!props.error || !!props.invalid)

function measure() {
  const el = button.value
  if (!el) return
  const r = el.getBoundingClientRect()
  rect.value = { left: r.left, top: r.top, width: r.width, height: r.height }
  const below = window.innerHeight - r.bottom - 12
  const above = r.top - 12
  placeAbove.value = below < 180 && above > below
  panelMax.value = Math.max(120, Math.min(288, placeAbove.value ? above : below))
}

function openList() {
  if (props.disabled || open.value) return
  measure()
  const i = props.options.findIndex((o) => o.value === model.value)
  active.value = i >= 0 ? i : props.options.findIndex((o) => !o.disabled)
  open.value = true
  nextTick(scrollActive)
}
function closeList() { open.value = false }
function choose(o: Option) {
  if (o.disabled) return
  model.value = o.value
  closeList()
  button.value?.focus()
}
function scrollActive() {
  document.getElementById(`${id}-opt-${active.value}`)?.scrollIntoView({ block: 'nearest' })
}
function move(step: number) {
  const n = props.options.length
  if (!n) return
  let i = active.value
  for (let k = 0; k < n; k++) {
    i = (i + step + n) % n
    if (!props.options[i]!.disabled) break
  }
  active.value = i
  nextTick(scrollActive)
}

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined
function typeahead(ch: string) {
  typed += ch.toLowerCase()
  clearTimeout(typedTimer)
  typedTimer = setTimeout(() => { typed = '' }, 600)
  const i = props.options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed))
  if (i >= 0) {
    active.value = i
    if (open.value) nextTick(scrollActive)
    else model.value = props.options[i]!.value
  }
}

function onKey(e: KeyboardEvent) {
  if (props.disabled) return
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); open.value ? move(1) : openList(); break
    case 'ArrowUp': e.preventDefault(); open.value ? move(-1) : openList(); break
    case 'Home': if (open.value) { e.preventDefault(); active.value = props.options.findIndex((o) => !o.disabled); nextTick(scrollActive) } break
    case 'End': if (open.value) { e.preventDefault(); active.value = props.options.length - 1 - [...props.options].reverse().findIndex((o) => !o.disabled); nextTick(scrollActive) } break
    case 'Enter':
    case ' ':
      if (open.value) { e.preventDefault(); const o = props.options[active.value]; if (o) choose(o) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList() }
      break
    case 'Escape': if (open.value) { e.preventDefault(); e.stopPropagation(); closeList() } break
    case 'Tab': closeList(); break
    default: if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key)
  }
}

// close on a click outside, keep the list under the button while the page scrolls or resizes
function onDocDown(e: MouseEvent) {
  const t = e.target as Node
  if (button.value?.contains(t) || document.getElementById(`${id}-list`)?.contains(t)) return
  closeList()
}
watch(open, (v) => {
  if (v) {
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
  } else {
    document.removeEventListener('mousedown', onDocDown)
    window.removeEventListener('scroll', measure, true)
    window.removeEventListener('resize', measure)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocDown)
  window.removeEventListener('scroll', measure, true)
  window.removeEventListener('resize', measure)
  clearTimeout(typedTimer)
})

const panelStyle = computed(() => ({
  left: `${rect.value.left}px`,
  minWidth: `${Math.max(rect.value.width, props.compact ? 128 : 0)}px`,
  maxHeight: `${panelMax.value}px`,
  ...(placeAbove.value
      ? { bottom: `${window.innerHeight - rect.value.top + 6}px` }
      : { top: `${rect.value.top + rect.value.height + 6}px` }),
}))
</script>

<template>
  <div>
    <label v-if="label && !compact" :id="`${id}-label`" :for="id" class="mb-1.5 block text-sm font-medium text-slate-700" @click.prevent="button?.focus()">{{ label }}</label>

    <button
        :id="id"
        ref="button"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="open && active >= 0 ? `${id}-opt-${active}` : undefined"
        :aria-label="ariaLabel"
        :aria-labelledby="label && !compact ? `${id}-label` : undefined"
        :aria-invalid="bad ? 'true' : undefined"
        :disabled="disabled"
        class="flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-start text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        :class="[
        size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2.5',
        bad ? 'border-red-400' : open ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-300 hover:border-slate-400 focus:border-indigo-500',
      ]"
        @click="open ? closeList() : openList()"
        @keydown="onKey"
    >
      <span class="truncate" :class="selected ? 'text-slate-900' : 'text-slate-400'">{{ selected ? selected.label : (placeholder ?? '') }}</span>
      <AppIcon name="chevron-down" class="size-4! text-slate-400 transition-transform duration-200" :class="open ? 'rotate-180' : ''" />
    </button>

    <template v-if="!compact">
      <p v-if="hint && !error" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
      <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
    </template>

    <Teleport to="body">
      <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          leave-active-class="transition duration-100 ease-in"
          leave-to-class="opacity-0 scale-95"
      >
        <ul
            v-if="open"
            :id="`${id}-list`"
            role="listbox"
            :aria-label="label ?? ariaLabel"
            class="fixed z-60 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5"
            :class="placeAbove ? 'origin-bottom' : 'origin-top'"
            :style="panelStyle"
        >
          <li v-if="options.length === 0" class="px-3 py-2 text-sm text-slate-400">{{ $t('common.noResults') }}</li>
          <li
              v-for="(o, i) in options"
              :id="`${id}-opt-${i}`"
              :key="o.value"
              role="option"
              :aria-selected="o.value === model"
              :aria-disabled="o.disabled || undefined"
              class="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
              :class="[
              o.disabled ? 'cursor-not-allowed text-slate-300' : i === active ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700',
              o.value === model ? 'font-medium' : '',
            ]"
              @mousedown.prevent
              @mouseenter="!o.disabled && (active = i)"
              @click="choose(o)"
          >
            <span class="truncate">{{ o.label }}<span v-if="o.sub" class="ms-2 text-xs text-slate-400" dir="ltr">{{ o.sub }}</span></span>
            <AppIcon v-if="o.value === model" name="check" class="size-4! text-indigo-600" />
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>