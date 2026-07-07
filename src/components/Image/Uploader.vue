<script setup lang="ts">
import { ref } from 'vue'
import { useImageDropZone } from '../../composables/useImageDropZone'

const emit = defineEmits<{ select: [files: File[]] }>()

const inputRef = ref<HTMLInputElement | null>(null)
const sizeWarnings = ref<string[] | null>(null)

// Soft limits only — surfaced as a warning so the user knows editing may be
// slow, never blocks the upload itself.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
const MAX_MEGAPIXELS = 40_000_000

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  return image
    .decode()
    .then(() => ({ width: image.naturalWidth, height: image.naturalHeight }))
    .catch(() => null)
    .finally(() => URL.revokeObjectURL(url))
}

async function checkFileSize(file: File): Promise<string[]> {
  const warnings: string[] = []
  if (file.size > MAX_FILE_SIZE_BYTES) {
    warnings.push(`${file.name}: file is ${(file.size / 1024 / 1024).toFixed(1)}MB, above the recommended 25MB`)
  }

  const dimensions = await getImageDimensions(file)
  if (dimensions) {
    const megapixels = dimensions.width * dimensions.height
    if (megapixels > MAX_MEGAPIXELS) {
      warnings.push(
        `${file.name}: image is ${Math.round(megapixels / 1_000_000)}MP, above the recommended 40MP — editing may be slow`,
      )
    }
  }

  return warnings
}

async function handleAccepted(files: File[]) {
  const warnings = (await Promise.all(files.map(checkFileSize))).flat()
  sizeWarnings.value = warnings.length > 0 ? warnings : null
  emit('select', files)
}

const { isDragOver, rejectedNames, onDragEnter, onDragOver, onDragLeave, onDrop, handleFiles } =
  useImageDropZone(handleAccepted)

function triggerUpload() {
  inputRef.value?.click()
}

function handleChange(event: Event) {
  const input = event.target as HTMLInputElement
  handleFiles(Array.from(input.files ?? []))
  input.value = ''
}

// This card sits inside App.vue's own page-wide drop zone — without
// stopping propagation, a drop here would also bubble up and add every file
// a second time.
function stop<E extends Event>(handler: (event: E) => void) {
  return (event: E) => {
    event.stopPropagation()
    handler(event)
  }
}

const onDragEnterLocal = stop(onDragEnter)
const onDragOverLocal = stop(onDragOver)
const onDragLeaveLocal = stop(onDragLeave)
const onDropLocal = stop(onDrop)
</script>

<template>
  <v-card
    class="image-uploader"
    :class="{ 'image-uploader--drag-over': isDragOver }"
    elevation="0"
    @click="triggerUpload"
    @dragenter="onDragEnterLocal"
    @dragover="onDragOverLocal"
    @dragleave="onDragLeaveLocal"
    @drop="onDropLocal"
  >
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      multiple
      class="d-none"
      @change="handleChange"
    />
    <div class="image-uploader__content">
      <v-icon icon="mdi-cloud-upload-outline" size="40" />
      <div class="mt-2">Drag and drop an image here, or click to browse</div>
    </div>
  </v-card>

  <v-snackbar
    :model-value="rejectedNames !== null"
    color="error"
    @update:model-value="rejectedNames = null"
  >
    Not an image, skipped: {{ rejectedNames?.join(', ') }}
  </v-snackbar>

  <v-snackbar
    :model-value="sizeWarnings !== null"
    color="warning"
    @update:model-value="sizeWarnings = null"
  >
    <div v-for="warning in sizeWarnings" :key="warning">{{ warning }}</div>
  </v-snackbar>
</template>

<style scoped>
.image-uploader {
  width: 100%;
  padding: 24px;
  border: 2px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
}

.image-uploader__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.image-uploader--drag-over {
  border-color: rgb(var(--v-theme-primary));
  transform: scale(1.01);
}
</style>
