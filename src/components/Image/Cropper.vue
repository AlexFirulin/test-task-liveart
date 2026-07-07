<script setup lang="ts">
import type { CropperResult, ImageTransforms } from 'vue-advanced-cropper'
import { Cropper } from 'vue-advanced-cropper'
import { ref } from 'vue'
import 'vue-advanced-cropper/dist/style.css'
import type { Crop } from '../../types/crop'
import type { Transform } from '../../types/transform'
import { normalizeRotation } from '../../utils/transform'

// This is the only file in the app that imports vue-advanced-cropper (aside
// from the `<Cropper>` component it wraps below) — everywhere else works
// with our own Crop/Transform types. rawTransforms is the library's own
// ImageTransforms shape (unbounded, incremental `rotate`, boolean flip
// pair); it never leaves this component. `emit('change', ...)` and
// `applyTransform` both only ever deal in our normalized `Transform`.
defineProps<{ src: string | null; aspectRatio?: number }>()
const emit = defineEmits<{
  change: [crop: Crop, transform: Transform]
  ready: []
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const rawTransforms = ref<ImageTransforms>({ rotate: 0, flip: { horizontal: false, vertical: false } })

function toTransform(transforms: ImageTransforms): Transform {
  return {
    rotate: normalizeRotation(transforms.rotate),
    flipX: transforms.flip.horizontal,
    flipY: transforms.flip.vertical,
  }
}

function onChange(result: CropperResult) {
  rawTransforms.value = result.image.transforms
  // result.coordinates (the library's Coordinates) and our Crop are the same
  // shape (`{ left, top, width, height }`), so this is a type-only relabel,
  // not a conversion — no data is dropped or reshaped.
  emit('change', result.coordinates, toTransform(result.image.transforms))
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

/**
 * Drives the cropper to an absolute target Transform. rotate()/flip() on
 * vue-advanced-cropper are incremental (rotate adds to the current angle,
 * flip toggles per axis), so this reads the library's last-reported raw
 * transforms and applies only the delta needed — correct regardless of
 * whatever the cropper's internal angle happens to be, instead of assuming a
 * zero baseline. Kept here (rather than in EditorPanel, which only ever
 * wants "reach this Transform") so the caller never needs to know
 * ImageTransforms' incremental/raw shape at all.
 */
function applyTransform(target: Transform): void {
  const current = rawTransforms.value
  const rotateDelta = target.rotate - normalizeRotation(current.rotate)
  if (rotateDelta !== 0) rotate(rotateDelta)

  const needsFlipX = current.flip.horizontal !== target.flipX
  const needsFlipY = current.flip.vertical !== target.flipY
  if (needsFlipX || needsFlipY) flip(needsFlipX, needsFlipY)
}

defineExpose({ reset, rotate, flip, applyTransform })
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
