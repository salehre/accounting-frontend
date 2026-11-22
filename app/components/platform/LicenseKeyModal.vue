<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
defineProps<{ licenseKey: string; companyName: string }>()
</script>

<template>
  <AppModal v-model:open="open" :title="$t('platform.license.newTitle', { name: companyName })">
    <div class="space-y-4">
      <SecretBox :value="licenseKey" />
      <AppAlert kind="warning">{{ $t('platform.license.once') }}</AppAlert>
    </div>
    <template #footer>
      <AppButton @click="open = false">{{ $t('platform.license.saved') }}</AppButton>
    </template>
  </AppModal>
</template>