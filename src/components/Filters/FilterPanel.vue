<script setup lang="ts">
import type { FilterName } from '../../utils/filters'

defineProps<{ modelValue: FilterName | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: FilterName | null] }>()

function toggle(name: FilterName, checked: boolean | null) {
  emit('update:modelValue', checked ? name : null)
}
</script>

<template>
  <div class="filter-panel d-flex ga-4">
    <v-checkbox
      label="Greyscale"
      :model-value="modelValue === 'greyscale'"
      hide-details
      density="compact"
      @update:model-value="(checked) => toggle('greyscale', checked)"
    />
    <v-checkbox
      label="Sepia"
      :model-value="modelValue === 'sepia'"
      hide-details
      density="compact"
      @update:model-value="(checked) => toggle('sepia', checked)"
    />
  </div>
</template>
