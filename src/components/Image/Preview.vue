<script setup lang="ts">
import type { Coordinates } from 'vue-advanced-cropper'
import { ref, watch } from 'vue'
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
let requestId = 0

async function draw() {
  const id = ++requestId
  const canvas = canvasRef.value
  if (!canvas || !props.src) return

  const image = new Image()
  image.src = props.src
  await image.decode()
  if (id !== requestId) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  drawPipeline(ctx, image, {
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
  <canvas ref="canvasRef" class="image-preview" />
</template>

<style scoped>
.image-preview {
  max-width: 100%;
  height: auto;
  display: block;
}
</style>
