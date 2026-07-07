<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ select: [files: File[]] }>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const rejectedNames = ref<string[] | null>(null)
let dragDepth = 0

function triggerUpload() {
  inputRef.value?.click()
}

function splitByType(files: File[]): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = []
  const rejected: string[] = []
  for (const file of files) {
    if (file.type.startsWith('image/')) accepted.push(file)
    else rejected.push(file.name)
  }
  return { accepted, rejected }
}

function emitSelection(files: File[]) {
  const { accepted, rejected } = splitByType(files)
  if (accepted.length > 0) emit('select', accepted)
  rejectedNames.value = rejected.length > 0 ? rejected : null
}

function handleChange(event: Event) {
  const input = event.target as HTMLInputElement
  emitSelection(Array.from(input.files ?? []))
  input.value = ''
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  event.stopPropagation()
  dragDepth += 1
  isDragOver.value = true
}

function onDragOver(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
}

function onDragLeave(event: DragEvent) {
  if (!hasFiles(event)) return
  event.stopPropagation()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragOver.value = false
}

function onDrop(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  event.stopPropagation()
  dragDepth = 0
  isDragOver.value = false
  emitSelection(Array.from(event.dataTransfer?.files ?? []))
}
</script>

<template>
  <v-card
    class="image-uploader"
    :class="{ 'image-uploader--drag-over': isDragOver }"
    elevation="0"
    @click="triggerUpload"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
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
