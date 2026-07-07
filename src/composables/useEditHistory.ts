import { computed, ref, shallowRef } from 'vue'

// Snapshots here are tiny (a handful of numbers/strings/booleans — the same
// shape as OperationsInput, already proven small enough to be a JSON export),
// so capping at a generous step count costs nothing; it only exists so an
// unbounded editing session can't grow the stack forever.
const MAX_HISTORY_STEPS = 50

/**
 * A generic index-into-array undo/redo stack. `stack[index]` is always the
 * "current" snapshot from the caller's point of view; undo/redo just move
 * `index` and hand back the snapshot at the new position for the caller to
 * apply. The composable never inspects or mutates snapshot contents — it's
 * intentionally domain-agnostic, same spirit as useImageDropZone holding no
 * store knowledge.
 */
export function useEditHistory<T>() {
  // shallowRef: the array is always replaced wholesale (never mutated
  // in-place beyond that), and snapshots are opaque, arbitrary-shaped
  // caller data — no need for (and, for a generic T, no way to type) Vue's
  // deep-unwrap reactivity below the array itself.
  const stack = shallowRef<T[]>([])
  const index = ref(-1)

  const canUndo = computed(() => index.value > 0)
  const canRedo = computed(() => index.value >= 0 && index.value < stack.value.length - 1)

  function reset(baseline: T): void {
    stack.value = [baseline]
    index.value = 0
  }

  function pushSnapshot(snapshot: T): void {
    // Drop any redo tail — a new edit branches off from here, same as every
    // other undo/redo implementation (browser history, editors, etc.).
    stack.value = stack.value.slice(0, index.value + 1)
    stack.value.push(snapshot)
    index.value += 1
    if (stack.value.length > MAX_HISTORY_STEPS) {
      stack.value.shift()
      index.value -= 1
    }
  }

  function undo(): T | undefined {
    if (index.value <= 0) return undefined
    index.value -= 1
    return stack.value[index.value]
  }

  function redo(): T | undefined {
    if (index.value < 0 || index.value >= stack.value.length - 1) return undefined
    index.value += 1
    return stack.value[index.value]
  }

  return { canUndo, canRedo, reset, pushSnapshot, undo, redo }
}
