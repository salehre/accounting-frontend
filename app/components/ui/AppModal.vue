<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title: string }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
watch(open, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" @mousedown.self="open = false">
      <div role="dialog" aria-modal="true" class="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900">{{ title }}</h2>
          <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" :aria-label="$t('common.close')" @click="open = false">
            <AppIcon name="x" />
          </button>
        </div>
        <div class="px-5 py-4"><slot /></div>
        <div v-if="$slots.footer" class="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
