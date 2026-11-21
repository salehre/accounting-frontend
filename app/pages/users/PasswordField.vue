<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{ label: string; error?: string | null; hint?: string }>()

const visible = ref(false)
function generate() {
  model.value = generatePassword()
  visible.value = true // the administrator has to see it to pass it on
}
</script>

<template>
  <div>
    <AppInput v-model="model" :type="visible ? 'text' : 'password'" ltr autocomplete="new-password" :label="label" :error="error" :hint="hint" />
    <div class="mt-1.5 flex items-center justify-between gap-3 text-xs">
      <label class="flex items-center gap-1.5 text-slate-600"><input v-model="visible" type="checkbox" class="size-3.5 rounded border-slate-300">{{ $t('users.showPassword') }}</label>
      <button type="button" class="font-medium text-indigo-600 hover:underline" @click="generate">{{ $t('users.generate') }}</button>
    </div>
  </div>
</template>