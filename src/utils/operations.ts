import type { Coordinates } from 'vue-advanced-cropper'
import { type Adjustments, type FilterName, isNeutralAdjustments } from './filters'
import { type Transform, isNeutralTransform } from './transform'

export interface TransformOperation extends Transform {
  type: 'transform'
}

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

export type Operation = TransformOperation | CropOperation | AdjustOperation | FilterOperation

export interface OperationsInput {
  transform: Transform
  crop: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
}

/**
 * The edit pipeline as data: a fixed, ordered slate of operations
 * (transform -> crop -> adjust -> filter) derived from current params, each
 * included only when it deviates from a no-op. Replaying this array
 * against the original image reproduces the result. Crop coordinates are in
 * the already-transformed image's coordinate space, so transform must run
 * first on replay.
 */
export function toOperations({
  transform,
  crop,
  adjustments,
  filter,
}: OperationsInput): Operation[] {
  const operations: Operation[] = []
  if (!isNeutralTransform(transform)) operations.push({ type: 'transform', ...transform })
  if (crop) operations.push({ type: 'crop', ...crop })
  if (!isNeutralAdjustments(adjustments)) operations.push({ type: 'adjust', ...adjustments })
  if (filter) operations.push({ type: 'filter', name: filter })
  return operations
}
