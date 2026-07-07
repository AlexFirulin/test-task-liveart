import type { Coordinates } from 'vue-advanced-cropper'
import {
  type Adjustments,
  type FilterName,
  defaultAdjustments,
  isNeutralAdjustments,
} from './filters'
import { type Transform, defaultTransform, isNeutralTransform } from './transform'

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

/**
 * Strict inverse of toOperations: folds a (validated) Operation[] back into
 * the same OperationsInput shape the store, preview, and export all read
 * from. Slots with no corresponding operation fall back to their neutral
 * default — the same "missing = neutral" convention toOperations uses when
 * deciding what to omit — so applying the result reproduces the original
 * params exactly.
 */
export function fromOperations(operations: Operation[]): OperationsInput {
  const input: OperationsInput = {
    transform: { ...defaultTransform },
    crop: null,
    adjustments: { ...defaultAdjustments },
    filter: null,
  }
  for (const operation of operations) {
    switch (operation.type) {
      case 'transform':
        input.transform = {
          rotate: operation.rotate,
          flipX: operation.flipX,
          flipY: operation.flipY,
        }
        break
      case 'crop':
        input.crop = {
          left: operation.left,
          top: operation.top,
          width: operation.width,
          height: operation.height,
        }
        break
      case 'adjust':
        input.adjustments = {
          brightness: operation.brightness,
          contrast: operation.contrast,
          saturation: operation.saturation,
        }
        break
      case 'filter':
        input.filter = operation.name
        break
    }
  }
  return input
}

const FILTER_NAMES: FilterName[] = ['greyscale', 'sepia', 'invert', 'warm', 'cool', 'vintage']
const ROTATION_DEGREES = [0, 90, 180, 270]

function invalid(message: string): never {
  throw new Error(`Invalid operations file: ${message}`)
}

function expectNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(`field "${field}" must be a finite number`)
  }
  return value
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(`field "${field}" must be a boolean`)
  return value
}

function parseOperation(raw: unknown, index: number): Operation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    invalid(`operations[${index}] must be an object`)
  }
  const record = raw as Record<string, unknown>
  const prefix = `operations[${index}]`

  switch (record.type) {
    case 'transform': {
      const rotate = expectNumber(record.rotate, `${prefix}.rotate`)
      if (!ROTATION_DEGREES.includes(rotate)) {
        invalid(`field "${prefix}.rotate" must be one of ${ROTATION_DEGREES.join(', ')}`)
      }
      return {
        type: 'transform',
        rotate: rotate as Transform['rotate'],
        flipX: expectBoolean(record.flipX, `${prefix}.flipX`),
        flipY: expectBoolean(record.flipY, `${prefix}.flipY`),
      }
    }
    case 'crop':
      return {
        type: 'crop',
        left: expectNumber(record.left, `${prefix}.left`),
        top: expectNumber(record.top, `${prefix}.top`),
        width: expectNumber(record.width, `${prefix}.width`),
        height: expectNumber(record.height, `${prefix}.height`),
      }
    case 'adjust':
      return {
        type: 'adjust',
        brightness: expectNumber(record.brightness, `${prefix}.brightness`),
        contrast: expectNumber(record.contrast, `${prefix}.contrast`),
        saturation: expectNumber(record.saturation, `${prefix}.saturation`),
      }
    case 'filter': {
      const name = record.name
      if (typeof name !== 'string' || !FILTER_NAMES.includes(name as FilterName)) {
        invalid(`field "${prefix}.name" must be one of ${FILTER_NAMES.join(', ')}`)
      }
      return { type: 'filter', name: name as FilterName }
    }
    default:
      return invalid(`${prefix} has unknown type "${String(record.type)}"`)
  }
}

function assertNoDuplicateTypes(operations: Operation[]): void {
  const seen = new Set<Operation['type']>()
  for (const operation of operations) {
    if (seen.has(operation.type)) {
      invalid(`duplicate "${operation.type}" operation — each type may appear at most once`)
    }
    seen.add(operation.type)
  }
}

/**
 * Parses and strictly validates a `{ version, operations }` JSON file (the
 * shape downloadOperationsJson writes) into an OperationsInput ready for
 * applyOperations. No silent fallbacks: a missing/wrong-typed field, an
 * unknown operation type, or an unsupported version throws with a specific
 * message instead of substituting a default. As a final check, re-deriving
 * operations from the parsed input via toOperations must reproduce the same
 * array — catching out-of-order operations or redundant neutral entries that
 * would otherwise silently fail to round-trip.
 */
export function parseOperationsFile(json: string): OperationsInput {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    invalid('not valid JSON')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    invalid('root value must be an object')
  }
  const file = parsed as Record<string, unknown>

  if (file.version !== 1) {
    invalid(`unsupported version "${String(file.version)}", expected 1`)
  }
  if (!Array.isArray(file.operations)) {
    invalid('field "operations" must be an array')
  }

  const operations = file.operations.map((raw, index) => parseOperation(raw, index))
  assertNoDuplicateTypes(operations)

  const input = fromOperations(operations)
  if (JSON.stringify(toOperations(input)) !== JSON.stringify(operations)) {
    invalid('operations are not in canonical order, or contain redundant no-op entries')
  }

  return input
}
