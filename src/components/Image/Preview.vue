<script setup lang="ts">
import type { Coordinates } from 'vue-advanced-cropper'
import { nextTick, ref, watch } from 'vue'
import type { Adjustments, FilterName } from '../../utils/filters'
import { drawPipeline } from '../../utils/render'
import type { Transform } from '../../utils/transform'

const props = defineProps<{
  src: string | null
  crop: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
  transform: Transform
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasError = ref(false)
let requestId = 0

async function draw() {
  const id = ++requestId
  if (!props.src) {
    hasError.value = false
    return
  }

  const image = new Image()
  image.src = props.src
  try {
    await image.decode()
  } catch {
    if (id === requestId) hasError.value = true
    return
  }
  if (id !== requestId) return

  // The canvas is only in the DOM when hasError is false — wait for that
  // switch to actually render before grabbing the (possibly new) element.
  hasError.value = false
  await nextTick()
  if (id !== requestId) return

  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  await drawPipeline(ctx, image, {
    cropCoordinates: props.crop,
    adjustments: props.adjustments,
    filter: props.filter,
    transform: props.transform,
  })
}

watch(() => [props.src, props.crop, props.adjustments, props.filter, props.transform], draw, {
  immediate: true,
})
</script>

<template>
  <div v-if="hasError" class="image-preview image-preview--broken">
    <v-icon icon="mdi-image-broken-variant" />
  </div>
  <canvas v-else ref="canvasRef" class="image-preview" />
</template>

<style scoped>
.image-preview {
  max-width: 100%;
  height: auto;
  display: block;
}

.image-preview--broken {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ddd;
  color: rgba(0, 0, 0, 0.54);
}
</style>
