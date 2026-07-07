export interface Adjustments {
  brightness: number
  contrast: number
  saturation: number
}

export const defaultAdjustments: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
}

export function isNeutralAdjustments(adjustments: Adjustments): boolean {
  return (
    adjustments.brightness === defaultAdjustments.brightness &&
    adjustments.contrast === defaultAdjustments.contrast &&
    adjustments.saturation === defaultAdjustments.saturation
  )
}

export type FilterName = 'greyscale' | 'sepia'

export function toCssFilter(adjustments: Adjustments, filter: FilterName | null = null): string {
  const parts = [
    `brightness(${adjustments.brightness}%)`,
    `contrast(${adjustments.contrast}%)`,
    `saturate(${adjustments.saturation}%)`,
  ]
  if (filter === 'greyscale') parts.push('grayscale(1)')
  if (filter === 'sepia') parts.push('sepia(1)')
  return parts.join(' ')
}

function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value))
}

/**
 * Pixel-space fallback for browsers where CanvasRenderingContext2D#filter is a
 * no-op (e.g. Safari < 18), applied in the same order as toCssFilter
 * (brightness -> contrast -> saturate -> grayscale/sepia) using the matrices
 * from the CSS Filter Effects spec (https://www.w3.org/TR/filter-effects-1/#FilterPrimitiveRepresentation),
 * so the exported pixels match the CSS-filtered preview.
 */
export function applyAdjustmentsToPixels(
  data: Uint8ClampedArray,
  adjustments: Adjustments,
  filter: FilterName | null,
): void {
  const brightness = adjustments.brightness / 100
  const contrast = adjustments.contrast / 100
  const saturation = adjustments.saturation / 100
  const contrastIntercept = (0.5 - 0.5 * contrast) * 255

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * brightness
    let g = data[i + 1] * brightness
    let b = data[i + 2] * brightness

    r = contrast * r + contrastIntercept
    g = contrast * g + contrastIntercept
    b = contrast * b + contrastIntercept

    const sr = r
    const sg = g
    const sb = b
    r =
      (0.213 + 0.787 * saturation) * sr +
      (0.715 - 0.715 * saturation) * sg +
      (0.072 - 0.072 * saturation) * sb
    g =
      (0.213 - 0.213 * saturation) * sr +
      (0.715 + 0.285 * saturation) * sg +
      (0.072 - 0.072 * saturation) * sb
    b =
      (0.213 - 0.213 * saturation) * sr +
      (0.715 - 0.715 * saturation) * sg +
      (0.072 + 0.928 * saturation) * sb

    if (filter === 'greyscale') {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = gray
      g = gray
      b = gray
    } else if (filter === 'sepia') {
      const sr2 = r
      const sg2 = g
      const sb2 = b
      r = 0.393 * sr2 + 0.769 * sg2 + 0.189 * sb2
      g = 0.349 * sr2 + 0.686 * sg2 + 0.168 * sb2
      b = 0.272 * sr2 + 0.534 * sg2 + 0.131 * sb2
    }

    data[i] = clamp255(r)
    data[i + 1] = clamp255(g)
    data[i + 2] = clamp255(b)
  }
}
