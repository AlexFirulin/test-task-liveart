<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useEditHistory } from '../../composables/useEditHistory'
import type { Adjustments, FilterName } from '../../types/adjustments'
import type { Crop } from '../../types/crop'
import type { OperationsInput } from '../../types/operations'
import type { Transform } from '../../types/transform'
import { debounce } from '../../utils/debounce'
import { defaultAdjustments, toCssFilter } from '../../utils/filters'
import { defaultTransform } from '../../utils/transform'
import AdjustmentsPanel from '../Filters/AdjustmentsPanel.vue'
import FilterPanel from '../Filters/FilterPanel.vue'
import ImageCropper from './Cropper.vue'

// vue-advanced-cropper's crop drag/resize and our own rotate()/flip() calls
// all funnel through the single `change` event with no native "gesture
// ended" signal (unlike v-slider's `end`) — so unlike the adjustments
// sliders, this path needs an actual debounce to collapse a drag into one
// history step instead of pushing on every intermediate frame.
const CROP_HISTORY_DEBOUNCE_MS = 400

const props = defineProps<{
  editingId: string | null
  src: string | null
  initialCrop: Crop | null
  initialAdjustments: Adjustments
  initialFilter: FilterName | null
  initialTransform: Transform
  isNewUpload: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  apply: [
    payload: {
      crop: Crop | null
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
const draftCrop = ref<Crop | null>(null)
const draftAdjustments = ref<Adjustments>({ ...defaultAdjustments })
const draftFilter = ref<FilterName | null>(null)
// The cropper is the source of truth for rotate/flip (it applies them
// natively, see below) — this is always a plain readout of its last-reported
// Transform. The incremental/raw ImageTransforms bookkeeping needed to
// compute rotate/flip deltas lives inside Cropper.vue now (applyTransform),
// not here — EditorPanel only ever deals in our own normalized Transform.
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

const {
  canUndo: canUndoHistory,
  canRedo: canRedoHistory,
  reset: resetHistory,
  pushSnapshot: pushHistorySnapshot,
  undo: popUndo,
  redo: popRedo,
} = useEditHistory<OperationsInput>()

// Set while EditorPanel itself is driving the cropper programmatically
// (seeding the baseline on open/switch, or applying an undo/redo snapshot) —
// those calls fire the same `change` event a real user drag would, and must
// not be mistaken for a new discrete edit worth a history entry.
const isRestoringCropperState = ref(false)

function currentSnapshot(): OperationsInput {
  return {
    transform: draftTransform.value,
    crop: draftCrop.value,
    adjustments: draftAdjustments.value,
    filter: draftFilter.value,
  }
}

function commitHistory(): void {
  pushHistorySnapshot(currentSnapshot())
}

const cropHistoryCommit = debounce(commitHistory, CROP_HISTORY_DEBOUNCE_MS)

onBeforeUnmount(() => {
  cropHistoryCommit.cancel()
})

/**
 * The cropper reports crop and transform together on every change (drag,
 * resize, or our own rotate()/flip() calls below), already normalized to our
 * own Crop/Transform types (see Cropper.vue) — this is the single place
 * draftCrop/draftTransform are ever written from user or programmatic
 * cropper activity.
 */
function onCropperChange(crop: Crop, transform: Transform) {
  draftCrop.value = crop
  draftTransform.value = transform
  // Only a real user interaction (crop drag/resize, or a rotate/flip button
  // click) should ever reach here while unguarded — programmatic restoration
  // always wraps its call in isRestoringCropperState and handles history
  // itself once settled (see restoreCropperStateGuarded below).
  if (!isRestoringCropperState.value) cropHistoryCommit.run()
}

/**
 * Resets the cropper first when there's no saved crop to preserve, then asks
 * it to reach the target Transform — reset() must be *awaited* first since it
 * resets the cropper's rotate/flip to its own baseline asynchronously;
 * applying a transform before that settles would race the reset's own
 * onChange and get clobbered by it. The rotate/flip delta math itself lives
 * in Cropper.vue#applyTransform now, not here.
 */
async function restoreCropperState(targetCrop: Crop | null, targetTransform: Transform) {
  if (targetCrop === null) await cropperRef.value?.reset()
  cropperRef.value?.applyTransform(targetTransform)
  draftCrop.value = targetCrop
}

/**
 * Wraps restoreCropperState with the isRestoringCropperState guard so the
 * change events it triggers don't get mistaken for a user edit, then lets
 * the caller decide what happens to history once the cropper has settled —
 * a fresh baseline (reset), a new undoable step (pushSnapshot), or replaying
 * an undo/redo result (neither — the snapshot IS the history entry already).
 */
async function restoreCropperStateGuarded(
  targetCrop: Crop | null,
  targetTransform: Transform,
): Promise<void> {
  isRestoringCropperState.value = true
  try {
    await restoreCropperState(targetCrop, targetTransform)
  } finally {
    isRestoringCropperState.value = false
  }
}

/** The parts of the draft that don't depend on the cropper's async image-load state. */
function seedNonCropperDraft() {
  draftAdjustments.value = { ...props.initialAdjustments }
  draftFilter.value = props.initialFilter
  aspectRatioIndex.value = 0
}

watch(() => props.editingId, () => {
  cropHistoryCommit.cancel()
  seedNonCropperDraft()
})

/**
 * Fires once per image successfully loaded into the cropper (including the
 * first one) — crucially, *after* the library's own internal transform reset
 * for that image, so cropperTransforms is guaranteed fresh once this resumes
 * (the emit → onChange → onCropperChange chain runs synchronously inside the
 * library's 'ready' emit, ahead of our microtask continuation here).
 */
async function onCropperReady() {
  await nextTick()
  cropHistoryCommit.cancel() // a stale pending commit from the previous image must not land here
  await restoreCropperStateGuarded(props.initialCrop, props.initialTransform)
  resetHistory(currentSnapshot())
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

// Reset is treated as an ordinary discrete edit, not a history wipe: it
// mutates the same four draft slots every other action does, so it needs no
// special-casing to become undoable — Ctrl+Z after an accidental Reset click
// gets you back to what you had, same as every other action here.
async function resetDraft() {
  draftAdjustments.value = { ...defaultAdjustments }
  draftFilter.value = null
  aspectRatioIndex.value = 0
  await restoreCropperStateGuarded(null, defaultTransform)
  commitHistory()
}

function apply() {
  emit('apply', {
    crop: draftCrop.value,
    adjustments: draftAdjustments.value,
    filter: draftFilter.value,
    transform: draftTransform.value,
  })
}

async function applyHistorySnapshot(snapshot: OperationsInput): Promise<void> {
  draftAdjustments.value = snapshot.adjustments
  draftFilter.value = snapshot.filter
  await restoreCropperStateGuarded(snapshot.crop, snapshot.transform)
}

async function handleUndo(): Promise<void> {
  const snapshot = popUndo()
  if (snapshot) await applyHistorySnapshot(snapshot)
}

async function handleRedo(): Promise<void> {
  const snapshot = popRedo()
  if (snapshot) await applyHistorySnapshot(snapshot)
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function onKeydown(event: KeyboardEvent) {
  if (!props.src) return
  if (isTypingTarget(event.target)) return
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
  event.preventDefault()
  if (event.shiftKey) {
    handleRedo()
  } else {
    handleUndo()
  }
}

window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// FilterPanel's chip selection is already a single discrete click per
// change (unlike the sliders, there's no continuous @input stream to
// filter out), so it can commit directly on every update.
function setFilter(value: FilterName | null) {
  draftFilter.value = value
  commitHistory()
}

/**
 * Re-seeds the draft from the current initial* props on demand, for callers
 * that changed the *currently active* image's stored data out from under us
 * (e.g. importing operations JSON for the image already open here) — the
 * editingId watcher above only fires on an actual id change, so it can't
 * pick this up by itself.
 */
// Importing a JSON recipe onto the image currently open in this panel
// (App.vue#importOperations) still happens mid-session — it's one more
// discrete change to the same four slots, so it's pushed as a step rather
// than wiping history: Ctrl+Z after an unwanted import gets you back to
// what was open before it, consistent with how Reset is handled above.
async function reseed() {
  seedNonCropperDraft()
  await restoreCropperStateGuarded(props.initialCrop, props.initialTransform)
  commitHistory()
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
              <v-btn
                icon="mdi-undo"
                size="small"
                variant="text"
                :disabled="!canUndoHistory"
                @click="handleUndo"
              >
                <v-icon icon="mdi-undo" />
                <v-tooltip activator="parent" location="top">Undo (Ctrl/Cmd+Z)</v-tooltip>
              </v-btn>
              <v-btn
                icon="mdi-redo"
                size="small"
                variant="text"
                :disabled="!canRedoHistory"
                @click="handleRedo"
              >
                <v-icon icon="mdi-redo" />
                <v-tooltip activator="parent" location="top">Redo (Ctrl/Cmd+Shift+Z)</v-tooltip>
              </v-btn>
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
            <AdjustmentsPanel
              :model-value="draftAdjustments"
              @update:model-value="draftAdjustments = $event"
              @commit="commitHistory"
            />
            <v-divider class="my-4" />
            <div class="text-subtitle-1 mb-2">Filters</div>
            <FilterPanel :model-value="draftFilter" @update:model-value="setFilter" />
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
