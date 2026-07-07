import { ref } from 'vue'
import type ImageCropper from '../components/Image/Cropper.vue'
import type { Crop } from '../types/crop'
import type { Transform } from '../types/transform'

/**
 * Owns the ref to <Cropper.vue> and the one thing every caller of it needs
 * but shouldn't have to re-derive: telling apart a change the cropper
 * reports because of real user interaction (drag, resize, a rotate/flip
 * button click) from one it reports because *we* just drove it
 * programmatically (baseline seed, undo/redo, Reset) — both fire the same
 * `change` event, but only the former should ever be treated as a new edit.
 *
 * `onChange`'s third argument carries that distinction; the caller decides
 * what to do with draft state and history, this composable only decides
 * whether the change was user-initiated.
 */
export function useCropperBridge(
  onChange: (crop: Crop, transform: Transform, isUserInitiated: boolean) => void,
) {
  const cropperRef = ref<InstanceType<typeof ImageCropper> | null>(null)
  let isRestoring = false

  function handleChange(crop: Crop, transform: Transform): void {
    onChange(crop, transform, !isRestoring)
  }

  /**
   * Drives the cropper to an absolute target state: resets first when
   * there's no crop to preserve (awaited, since the library resets its own
   * baseline asynchronously), then asks it to reach targetTransform (delta
   * math lives in Cropper.vue#applyTransform, not here). Guarded so the
   * change event(s) this triggers report isUserInitiated: false.
   */
  async function restoreTo(targetCrop: Crop | null, targetTransform: Transform): Promise<void> {
    isRestoring = true
    try {
      if (targetCrop === null) await cropperRef.value?.reset()
      cropperRef.value?.applyTransform(targetTransform)
    } finally {
      isRestoring = false
    }
  }

  function rotate(deltaDegrees: number): void {
    cropperRef.value?.rotate(deltaDegrees)
  }

  function flip(horizontal: boolean, vertical: boolean): void {
    cropperRef.value?.flip(horizontal, vertical)
  }

  return { cropperRef, handleChange, restoreTo, rotate, flip }
}
