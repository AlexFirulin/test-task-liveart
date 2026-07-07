<script setup lang="ts">
import type { FilterName } from '../../types/adjustments'

defineProps<{ modelValue: FilterName | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: FilterName | null] }>()

const options: { label: string; value: FilterName }[] = [
  { label: 'Greyscale', value: 'greyscale' },
  { label: 'Sepia', value: 'sepia' },
  { label: 'Invert', value: 'invert' },
  { label: 'Warm', value: 'warm' },
  { label: 'Cool', value: 'cool' },
  { label: 'Vintage', value: 'vintage' },
]
</script>

<template>
  <v-chip-group
    class="filter-panel"
    :model-value="modelValue ?? undefined"
    @update:model-value="emit('update:modelValue', $event ?? null)"
  >
    <v-chip
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      size="small"
      variant="outlined"
    >
      {{ option.label }}
    </v-chip>
  </v-chip-group>
</template>
