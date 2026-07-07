<script setup lang="ts">
import type { ImageItem } from '../../stores/images'
import { downloadImage, downloadOperationsJson } from '../../utils/export'
import ImagePreview from './Preview.vue'

defineProps<{ images: ImageItem[] }>()
const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
}>()
</script>

<template>
  <v-list class="image-list">
    <v-list-item v-if="images.length === 0">
      <v-list-item-title class="text-center">No images uploaded</v-list-item-title>
    </v-list-item>
    <v-list-item v-for="item in images" :key="item.id">
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
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="emit('edit', item.id)" />
          <v-btn icon="mdi-download" size="small" variant="text" @click="downloadImage(item)" />
          <v-btn
            icon="mdi-code-json"
            size="small"
            variant="text"
            @click="downloadOperationsJson(item)"
          />
          <v-btn icon="mdi-delete" size="small" variant="text" @click="emit('remove', item.id)" />
        </div>
      </template>
    </v-list-item>
  </v-list>
</template>

<style scoped>
.image-list__thumb {
  width: 64px;
  height: 64px;
  margin-right: 12px;
  overflow: hidden;
  border-radius: 4px;
}
</style>
