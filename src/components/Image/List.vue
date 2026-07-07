<script setup lang="ts">
import { ref } from 'vue'
import type { ImageItem } from '../../stores/images'
import { downloadImage, downloadOperationsJson } from '../../utils/export'
import { type OperationsInput, parseOperationsFile } from '../../utils/operations'
import ImagePreview from './Preview.vue'

const props = defineProps<{ images: ImageItem[]; activeId: string | null }>()
const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
  import: [id: string, input: OperationsInput]
}>()

const importInputRef = ref<HTMLInputElement | null>(null)
const importTargetId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const downloadingIds = ref<Set<string>>(new Set())
const exportingIds = ref<Set<string>>(new Set())

// Same-named uploads (e.g. two "photo.jpg" from different folders) would
// otherwise silently overwrite each other's downloaded file — give the
// duplicates a short, stable suffix so each download lands as its own file.
function uniqueSuffixFor(item: ImageItem): string | undefined {
  const isDuplicateName = props.images.some(
    (other) => other.id !== item.id && other.file.name === item.file.name,
  )
  return isDuplicateName ? item.id.slice(0, 6) : undefined
}

async function handleDownload(item: ImageItem) {
  if (downloadingIds.value.has(item.id)) return
  downloadingIds.value.add(item.id)
  try {
    await downloadImage(item, uniqueSuffixFor(item))
  } catch {
    actionError.value = 'Failed to export: the file is corrupted or unavailable'
  } finally {
    downloadingIds.value.delete(item.id)
  }
}

async function handleExportJson(item: ImageItem) {
  if (exportingIds.value.has(item.id)) return
  exportingIds.value.add(item.id)
  try {
    downloadOperationsJson(item, uniqueSuffixFor(item))
  } catch {
    actionError.value = 'Failed to export operations JSON'
  } finally {
    exportingIds.value.delete(item.id)
  }
}

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
    actionError.value = error instanceof Error ? error.message : 'Failed to import operations JSON'
  }
}
</script>

<template>
  <v-list class="image-list">
    <v-list-item v-if="images.length === 0">
      <v-list-item-title class="text-center">Images list is empty</v-list-item-title>
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
          <v-btn
            icon="mdi-download"
            size="small"
            variant="text"
            :loading="downloadingIds.has(item.id)"
            :disabled="downloadingIds.has(item.id)"
            @click="handleDownload(item)"
          >
            <v-icon icon="mdi-download" />
            <v-tooltip activator="parent" location="top">Download image</v-tooltip>
          </v-btn>
          <v-btn
            icon="mdi-code-json"
            size="small"
            variant="text"
            :loading="exportingIds.has(item.id)"
            :disabled="exportingIds.has(item.id)"
            @click="handleExportJson(item)"
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
    :model-value="actionError !== null"
    color="error"
    @update:model-value="actionError = null"
  >
    {{ actionError }}
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
