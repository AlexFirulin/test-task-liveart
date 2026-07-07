<script setup lang="ts">
import type { Coordinates, ImageTransforms } from 'vue-advanced-cropper'
import { computed, nextTick, ref, watch } from 'vue'
import type { Adjustments, FilterName } from '../../types/adjustments'
import type { Transform } from '../../types/transform'
import { defaultAdjustments, toCssFilter } from '../../utils/filters'
import { defaultTransform, normalizeRotation } from '../../utils/transform'
import AdjustmentsPanel from '../Filters/AdjustmentsPanel.vue'
import FilterPanel from '../Filters/FilterPanel.vue'
import ImageCropper from './Cropper.vue'

const props = defineProps<{
  editingId: string | null
  src: string | null
  initialCrop: Coordinates | null
  initialAdjustments: Adjustments
  initialFilter: FilterName | null
  initialTransform: Transform
  isNewUpload: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
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

interface AspectRatioPreset {
  label: string
  value: number | undefined
}

const aspectRatioPresets: AspectRatioPreset[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
]

const cropperRef = ref<InstanceType<typeof ImageCropper> | null>(null)
const draftCrop = ref<Coordinates | null>(null)
const draftAdjustments = ref<Adjustments>({ ...defaultAdjustments })
const draftFilter = ref<FilterName | null>(null)
// The cropper is the source of truth for rotate/flip (it applies them
// natively, see below) — this mirrors its last-reported imageTransforms so
// draftTransform is always a plain readout, and so seeding can compute a
// delta from the cropper's *actual* current state rather than assuming one.
const cropperTransforms = ref<ImageTransforms>({
  rotate: 0,
  flip: { horizontal: false, vertical: false },
})
const draftTransform = ref<Transform>({ ...defaultTransform })
// UI-only: an aspect-ratio preset constrains the crop tool but isn't part of
// the edit model — it never reaches the store, toOperations, or the JSON
// export, only the resulting cropCoordinates do.
const aspectRatioIndex = ref(0)
const aspectRatio = computed(() => aspectRatioPresets[aspectRatioIndex.value].value)
// View-only: held down to peek at the original image. Doesn't touch the
// draft or the store — releasing the button falls straight back to
// draftAdjustments/draftFilter via this same computed.
const isComparing = ref(false)
const filter = computed(() =>
  isComparing.value ? 'none' : toCssFilter(draftAdjustments.value, draftFilter.value),
)

/**
 * The cropper reports crop coordinates and rotate/flip together on every
 * change (drag, resize, or our own rotate()/flip() calls below) — this is
 * the single place draftCrop/draftTransform are ever written from user or
 * programmatic cropper activity.
 */
function onCropperChange(coordinates: Coordinates, transforms: ImageTransforms) {
  draftCrop.value = coordinates
  cropperTransforms.value = transforms
  draftTransform.value = {
    rotate: normalizeRotation(transforms.rotate),
    flipX: transforms.flip.horizontal,
    flipY: transforms.flip.vertical,
  }
}

/**
 * Drives the cropper to a target crop/transform state. rotate()/flip() on
 * vue-advanced-cropper are incremental (rotate adds to the current angle,
 * flip toggles per axis), so this reads the cropper's last-reported state
 * (cropperTransforms, not draftTransform) and applies only the delta needed
 * — correct regardless of whatever the cropper's internal angle happens to
 * be, instead of assuming a zero baseline.
 */
function applyCropperState(targetCrop: Coordinates | null, targetTransform: Transform) {
  const current = cropperTransforms.value
  const rotateDelta = targetTransform.rotate - normalizeRotation(current.rotate)
  if (rotateDelta !== 0) cropperRef.value?.rotate(rotateDelta)

  const needsFlipX = current.flip.horizontal !== targetTransform.flipX
  const needsFlipY = current.flip.vertical !== targetTransform.flipY
  if (needsFlipX || needsFlipY) cropperRef.value?.flip(needsFlipX, needsFlipY)

  draftCrop.value = targetCrop
}

/**
 * Resets the cropper first when there's no saved crop to preserve, then
 * applies the target rotate/flip on top — reset() must be *awaited* before
 * reading cropperTransforms again, since it resets transforms to the
 * cropper's own baseline asynchronously; computing the delta before that
 * settles would race the reset's own onChange and get clobbered by it.
 */
async function restoreCropperState(targetCrop: Coordinates | null, targetTransform: Transform) {
  if (targetCrop === null) await cropperRef.value?.reset()
  applyCropperState(targetCrop, targetTransform)
}

/** The parts of the draft that don't depend on the cropper's async image-load state. */
function seedNonCropperDraft() {
  draftAdjustments.value = { ...props.initialAdjustments }
  draftFilter.value = props.initialFilter
  aspectRatioIndex.value = 0
}

watch(() => props.editingId, seedNonCropperDraft)

/**
 * Fires once per image successfully loaded into the cropper (including the
 * first one) — crucially, *after* the library's own internal transform reset
 * for that image, so cropperTransforms is guaranteed fresh once this resumes
 * (the emit → onChange → onCropperChange chain runs synchronously inside the
 * library's 'ready' emit, ahead of our microtask continuation here).
 */
async function onCropperReady() {
  await nextTick()
  await restoreCropperState(props.initialCrop, props.initialTransform)
}

function rotateDraftLeft() {
  cropperRef.value?.rotate(-90)
}

function rotateDraftRight() {
  cropperRef.value?.rotate(90)
}

function flipDraftX() {
  cropperRef.value?.flip(true, false)
}

function flipDraftY() {
  cropperRef.value?.flip(false, true)
}

function resetDraft() {
  draftAdjustments.value = { ...defaultAdjustments }
  draftFilter.value = null
  aspectRatioIndex.value = 0
  restoreCropperState(null, defaultTransform)
}

function apply() {
  emit('apply', {
    crop: draftCrop.value,
    adjustments: draftAdjustments.value,
    filter: draftFilter.value,
    transform: draftTransform.value,
  })
}

/**
 * Re-seeds the draft from the current initial* props on demand, for callers
 * that changed the *currently active* image's stored data out from under us
 * (e.g. importing operations JSON for the image already open here) — the
 * editingId watcher above only fires on an actual id change, so it can't
 * pick this up by itself.
 */
function reseed() {
  seedNonCropperDraft()
  return restoreCropperState(props.initialCrop, props.initialTransform)
}

defineExpose({ reseed })
</script>

<template>
  <v-card>
    <v-card-text
      v-if="isLoading"
      class="preview-zone preview-zone--placeholder"
    >
      <v-progress-circular indeterminate color="primary" size="48" />
    </v-card-text>
    <template v-else-if="src">
      <v-card-title>Edit image</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="8">
            <v-chip-group v-model="aspectRatioIndex" mandatory class="mb-2">
              <v-chip
                v-for="(preset, index) in aspectRatioPresets"
                :key="preset.label"
                :value="index"
                size="small"
                variant="outlined"
              >
                {{ preset.label }}
              </v-chip>
            </v-chip-group>
            <div class="preview-zone" :style="{ filter }">
              <ImageCropper
                ref="cropperRef"
                :src="src"
                :aspect-ratio="aspectRatio"
                @change="onCropperChange"
                @ready="onCropperReady"
              />
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-subtitle-1 mb-2">Movements</div>
            <div class="d-flex ga-2 mb-4">
              <v-btn icon="mdi-rotate-left" size="small" variant="text" @click="rotateDraftLeft">
                <v-icon icon="mdi-rotate-left" />
                <v-tooltip activator="parent" location="top">Rotate left</v-tooltip>
              </v-btn>
              <v-btn icon="mdi-rotate-right" size="small" variant="text" @click="rotateDraftRight">
                <v-icon icon="mdi-rotate-right" />
                <v-tooltip activator="parent" location="top">Rotate right</v-tooltip>
              </v-btn>
              <v-btn icon="mdi-flip-horizontal" size="small" variant="text" @click="flipDraftX">
                <v-icon icon="mdi-flip-horizontal" />
                <v-tooltip activator="parent" location="top">Flip horizontal</v-tooltip>
              </v-btn>
              <v-btn icon="mdi-flip-vertical" size="small" variant="text" @click="flipDraftY">
                <v-icon icon="mdi-flip-vertical" />
                <v-tooltip activator="parent" location="top">Flip vertical</v-tooltip>
              </v-btn>
              <v-btn
                icon="mdi-eye-outline"
                size="small"
                variant="text"
                @mousedown="isComparing = true"
                @mouseup="isComparing = false"
                @mouseleave="isComparing = false"
                @touchstart.prevent="isComparing = true"
                @touchend="isComparing = false"
              >
                <v-icon icon="mdi-eye-outline" />
                <v-tooltip activator="parent" location="top">Hold to view original</v-tooltip>
              </v-btn>
            </div>
            <div class="text-subtitle-1 mb-2">Adjustments</div>
            <AdjustmentsPanel v-model="draftAdjustments" />
            <v-divider class="my-4" />
            <div class="text-subtitle-1 mb-2">Filters</div>
            <FilterPanel v-model="draftFilter" />
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="resetDraft">Reset</v-btn>
        <v-spacer />
        <v-btn v-if="isNewUpload" variant="text" color="error" @click="emit('cancel')">
          Discard upload
        </v-btn>
        <v-btn v-else variant="text" @click="emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" variant="tonal" @click="apply">Apply</v-btn>
      </v-card-actions>
    </template>
    <v-card-text v-else class="preview-zone preview-zone--placeholder text-medium-emphasis">
      Select an image from the list, or upload a new one
    </v-card-text>
  </v-card>
</template>

<style scoped>
/*
 * A fixed-size box, the same for every image and for the no-image
 * placeholder — width always fills the column, height is a constant
 * clamped range, independent of the active image's own dimensions. A wide
 * image and a square one both get letterboxed/pillarboxed to fit inside it
 * (vue-advanced-cropper scales the image to contain within its container by
 * default) rather than resizing the box itself, so the panel's layout never
 * jumps switching between images of different aspect ratios.
 */
.preview-zone {
  width: 100%;
  height: clamp(360px, 60vh, 640px);
  overflow: hidden;
}

.preview-zone--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
</style>
