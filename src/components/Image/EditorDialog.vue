<script setup lang="ts">
import type { Coordinates } from 'vue-advanced-cropper'
import { computed, ref, watch } from 'vue'
import {
  type Adjustments,
  type FilterName,
  defaultAdjustments,
  toCssFilter,
} from '../../utils/filters'
import {
  type Transform,
  defaultTransform,
  rotateLeft,
  rotateRight,
  toCssTransform,
} from '../../utils/transform'
import AdjustmentsPanel from '../Filters/AdjustmentsPanel.vue'
import FilterPanel from '../Filters/FilterPanel.vue'
import ImageCropper from './Cropper.vue'

const props = defineProps<{
  modelValue: boolean
  src: string | null
  initialCrop: Coordinates | null
  initialAdjustments: Adjustments
  initialFilter: FilterName | null
  initialTransform: Transform
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  apply: [
    payload: {
      crop: Coordinates | null
      adjustments: Adjustments
      filter: FilterName | null
      transform: Transform
    },
  ]
  cancel: []
}>()

const cropperRef = ref<InstanceType<typeof ImageCropper> | null>(null)
const draftCrop = ref<Coordinates | null>(null)
const draftAdjustments = ref<Adjustments>({ ...defaultAdjustments })
const draftFilter = ref<FilterName | null>(null)
const draftTransform = ref<Transform>({ ...defaultTransform })
const filter = computed(() => toCssFilter(draftAdjustments.value, draftFilter.value))
const cropperTransform = computed(() => toCssTransform(draftTransform.value))

watch(
  () => props.modelValue,
  (isOpen, wasOpen) => {
    if (!isOpen || wasOpen) return
    draftCrop.value = props.initialCrop
    draftAdjustments.value = { ...props.initialAdjustments }
    draftFilter.value = props.initialFilter
    draftTransform.value = { ...props.initialTransform }
    if (props.initialCrop === null) cropperRef.value?.reset()
  },
)

function rotateDraftLeft() {
  draftTransform.value = {
    ...draftTransform.value,
    rotate: rotateLeft(draftTransform.value.rotate),
  }
}

function rotateDraftRight() {
  draftTransform.value = {
    ...draftTransform.value,
    rotate: rotateRight(draftTransform.value.rotate),
  }
}

function flipDraftX() {
  draftTransform.value = { ...draftTransform.value, flipX: !draftTransform.value.flipX }
}

function flipDraftY() {
  draftTransform.value = { ...draftTransform.value, flipY: !draftTransform.value.flipY }
}

function cancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function resetDraft() {
  draftCrop.value = null
  draftAdjustments.value = { ...defaultAdjustments }
  draftFilter.value = null
  draftTransform.value = { ...defaultTransform }
  cropperRef.value?.reset()
}

function apply() {
  emit('apply', {
    crop: draftCrop.value,
    adjustments: draftAdjustments.value,
    filter: draftFilter.value,
    transform: draftTransform.value,
  })
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="720" eager @update:model-value="cancel">
    <v-card>
      <v-card-title>Edit image</v-card-title>
      <v-card-text>
        <div class="d-flex ga-2 mb-2">
          <v-btn icon="mdi-rotate-left" size="small" variant="text" @click="rotateDraftLeft" />
          <v-btn icon="mdi-rotate-right" size="small" variant="text" @click="rotateDraftRight" />
          <v-btn icon="mdi-flip-horizontal" size="small" variant="text" @click="flipDraftX" />
          <v-btn icon="mdi-flip-vertical" size="small" variant="text" @click="flipDraftY" />
        </div>
        <div :style="{ filter, transform: cropperTransform }">
          <ImageCropper ref="cropperRef" :src="src" @change="draftCrop = $event" />
        </div>
        <AdjustmentsPanel v-model="draftAdjustments" class="mt-4" />
        <FilterPanel v-model="draftFilter" class="mt-2" />
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="resetDraft">Reset</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" variant="tonal" @click="apply">Apply</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
