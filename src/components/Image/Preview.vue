<script setup lang="ts">
import type { Coordinates } from 'vue-advanced-cropper'
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string | null
  crop: Coordinates | null
  filter: string
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

  const crop = props.crop ?? {
    left: 0,
    top: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }

  canvas.width = crop.width
  canvas.height = crop.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height)
}

watch(() => [props.src, props.crop], draw, { immediate: true })
</script>

<template>
  <canvas ref="canvasRef" class="image-preview" :style="{ filter }" />
</template>

<style scoped>
.image-preview {
  max-width: 100%;
  height: auto;
  display: block;
}
</style>
