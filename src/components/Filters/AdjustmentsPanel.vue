<script setup lang="ts">
import type { Adjustments } from '../../types/adjustments'

const props = defineProps<{ modelValue: Adjustments }>()
const emit = defineEmits<{ 'update:modelValue': [value: Adjustments] }>()

const ADJUSTMENT_MIN = 0
const ADJUSTMENT_MAX = 200
const ADJUSTMENT_DEFAULT = 100

function update<K extends keyof Adjustments>(key: K, value: Adjustments[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function updateFromText<K extends keyof Adjustments>(key: K, value: string) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return
  const clamped = Math.min(ADJUSTMENT_MAX, Math.max(ADJUSTMENT_MIN, parsed))
  update(key, clamped as Adjustments[K])
}

function resetToDefault<K extends keyof Adjustments>(key: K) {
  update(key, ADJUSTMENT_DEFAULT as Adjustments[K])
}
</script>

<template>
  <div class="adjustments-panel">
    <div class="adjustments-panel__row">
      <v-slider
        :model-value="modelValue.brightness"
        :min="ADJUSTMENT_MIN"
        :max="ADJUSTMENT_MAX"
        :step="1"
        class="adjustments-panel__slider"
        @update:model-value="update('brightness', $event)"
      >
        <template #label>
          <span class="adjustments-panel__label" @dblclick="resetToDefault('brightness')">
            Brightness
          </span>
        </template>
      </v-slider>
      <v-text-field
        :model-value="modelValue.brightness"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        :min="ADJUSTMENT_MIN"
        :max="ADJUSTMENT_MAX"
        class="adjustments-panel__input"
        @update:model-value="updateFromText('brightness', $event)"
      />
    </div>
    <div class="adjustments-panel__row">
      <v-slider
        :model-value="modelValue.contrast"
        :min="ADJUSTMENT_MIN"
        :max="ADJUSTMENT_MAX"
        :step="1"
        class="adjustments-panel__slider"
        @update:model-value="update('contrast', $event)"
      >
        <template #label>
          <span class="adjustments-panel__label" @dblclick="resetToDefault('contrast')">
            Contrast
          </span>
        </template>
      </v-slider>
      <v-text-field
        :model-value="modelValue.contrast"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        :min="ADJUSTMENT_MIN"
        :max="ADJUSTMENT_MAX"
        class="adjustments-panel__input"
        @update:model-value="updateFromText('contrast', $event)"
      />
    </div>
    <div class="adjustments-panel__row">
      <v-slider
        :model-value="modelValue.saturation"
        :min="ADJUSTMENT_MIN"
        :max="ADJUSTMENT_MAX"
        :step="1"
        class="adjustments-panel__slider"
        @update:model-value="update('saturation', $event)"
      >
        <template #label>
          <span class="adjustments-panel__label" @dblclick="resetToDefault('saturation')">
            Saturation
          </span>
        </template>
      </v-slider>
      <v-text-field
        :model-value="modelValue.saturation"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        :min="ADJUSTMENT_MIN"
        :max="ADJUSTMENT_MAX"
        class="adjustments-panel__input"
        @update:model-value="updateFromText('saturation', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.adjustments-panel__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.adjustments-panel__slider {
  flex: 1 1 auto;
  min-width: 0;
}

.adjustments-panel__input {
  flex: 0 0 64px;
  width: 64px;
}

.adjustments-panel__label {
  cursor: pointer;
  user-select: none;
}
</style>
