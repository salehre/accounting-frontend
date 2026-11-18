<script setup lang="ts">
import type { ComboOption, DetailAccount } from '~/types/api'

const model = defineModel<number | null>({ default: null })
defineProps<{ initialLabel?: string; invalid?: boolean; ariaLabel?: string; placeholder?: string }>()

const api = useApi()
const options = ref<ComboOption[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

async function search(q: string) {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const mine = ++seq
    loading.value = true
    try {
      const list = await api.get<DetailAccount[]>('/detail-accounts', { search: normalizeDigits(q) || undefined, limit: 20 })
      if (mine === seq) options.value = list.map((d) => ({ value: Number(d.id), label: d.name, sub: d.code }))
    } catch { if (mine === seq) options.value = [] } finally { if (mine === seq) loading.value = false }
  }, 250)
}
onMounted(() => search(''))
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <ComboBox v-model="model" :options="options" remote :loading="loading" :initial-label="initialLabel" :invalid="invalid"
            :aria-label="ariaLabel" :placeholder="placeholder" @search="search" />
</template>