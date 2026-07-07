<script setup lang="ts">
import type { Coordinates } from 'vue-advanced-cropper'
import { computed, ref } from 'vue'
import ImageEditorDialog from './components/Image/EditorDialog.vue'
import ImageList from './components/Image/List.vue'
import ImageUploader from './components/Image/Uploader.vue'
import { useImagesStore } from './stores/images'
import { type Adjustments, type FilterName, defaultAdjustments } from './utils/filters'
import { preloadImage } from './utils/preload'
import { type Transform, defaultTransform } from './utils/transform'

const imagesStore = useImagesStore()
const editingId = ref<string | null>(null)
const editorOpen = ref(false)
const isNewUpload = ref(false)

const editingImage = computed(
  () => imagesStore.images.find((image) => image.id === editingId.value) ?? null,
)

async function openEditor(id: string, isNew = false) {
  editingId.value = id
  isNewUpload.value = isNew

  const item = imagesStore.images.find((image) => image.id === id)
  if (item) await preloadImage(item.url)

  editorOpen.value = true
}

function handleAdd(file: File | null) {
  if (!file) return
  openEditor(imagesStore.addImage(file), true)
}

let dragDepth = 0
const isDraggingFiles = ref(false)
const dropError = ref<string | null>(null)

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  dragDepth += 1
  isDraggingFiles.value = true
}

function onDragOver(event: DragEvent) {
  if (hasFiles(event)) event.preventDefault()
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDraggingFiles.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  isDraggingFiles.value = false

  const files = Array.from(event.dataTransfer?.files ?? [])
  const rejected: string[] = []
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      imagesStore.addImage(file)
    } else {
      rejected.push(file.name)
    }
  }
  if (rejected.length > 0) {
    dropError.value = `Not an image, skipped: ${rejected.join(', ')}`
  }
}

function applyEdits(payload: {
  crop: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
  transform: Transform
}) {
  if (!editingId.value) return
  imagesStore.setCrop(editingId.value, payload.crop)
  imagesStore.setAdjustments(editingId.value, payload.adjustments)
  imagesStore.setFilter(editingId.value, payload.filter)
  imagesStore.setTransform(editingId.value, payload.transform)
}

function cancelEdit() {
  if (editingId.value && isNewUpload.value) imagesStore.removeImage(editingId.value)
  editingId.value = null
}
</script>

<template>
  <v-app @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <v-main>
      <v-container style="max-width: 720px" class="py-8">
        <h1 class="text-h4 mb-6">Image Editor</h1>

        <ImageUploader class="mb-4" @update:model-value="handleAdd" />

        <ImageList
          :images="imagesStore.images"
          @edit="openEditor"
          @remove="imagesStore.removeImage"
          @import="imagesStore.applyOperations"
        />

        <ImageEditorDialog
          v-model="editorOpen"
          :src="editingImage?.url ?? null"
          :initial-crop="editingImage?.cropCoordinates ?? null"
          :initial-adjustments="editingImage?.adjustments ?? defaultAdjustments"
          :initial-filter="editingImage?.filter ?? null"
          :initial-transform="editingImage?.transform ?? defaultTransform"
          @apply="applyEdits"
          @cancel="cancelEdit"
        />
      </v-container>
    </v-main>

    <div v-if="isDraggingFiles" class="drop-overlay">
      <div class="drop-overlay__label">Drop images to upload</div>
    </div>

    <v-snackbar
      :model-value="dropError !== null"
      color="error"
      @update:model-value="dropError = null"
    >
      {{ dropError }}
    </v-snackbar>
  </v-app>
</template>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px dashed rgb(var(--v-theme-primary));
  background: rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.drop-overlay__label {
  padding: 12px 24px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.25rem;
}
</style>
