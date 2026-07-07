<script setup lang="ts">
import type { Coordinates, CropperResult, ImageTransforms } from 'vue-advanced-cropper'
import { Cropper } from 'vue-advanced-cropper'
import { ref } from 'vue'
import 'vue-advanced-cropper/dist/style.css'

defineProps<{ src: string | null; aspectRatio?: number }>()
const emit = defineEmits<{
  change: [coordinates: Coordinates, transforms: ImageTransforms]
  ready: []
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

function onChange(result: CropperResult) {
  emit('change', result.coordinates, result.image.transforms)
}

function reset() {
  return cropperRef.value?.reset()
}

/**
 * vue-advanced-cropper's rotate()/flip() no-op while a transition from a
 * previous call is still "active" (its own internal debounce) — passing
 * `{ transitions: false }` as a 3rd argument suppresses that so our
 * programmatic calls (state restoration, quick repeated clicks) always take
 * effect immediately. The shipped .d.ts doesn't declare that 3rd argument
 * even though the runtime accepts it, hence the cast.
 */
function rotate(angle: number) {
  ;(
    cropperRef.value as unknown as { rotate: (a: number, o: { transitions: boolean }) => void }
  )?.rotate(angle, { transitions: false })
}

function flip(horizontal: boolean, vertical: boolean) {
  ;(
    cropperRef.value as unknown as {
      flip: (h: boolean, v: boolean, o: { transitions: boolean }) => void
    }
  )?.flip(horizontal, vertical, { transitions: false })
}

defineExpose({ reset, rotate, flip })
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
    @ready="emit('ready')"
  />
</template>

<style scoped>
/* Fills whatever fixed-size box the parent (EditorPanel's .preview-zone)
   gives it — vue-advanced-cropper scales the image to fit that box itself
   (contain, preserving aspect ratio), so the box's own size must come purely
   from the parent, not from this image's natural dimensions. */
.image-cropper {
  width: 100%;
  height: 100%;
  background: #ddd;
}

/* The letterbox/pillarbox bars visible when the image's aspect ratio doesn't
   match this fixed box come from the library's own full-size background
   layer (opaque black by default), not from .image-cropper's background
   above — override just that layer so the bars match our letterbox color.
   (Leaves __foreground alone: that's the separate dim-outside-the-stencil
   overlay used while actively cropping, not a letterbox artifact.) */
.image-cropper :deep(.vue-advanced-cropper__background) {
  background: #ddd;
}
</style>
