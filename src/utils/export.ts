import type { ImageItem } from '../stores/images'
import { applyAdjustmentsToPixels, toCssFilter } from './filters'
import { toOperations } from './operations'

let canvasFilterSupported: boolean | null = null

/**
 * Safari < 18 accepts CanvasRenderingContext2D#filter without error but
 * silently ignores it (stays 'none'), so probe it once by round-tripping a
 * distinctive value instead of trusting the assignment to have worked.
 */
function supportsCanvasFilter(): boolean {
  if (canvasFilterSupported !== null) return canvasFilterSupported
  const testCtx = new OffscreenCanvas(1, 1).getContext('2d')
  if (!testCtx) {
    canvasFilterSupported = false
    return canvasFilterSupported
  }
  testCtx.filter = 'blur(4px)'
  canvasFilterSupported = testCtx.filter === 'blur(4px)'
  return canvasFilterSupported
}

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
 * Renders the same operations pipeline used for the live preview (crop as a
 * source-rect, adjustments/filter baked via the identical CSS filter string)
 * onto an OffscreenCanvas. Falls back to manual per-pixel math on browsers
 * where ctx.filter is a no-op, see supportsCanvasFilter above.
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

  const filterSupported = supportsCanvasFilter()
  if (filterSupported) ctx.filter = toCssFilter(item.adjustments, item.filter)
  ctx.drawImage(image, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height)

  if (!filterSupported) {
    const imageData = ctx.getImageData(0, 0, crop.width, crop.height)
    applyAdjustmentsToPixels(imageData.data, item.adjustments, item.filter)
    ctx.putImageData(imageData, 0, 0)
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  triggerDownload(blob, replaceExtension(item.file.name, 'png'))
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
