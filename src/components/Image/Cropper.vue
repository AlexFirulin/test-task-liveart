<script setup lang="ts">
import type { Coordinates, CropperResult } from 'vue-advanced-cropper'
import { Cropper } from 'vue-advanced-cropper'
import { ref } from 'vue'
import 'vue-advanced-cropper/dist/style.css'

defineProps<{ src: string | null; aspectRatio?: number }>()
const emit = defineEmits<{ change: [coordinates: Coordinates] }>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

function onChange(result: CropperResult) {
  emit('change', result.coordinates)
}

function reset() {
  cropperRef.value?.reset()
}

defineExpose({ reset })
</script>

<template>
  <Cropper
    v-if="src"
    ref="cropperRef"
    :src="src"
    class="image-cropper"
    image-restriction="stencil"
    :stencil-props="{ aspectRatio }"
    @change="onChange"
  />
</template>

<style scoped>
.image-cropper {
  max-height: 480px;
  background: #ddd;
}
</style>
