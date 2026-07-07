import { onBeforeUnmount } from 'vue'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/**
 * Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z at the window level, ignored while focus is
 * in a text input (so native undo inside a field isn't hijacked) or while
 * `isActive` says there's nothing to undo/redo against (e.g. no image open).
 */
export function useUndoRedoKeyboard(options: {
  onUndo: () => void
  onRedo: () => void
  isActive?: () => boolean
}): void {
  const isActive = options.isActive ?? (() => true)

  function onKeydown(event: KeyboardEvent): void {
    if (!isActive()) return
    if (isTypingTarget(event.target)) return
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    if (event.shiftKey) {
      options.onRedo()
    } else {
      options.onUndo()
    }
  }

  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
