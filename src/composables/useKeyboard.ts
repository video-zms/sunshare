import { onMounted, onUnmounted } from 'vue'

export interface KeyboardShortcuts {
  onDelete?: () => void
  onUndo?: () => void
  onCopy?: () => void
  onPaste?: (x: number, y: number) => void
  onSelectAll?: () => void
  onEscape?: () => void
  onFitView?: () => void
}

export function useKeyboard(shortcuts: KeyboardShortcuts, getMousePos: () => { x: number, y: number }) {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

    // Delete - Backspace or Delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      shortcuts.onDelete?.()
      return
    }

    // Undo - Ctrl/Cmd + Z
    if (ctrlOrCmd && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      shortcuts.onUndo?.()
      return
    }

    // Copy - Ctrl/Cmd + C
    if (ctrlOrCmd && e.key === 'c') {
      e.preventDefault()
      shortcuts.onCopy?.()
      return
    }

    // Paste - Ctrl/Cmd + V
    if (ctrlOrCmd && e.key === 'v') {
      e.preventDefault()
      const pos = getMousePos()
      shortcuts.onPaste?.(pos.x, pos.y)
      return
    }

    // Select All - Ctrl/Cmd + A
    if (ctrlOrCmd && e.key === 'a') {
      e.preventDefault()
      shortcuts.onSelectAll?.()
      return
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault()
      shortcuts.onEscape?.()
      return
    }

    // Fit View - F key
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      shortcuts.onFitView?.()
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}


