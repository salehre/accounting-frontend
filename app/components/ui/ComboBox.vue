<script setup lang="ts">
import type { ComboOption } from '~/types/api'

const model = defineModel<number | string | null>({ default: null })
const props = defineProps<{
  options: ComboOption[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  loading?: boolean
  remote?: boolean          // the parent searches (emit "search"); no local filtering
  initialLabel?: string     // label of the current value when it is not in "options" yet
  ariaLabel?: string
  emptyText?: string
}>()
const emit = defineEmits<{ search: [query: string] }>()

const input = ref<HTMLInputElement | null>(null)
const open = ref(false)
const text = ref('')
const active = ref(0)
const rect = ref({ left: 0, top: 0, width: 0 })
const chosenLabel = ref(props.initialLabel ?? '')
const listId = useId()

const selected = computed(() => props.options.find((o) => o.value === model.value))
const shownLabel = computed(() => (model.value === null ? '' : selected.value?.label ?? chosenLabel.value))

watch(() => [model.value, props.initialLabel] as const, () => {
  if (model.value === null) chosenLabel.value = ''
  else if (props.initialLabel && !selected.value) chosenLabel.value = props.initialLabel
  if (!open.value) text.value = shownLabel.value
}, { immediate: true })

const filtered = computed(() => {
  if (props.remote) return props.options
  const q = normalizeDigits(text.value.trim().toLowerCase())
  if (!q || (selected.value && text.value === selected.value.label)) return props.options.slice(0, 200)
  return props.options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q)).slice(0, 200)
})

function place() {
  const r = input.value?.getBoundingClientRect()
  if (r) rect.value = { left: r.left, top: r.bottom + 4, width: Math.max(r.width, 220) }
}
function openList() {
  if (props.disabled) return
  place()
  open.value = true
  active.value = Math.max(0, filtered.value.findIndex((o) => o.value === model.value))
}
function close(restore = true) {
  open.value = false
  if (restore) text.value = shownLabel.value
}
function choose(o: ComboOption) {
  chosenLabel.value = o.label
  model.value = o.value
  text.value = o.label
  open.value = false
}
function clear() {
  model.value = null
  chosenLabel.value = ''
  text.value = ''
  emit('search', '')
  input.value?.focus()
}
function onInput() {
  if (!open.value) openList()
  active.value = 0
  emit('search', text.value.trim())
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (!open.value) openList(); else active.value = Math.min(active.value + 1, filtered.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0) }
  else if (e.key === 'Enter' && open.value) { e.preventDefault(); const o = filtered.value[active.value]; if (o) choose(o) }
  else if (e.key === 'Escape' && open.value) { e.stopPropagation(); close() }
  else if (e.key === 'Tab') close()
}
function onResize() { if (open.value) place() }
onMounted(() => { window.addEventListener('resize', onResize); window.addEventListener('scroll', onResize, true) })
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize, true) })
</script>

<template>
  <div class="relative">
    <input
        ref="input" v-model="text" type="text" autocomplete="off" role="combobox"
        :aria-expanded="open" :aria-controls="listId" :aria-label="ariaLabel" :placeholder="placeholder" :disabled="disabled"
        class="block w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40"
        :class="[invalid ? 'border-red-400' : 'border-slate-300 focus:border-indigo-500', model !== null && !disabled ? 'pe-8' : '']"
        @focus="($event.target as HTMLInputElement).select(); openList()" @input="onInput" @keydown="onKey" @blur="close()"
    >
    <button v-if="model !== null && !disabled" type="button" tabindex="-1" class="absolute inset-y-0 inset-e-1.5 my-auto size-6 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            :aria-label="$t('common.clear')" @mousedown.prevent @click="clear"><AppIcon name="x" class="mx-auto size-4" /></button>

    <Teleport to="body">
      <ul v-if="open" :id="listId" role="listbox"
          class="fixed z-60 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          :style="{ left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px' }" @mousedown.prevent>
        <li v-if="loading" class="px-3 py-2 text-slate-500">{{ $t('common.loading') }}</li>
        <li v-else-if="filtered.length === 0" class="px-3 py-2 text-slate-500">{{ emptyText ?? $t('common.noResults') }}</li>
        <li v-for="(o, i) in filtered" :key="o.value" role="option" :aria-selected="o.value === model"
            class="cursor-pointer px-3 py-2" :class="i === active ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50'"
            @mouseenter="active = i" @click="choose(o)">
          <span>{{ o.label }}</span><span v-if="o.sub" class="ms-2 text-xs text-slate-500">{{ o.sub }}</span>
        </li>
      </ul>
    </Teleport>
  </div>
</template>