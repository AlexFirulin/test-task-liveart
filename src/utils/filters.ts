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
