import { ref, computed } from 'vue'
import type { SmartSequenceItem } from '../types'

/**
 * 智能多帧序列管理 Composable
 * 负责管理帧列表、拖拽排序、转场编辑、生成状态等核心逻辑
 */
export function useSmartSequence() {
  // --- 帧列表状态 ---
  const frames = ref<SmartSequenceItem[]>([])
  const maxFrames = 10

  // --- 拖拽状态 ---
  const draggingIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)
  const hoverIndex = ref<number | null>(null)

  // --- 播放状态 ---
  const isPlaying = ref(false)
  const isExpanded = ref(false)

  // --- 生成状态 ---
  const isGenerating = ref(false)
  const resultVideoUrl = ref<string | null>(null)

  // --- 转场编辑状态 ---
  const editingTransitionId = ref<string | null>(null)
  const tempPrompt = ref('')
  const tempDuration = ref(3)

  // --- 计算属性 ---
  const totalDuration = computed(() => {
    return frames.value.reduce((acc, f, i) => {
      return i < frames.value.length - 1 ? acc + f.transition.duration : acc
    }, 0)
  })

  const canGenerate = computed(() => {
    return frames.value.length >= 2 && !isGenerating.value
  })

  const hasFrames = computed(() => frames.value.length > 0)

  // --- 帧操作方法 ---
  const addFrame = (src: string) => {
    if (frames.value.length >= maxFrames) return false

    const newFrame: SmartSequenceItem = {
      id: `seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      src,
      transition: { duration: 3, prompt: '' }
    }
    frames.value.push(newFrame)
    return true
  }

  const addFrames = (sources: string[]) => {
    const remaining = maxFrames - frames.value.length
    const toAdd = sources.slice(0, remaining)
    
    toAdd.forEach(src => addFrame(src))
    return toAdd.length
  }

  const removeFrame = (id: string) => {
    frames.value = frames.value.filter(f => f.id !== id)
  }

  const clearFrames = () => {
    frames.value = []
    resultVideoUrl.value = null
    isPlaying.value = false
  }

  const reorderFrames = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    const newFrames = [...frames.value]
    const [moved] = newFrames.splice(fromIndex, 1)
    newFrames.splice(toIndex, 0, moved)
    frames.value = newFrames
  }

  // --- 拖拽方法 ---
  const startDrag = (index: number) => {
    draggingIndex.value = index
  }

  const updateDragOver = (index: number) => {
    if (draggingIndex.value === null) return
    if (draggingIndex.value !== index) {
      dragOverIndex.value = index
      // 实时交换实现"弹性"拖拽效果
      reorderFrames(draggingIndex.value, index)
      draggingIndex.value = index
    }
  }

  const endDrag = () => {
    draggingIndex.value = null
    dragOverIndex.value = null
  }

  const setHoverIndex = (index: number | null) => {
    hoverIndex.value = index
  }

  // --- 转场编辑方法 ---
  const openTransitionEditor = (id: string) => {
    if (editingTransitionId.value === id) {
      saveTransition()
      return
    }

    // 先保存之前的编辑
    if (editingTransitionId.value) {
      saveTransition()
    }

    const frame = frames.value.find(f => f.id === id)
    if (frame) {
      editingTransitionId.value = id
      tempPrompt.value = frame.transition.prompt
      tempDuration.value = frame.transition.duration
    }
  }

  const saveTransition = () => {
    if (!editingTransitionId.value) return

    frames.value = frames.value.map(f => {
      if (f.id === editingTransitionId.value) {
        return {
          ...f,
          transition: {
            prompt: tempPrompt.value,
            duration: tempDuration.value
          }
        }
      }
      return f
    })

    editingTransitionId.value = null
    tempPrompt.value = ''
    tempDuration.value = 3
  }

  const cancelTransitionEdit = () => {
    editingTransitionId.value = null
    tempPrompt.value = ''
    tempDuration.value = 3
  }

  const updateTempPrompt = (value: string) => {
    tempPrompt.value = value
  }

  const updateTempDuration = (value: number) => {
    tempDuration.value = value
  }

  // --- 播放控制方法 ---
  const togglePlay = () => {
    isPlaying.value = !isPlaying.value
  }

  const setPlaying = (value: boolean) => {
    isPlaying.value = value
  }

  const toggleExpanded = () => {
    isExpanded.value = !isExpanded.value
  }

  const setExpanded = (value: boolean) => {
    isExpanded.value = value
  }

  // --- 生成方法 ---
  const startGeneration = () => {
    if (!canGenerate.value) return false
    isGenerating.value = true
    resultVideoUrl.value = null
    isPlaying.value = false
    return true
  }

  const completeGeneration = (url: string) => {
    resultVideoUrl.value = url
    isGenerating.value = false
  }

  const failGeneration = () => {
    isGenerating.value = false
  }

  // --- 文件处理方法 ---
  const handleFileDrop = (files: FileList | File[]): Promise<SmartSequenceItem[]> => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    
    return Promise.all(
      imageFiles.map(file => new Promise<SmartSequenceItem>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          resolve({
            id: `seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            src: ev.target?.result as string,
            transition: { duration: 3, prompt: '' }
          })
        }
        reader.readAsDataURL(file)
      }))
    )
  }

  const processDroppedFiles = async (files: FileList | File[]) => {
    const newItems = await handleFileDrop(files)
    const remaining = maxFrames - frames.value.length
    const toAdd = newItems.slice(0, remaining)
    frames.value = [...frames.value, ...toAdd]
    return toAdd.length
  }

  // --- 获取当前预览帧 ---
  const getCurrentPreviewSrc = computed(() => {
    if (hoverIndex.value !== null && frames.value[hoverIndex.value]) {
      return frames.value[hoverIndex.value].src
    }
    return frames.value[0]?.src || null
  })

  return {
    // 状态
    frames,
    maxFrames,
    draggingIndex,
    dragOverIndex,
    hoverIndex,
    isPlaying,
    isExpanded,
    isGenerating,
    resultVideoUrl,
    editingTransitionId,
    tempPrompt,
    tempDuration,

    // 计算属性
    totalDuration,
    canGenerate,
    hasFrames,
    getCurrentPreviewSrc,

    // 帧操作
    addFrame,
    addFrames,
    removeFrame,
    clearFrames,
    reorderFrames,

    // 拖拽
    startDrag,
    updateDragOver,
    endDrag,
    setHoverIndex,

    // 转场编辑
    openTransitionEditor,
    saveTransition,
    cancelTransitionEdit,
    updateTempPrompt,
    updateTempDuration,

    // 播放控制
    togglePlay,
    setPlaying,
    toggleExpanded,
    setExpanded,

    // 生成
    startGeneration,
    completeGeneration,
    failGeneration,

    // 文件处理
    handleFileDrop,
    processDroppedFiles
  }
}

export type UseSmartSequenceReturn = ReturnType<typeof useSmartSequence>

