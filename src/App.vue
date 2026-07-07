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
  <v-app>
    <v-main>
      <v-container style="max-width: 720px" class="py-8">
        <h1 class="text-h4 mb-6">Image Editor</h1>

        <ImageUploader class="mb-4" @update:model-value="handleAdd" />

        <ImageList
          :images="imagesStore.images"
          @edit="openEditor"
          @remove="imagesStore.removeImage"
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
  </v-app>
</template>
