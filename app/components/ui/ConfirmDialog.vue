<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title: string; message: string; confirmLabel: string; loading?: boolean }>()
defineEmits<{ confirm: [] }>()
</script>

<template>
  <AppModal v-model:open="open" :title="title">
    <p class="text-sm text-slate-700">{{ message }}</p>
    <template #footer>
      <AppButton variant="secondary" @click="open = false">{{ $t('common.cancel') }}</AppButton>
      <AppButton variant="danger" :loading="loading" @click="$emit('confirm')">{{ confirmLabel }}</AppButton>
    </template>
  </AppModal>
</template>
