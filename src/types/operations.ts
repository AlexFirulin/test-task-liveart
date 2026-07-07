import type { Adjustments, FilterName } from './adjustments'
import type { Crop } from './crop'
import type { Transform } from './transform'

export interface TransformOperation extends Transform {
  type: 'transform'
}

export interface CropOperation extends Crop {
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
  crop: Crop | null
  adjustments: Adjustments
  filter: FilterName | null
}
