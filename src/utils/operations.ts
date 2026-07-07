import type { Coordinates } from 'vue-advanced-cropper'
import { type Adjustments, type FilterName, isNeutralAdjustments } from './filters'

export interface CropOperation extends Coordinates {
  type: 'crop'
}

export interface AdjustOperation extends Adjustments {
  type: 'adjust'
}

export interface FilterOperation {
  type: 'filter'
  name: FilterName
}

export type Operation = CropOperation | AdjustOperation | FilterOperation

export interface OperationsInput {
  crop: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
}

/**
 * The edit pipeline as data: a fixed, ordered slate of operations
 * (crop -> adjust -> filter) derived from current params, each
 * included only when it deviates from a no-op. Replaying this array
 * against the original image reproduces the result.
 */
export function toOperations({ crop, adjustments, filter }: OperationsInput): Operation[] {
  const operations: Operation[] = []
  if (crop) operations.push({ type: 'crop', ...crop })
  if (!isNeutralAdjustments(adjustments)) operations.push({ type: 'adjust', ...adjustments })
  if (filter) operations.push({ type: 'filter', name: filter })
  return operations
}
