<script setup lang="ts">
const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const fmt = useFormat()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.page * props.pageSize, props.total))
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
    <span>{{ $t('common.rangeOf', { from: fmt.money(from), to: fmt.money(to), total: fmt.money(total) }) }}</span>
    <div class="flex items-center gap-2">
      <AppButton variant="secondary" :disabled="page <= 1" @click="emit('update:page', page - 1)">{{ $t('common.previous') }}</AppButton>
      <span>{{ fmt.money(page) }} / {{ fmt.money(pages) }}</span>
      <AppButton variant="secondary" :disabled="page >= pages" @click="emit('update:page', page + 1)">{{ $t('common.next') }}</AppButton>
    </div>
  </div>
</template>