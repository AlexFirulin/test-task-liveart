<script setup lang="ts">
import { ref } from 'vue'
import { useImageDropZone } from '../../composables/useImageDropZone'

const emit = defineEmits<{ select: [files: File[]] }>()

const inputRef = ref<HTMLInputElement | null>(null)

const { isDragOver, rejectedNames, onDragEnter, onDragOver, onDragLeave, onDrop, handleFiles } =
  useImageDropZone((files) => emit('select', files))

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
