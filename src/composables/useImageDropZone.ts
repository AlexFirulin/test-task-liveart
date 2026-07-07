import { ref } from 'vue'

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function splitByImageType(files: File[]): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = []
  const rejected: string[] = []
  for (const file of files) {
    if (file.type.startsWith('image/')) accepted.push(file)
    else rejected.push(file.name)
  }
  return { accepted, rejected }
}

/**
 * Drag-and-drop plumbing shared by the page-wide drop zone (App.vue) and the
 * upload card (Uploader.vue): a dragenter/dragleave depth counter (dragleave
 * fires on every child element, not just on leaving the zone itself, so a
 * naive enter/leave toggle flickers), filtered to real file drags via
 * `dataTransfer.types`, plus image-type filtering shared with the `<input
 * type="file">` change handler. `onFiles` only ever receives accepted
 * image files; rejected names are exposed via `rejectedNames` for callers to
 * surface however they like (e.g. a v-snackbar).
 */
export function useImageDropZone(onFiles: (files: File[]) => void) {
  const isDragOver = ref(false)
  const rejectedNames = ref<string[] | null>(null)
  let dragDepth = 0

  function handleFiles(files: File[]) {
    const { accepted, rejected } = splitByImageType(files)
    if (accepted.length > 0) onFiles(accepted)
    rejectedNames.value = rejected.length > 0 ? rejected : null
  }

  function onDragEnter(event: DragEvent) {
    if (!hasFiles(event)) return
    dragDepth += 1
    isDragOver.value = true
  }

  function onDragOver(event: DragEvent) {
    if (hasFiles(event)) event.preventDefault()
  }

  function onDragLeave(event: DragEvent) {
    if (!hasFiles(event)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) isDragOver.value = false
  }

  function onDrop(event: DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth = 0
    isDragOver.value = false
    handleFiles(Array.from(event.dataTransfer?.files ?? []))
  }

  return { isDragOver, rejectedNames, onDragEnter, onDragOver, onDragLeave, onDrop, handleFiles }
}
