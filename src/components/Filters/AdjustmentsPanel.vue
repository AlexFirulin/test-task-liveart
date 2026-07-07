<script setup lang="ts">
import type { Adjustments } from '../../utils/filters'

const props = defineProps<{ modelValue: Adjustments }>()
const emit = defineEmits<{ 'update:modelValue': [value: Adjustments] }>()

function update<K extends keyof Adjustments>(key: K, value: Adjustments[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="adjustments-panel">
    <v-slider
      :model-value="modelValue.brightness"
      label="Brightness"
      :min="0"
      :max="200"
      :step="1"
      @update:model-value="update('brightness', $event)"
    />
    <v-slider
      :model-value="modelValue.contrast"
      label="Contrast"
      :min="0"
      :max="200"
      :step="1"
      @update:model-value="update('contrast', $event)"
    />
    <v-slider
      :model-value="modelValue.saturation"
      label="Saturation"
      :min="0"
      :max="200"
      :step="1"
      @update:model-value="update('saturation', $event)"
    />
  </div>
</template>
