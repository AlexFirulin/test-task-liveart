import type { Coordinates } from 'vue-advanced-cropper'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { type Adjustments, type FilterName, defaultAdjustments } from '../utils/filters'
import type { OperationsInput } from '../utils/operations'
import { type Transform, defaultTransform } from '../utils/transform'

export interface ImageItem {
  id: string
  file: File
  url: string
  cropCoordinates: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
  transform: Transform
}

export const useImagesStore = defineStore('images', () => {
  const images = ref<ImageItem[]>([])

  function findImage(id: string) {
    return images.value.find((image) => image.id === id)
  }

  function addImage(file: File): string {
    const item: ImageItem = {
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      cropCoordinates: null,
      adjustments: { ...defaultAdjustments },
      filter: null,
      transform: { ...defaultTransform },
    }
    images.value.push(item)
    return item.id
  }

  function removeImage(id: string) {
    const index = images.value.findIndex((image) => image.id === id)
    if (index === -1) return
    URL.revokeObjectURL(images.value[index].url)
    images.value.splice(index, 1)
  }

  function setCrop(id: string, coordinates: Coordinates | null) {
    const item = findImage(id)
    if (item) item.cropCoordinates = coordinates
  }

  function setAdjustments(id: string, adjustments: Adjustments) {
    const item = findImage(id)
    if (item) item.adjustments = adjustments
  }

  function setFilter(id: string, filter: FilterName | null) {
    const item = findImage(id)
    if (item) item.filter = filter
  }

  function setTransform(id: string, transform: Transform) {
    const item = findImage(id)
    if (item) item.transform = transform
  }

  function applyOperations(id: string, input: OperationsInput) {
    const item = findImage(id)
    if (!item) return
    item.transform = input.transform
    item.cropCoordinates = input.crop
    item.adjustments = input.adjustments
    item.filter = input.filter
  }

  function resetEdits(id: string) {
    const item = findImage(id)
    if (!item) return
    item.cropCoordinates = null
    item.adjustments = { ...defaultAdjustments }
    item.filter = null
    item.transform = { ...defaultTransform }
  }

  return {
    images,
    addImage,
    removeImage,
    setCrop,
    setAdjustments,
    setFilter,
    setTransform,
    applyOperations,
    resetEdits,
  }
})
