<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{ icon?: string; size?: string | number }>(), {
  icon: 'mdi-plus',
})
const emit = defineEmits<{ 'update:modelValue': [file: File | null] }>()

const inputRef = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  inputRef.value?.click()
}

function handleChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  emit('update:modelValue', file)
  ;(event.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div class="image-uploader">
    <input ref="inputRef" type="file" accept="image/*" class="d-none" @change="handleChange" />
    <v-btn :icon="icon" :size="size" variant="tonal" @click="triggerUpload" />
  </div>
</template>
