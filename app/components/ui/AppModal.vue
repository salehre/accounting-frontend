<script setup lang="ts">
/**
 * A dialog. Keyboard and screen-reader behaviour is handled here once, for every dialog of the app:
 * focus moves in when it opens (the first field, not the close button), Tab stays inside, Esc closes,
 * the page behind does not scroll, and focus goes back to the button that opened it.
 */
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title: string; size?: 'md' | 'lg' }>()

const titleId = useId()
const dialog = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
let opener: HTMLElement | null = null

function focusables(): HTMLElement[] {
  return [...(dialog.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent !== null || el === document.activeElement)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // a dropdown inside the dialog uses Esc to close itself: that must not close the dialog too
    if (!e.defaultPrevented) open.value = false
    return
  }
  if (e.key !== 'Tab') return
  const list = focusables()
  if (!list.length) { e.preventDefault(); return }
  const first = list[0]!
  const last = list[list.length - 1]!
  const inside = dialog.value?.contains(document.activeElement)
  if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus() }
}

// several dialogs can be open (a confirmation over a form): the page scrolls again only when the last one closes
let openCount = 0
function lock(on: boolean) {
  const w = window as unknown as { __modals?: number }
  w.__modals = Math.max(0, (w.__modals ?? 0) + (on ? 1 : -1))
  document.body.style.overflow = w.__modals > 0 ? 'hidden' : ''
}

watch(open, async (v) => {
  if (v) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.addEventListener('keydown', onKey)
    lock(true)
    openCount++
    await nextTick()
    const field = body.value?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[role=combobox]:not([disabled])')
    ;(field ?? focusables()[0] ?? dialog.value)?.focus()
  } else if (openCount > 0) {
    close()
  }
})

function close() {
  window.removeEventListener('keydown', onKey)
  if (openCount > 0) { openCount--; lock(false) }
  const back = opener
  opener = null
  nextTick(() => back?.isConnected && back.focus())
}

onBeforeUnmount(() => { if (openCount > 0) close() })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" @mousedown.self="open = false">
      <div ref="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1"
           class="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl" :class="size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 :id="titleId" class="text-base font-semibold text-slate-900">{{ title }}</h2>
          <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" :aria-label="$t('common.close')" @click="open = false">
            <AppIcon name="x" />
          </button>
        </div>
        <div ref="body" class="px-5 py-4"><slot /></div>
        <div v-if="$slots.footer" class="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>