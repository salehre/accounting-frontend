<script setup lang="ts">
// "Are you sure?" before signing out. `platform` selects which session is ended.
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ platform?: boolean }>()
const session = useSessionStore()
const platformStore = usePlatformStore()
const busy = ref(false)

async function out() {
  busy.value = true
  try {
    if (props.platform) await platformStore.logout()
    else await session.logout()
  } finally {
    busy.value = false
    open.value = false
  }
}
</script>

<template>
  <ConfirmDialog v-model:open="open" :title="$t('auth.logoutTitle')" :message="$t('auth.logoutAsk')" :confirm-label="$t('auth.logout')" :loading="busy" @confirm="out" />
</template>