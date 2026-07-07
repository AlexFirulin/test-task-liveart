<script setup lang="ts">
import { ref } from 'vue'
import type { ImageItem } from '../../stores/images'
import { downloadImage, downloadOperationsJson } from '../../utils/export'
import { type OperationsInput, parseOperationsFile } from '../../utils/operations'
import ImagePreview from './Preview.vue'

defineProps<{ images: ImageItem[]; activeId: string | null }>()
const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
  import: [id: string, input: OperationsInput]
}>()

const importInputRef = ref<HTMLInputElement | null>(null)
const importTargetId = ref<string | null>(null)
const importError = ref<string | null>(null)

function triggerImport(id: string) {
  importTargetId.value = id
  importInputRef.value?.click()
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  const id = importTargetId.value
  input.value = ''
  importTargetId.value = null
  if (!file || !id) return

  try {
    const operationsInput = parseOperationsFile(await file.text())
    emit('import', id, operationsInput)
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Failed to import operations JSON'
  }
}
</script>

<template>
  <v-list class="image-list">
    <v-list-item v-if="images.length === 0">
      <v-list-item-title class="text-center">No images uploaded</v-list-item-title>
    </v-list-item>
    <v-list-item
      v-for="item in images"
      :key="item.id"
      :class="{ 'image-list__item--active': item.id === activeId }"
    >
      <template #prepend>
        <div class="image-list__thumb">
          <ImagePreview
            :src="item.url"
            :crop="item.cropCoordinates"
            :adjustments="item.adjustments"
            :filter="item.filter"
            :transform="item.transform"
            style="width: 64px; height: 64px; object-fit: cover"
          />
        </div>
      </template>

      <v-list-item-title>{{ item.file.name }}</v-list-item-title>

      <template #append>
        <div class="d-flex align-center ga-1">
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="emit('edit', item.id)">
            <v-icon icon="mdi-pencil" />
            <v-tooltip activator="parent" location="top">Edit</v-tooltip>
          </v-btn>
          <v-btn icon="mdi-download" size="small" variant="text" @click="downloadImage(item)">
            <v-icon icon="mdi-download" />
            <v-tooltip activator="parent" location="top">Download image</v-tooltip>
          </v-btn>
          <v-btn
            icon="mdi-code-json"
            size="small"
            variant="text"
            @click="downloadOperationsJson(item)"
          >
            <v-icon icon="mdi-code-json" />
            <v-tooltip activator="parent" location="top">Export operations JSON</v-tooltip>
          </v-btn>
          <v-btn icon="mdi-upload" size="small" variant="text" @click="triggerImport(item.id)">
            <v-icon icon="mdi-upload" />
            <v-tooltip activator="parent" location="top">Import operations JSON</v-tooltip>
          </v-btn>
          <v-btn icon="mdi-delete" size="small" variant="text" @click="emit('remove', item.id)">
            <v-icon icon="mdi-delete" />
            <v-tooltip activator="parent" location="top">Delete</v-tooltip>
          </v-btn>
        </div>
      </template>
    </v-list-item>
  </v-list>

  <input
    ref="importInputRef"
    type="file"
    accept="application/json"
    class="d-none"
    @change="handleImport"
  />

  <v-snackbar
    :model-value="importError !== null"
    color="error"
    @update:model-value="importError = null"
  >
    {{ importError }}
  </v-snackbar>
</template>

<style scoped>
.image-list__thumb {
  width: 64px;
  height: 64px;
  margin-right: 12px;
  overflow: hidden;
  border-radius: 4px;
}

.image-list__item--active {
  background: rgba(var(--v-theme-primary), 0.12);
  border-left: 3px solid rgb(var(--v-theme-primary));
}
</style>
