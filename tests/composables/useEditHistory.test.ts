import { describe, expect, it } from 'vitest'
import { useEditHistory } from '../../src/composables/useEditHistory'

describe('useEditHistory', () => {
  it('reset() seeds a baseline with nothing to undo or redo', () => {
    const history = useEditHistory<number>()
    history.reset(0)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('push/undo/redo basic sequence', () => {
    const history = useEditHistory<number>()
    history.reset(0)
    history.pushSnapshot(1)
    history.pushSnapshot(2)
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    expect(history.undo()).toBe(1)
    expect(history.canRedo.value).toBe(true)
    expect(history.undo()).toBe(0)
    expect(history.canUndo.value).toBe(false)

    expect(history.redo()).toBe(1)
    expect(history.redo()).toBe(2)
    expect(history.canRedo.value).toBe(false)
  })

  it('undo at the bottom of the stack is a no-op', () => {
    const history = useEditHistory<number>()
    history.reset(0)
    history.pushSnapshot(1)

    history.undo() // back to 0, canUndo now false
    expect(history.canUndo.value).toBe(false)
    expect(history.undo()).toBeUndefined()
    expect(history.canUndo.value).toBe(false)
  })

  it('redo at the top of the stack is a no-op', () => {
    const history = useEditHistory<number>()
    history.reset(0)
    history.pushSnapshot(1)

    expect(history.redo()).toBeUndefined()
    expect(history.canRedo.value).toBe(false)
  })

  it('pushing a new snapshot after undo clears the redo tail', () => {
    const history = useEditHistory<number>()
    history.reset(0)
    history.pushSnapshot(1)
    history.pushSnapshot(2)

    history.undo() // current is 1, redo(2) available
    expect(history.canRedo.value).toBe(true)

    history.pushSnapshot(99) // a new edit branches off — 2 is no longer reachable
    expect(history.canRedo.value).toBe(false)
    expect(history.undo()).toBe(1)
    expect(history.undo()).toBe(0)
  })

  it('reset() starts a fresh session that does not carry over a previous one (e.g. switching images)', () => {
    const history = useEditHistory<string>()

    history.reset('image-a-baseline')
    history.pushSnapshot('image-a-edit-1')
    history.pushSnapshot('image-a-edit-2')

    // Simulates switching to a different ImageItem — EditorPanel.vue calls
    // reset() on every editingId change, so a different image's session
    // never sees the previous image's stack.
    history.reset('image-b-baseline')
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)

    history.pushSnapshot('image-b-edit-1')
    expect(history.undo()).toBe('image-b-baseline')
    expect(history.canUndo.value).toBe(false)
    // image-a's edits are gone, not reachable via undo/redo from this session
    expect(history.canRedo.value).toBe(true)
    expect(history.redo()).toBe('image-b-edit-1')
  })

  it('caps the stack at MAX_HISTORY_STEPS, dropping the oldest entry', () => {
    const history = useEditHistory<number>()
    history.reset(0)
    for (let i = 1; i <= 60; i++) {
      history.pushSnapshot(i)
    }
    // Only the 50 most recent snapshots (including the baseline-turned-old
    // entries that got pushed out) are kept; walk all the way back.
    let last = -1
    while (history.canUndo.value) {
      last = history.undo() ?? last
    }
    // The oldest reachable value is not 0 anymore — it got capped away.
    expect(last).toBeGreaterThan(0)
  })

  it('simulates a debounced slider drag: one pushSnapshot call for an entire gesture, not one per intermediate value', () => {
    // The live-preview @input stream (modelValue changing on every tick of a
    // drag) never calls pushSnapshot directly in EditorPanel.vue — only the
    // v-slider `end` event does, once, with the final value. This test
    // exercises that same contract at the composable level: many
    // intermediate values are represented by exactly one pushSnapshot call.
    const history = useEditHistory<{ brightness: number }>()
    history.reset({ brightness: 100 })

    const liveDragValues = [101, 105, 110, 118, 120] // @input ticks, not pushed
    let latest = { brightness: 100 }
    for (const brightness of liveDragValues) {
      latest = { brightness } // simulates live-preview state, no history push
    }
    history.pushSnapshot(latest) // simulates the single `end` event

    expect(history.canUndo.value).toBe(true)
    expect(history.undo()).toEqual({ brightness: 100 })
    expect(history.canUndo.value).toBe(false) // exactly one step was recorded
  })
})
