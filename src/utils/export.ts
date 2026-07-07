import type { ImageItem } from '../stores/images'
import { toOperations } from './operations'
import { drawPipeline } from './render'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function replaceExtension(name: string, ext: string): string {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  return `${base}.${ext}`
}

/**
 * Renders the same operations pipeline used for the live preview (transform,
 * crop as a source-rect, adjustments/filter baked via the identical CSS
 * filter string) via drawPipeline onto an OffscreenCanvas, so exported pixels
 * always match what was previewed.
 */
export async function downloadImage(item: ImageItem): Promise<void> {
  const image = new Image()
  image.src = item.url
  await image.decode()

  const canvas = new OffscreenCanvas(1, 1)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  drawPipeline(ctx, image, {
    cropCoordinates: item.cropCoordinates,
    adjustments: item.adjustments,
    filter: item.filter,
    transform: item.transform,
  })

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  triggerDownload(blob, replaceExtension(item.file.name, 'png'))
}

export function downloadOperationsJson(item: ImageItem): void {
  const payload = {
    version: 1,
    operations: toOperations({
      transform: item.transform,
      crop: item.cropCoordinates,
      adjustments: item.adjustments,
      filter: item.filter,
    }),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${item.file.name}.operations.json`)
}
