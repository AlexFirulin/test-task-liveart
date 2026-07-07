import type { ImageItem } from '../stores/images'
import { toCssFilter } from './filters'
import { toOperations } from './operations'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Renders the same operations pipeline used for the live preview
 * (crop as a source-rect, adjustments/filter baked via ctx.filter using
 * the identical CSS filter string) onto an OffscreenCanvas, so exported
 * pixels always match what was previewed.
 */
export async function downloadImage(item: ImageItem): Promise<void> {
  const image = new Image()
  image.src = item.url
  await image.decode()

  const crop = item.cropCoordinates ?? {
    left: 0,
    top: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }

  const canvas = new OffscreenCanvas(crop.width, crop.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.filter = toCssFilter(item.adjustments, item.filter)
  ctx.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height)

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  triggerDownload(blob, item.file.name)
}

export function downloadOperationsJson(item: ImageItem): void {
  const payload = {
    version: 1,
    operations: toOperations({
      crop: item.cropCoordinates,
      adjustments: item.adjustments,
      filter: item.filter,
    }),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${item.file.name}.operations.json`)
}
