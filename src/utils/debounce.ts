/**
 * Coalesces rapid calls into a single trailing invocation `delayMs` after the
 * last call — used where a discrete "gesture ended" event doesn't exist (see
 * EditorPanel.vue's crop/rotate/flip history commit, which has no native
 * drag-release signal to hook, unlike v-slider's `end` event).
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): { run: (...args: Args) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    run(...args: Args) {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        fn(...args)
      }, delayMs)
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
