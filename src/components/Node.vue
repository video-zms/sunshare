<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Type, Image as ImageIcon, Video as VideoIcon, FileSearch, Edit, Mic2,
  Loader2, Plus, Download, Maximize2, Copy, Wand2, Scaling, Monitor,
  Layers, ChevronDown, AlertCircle, Play, Pause, Upload, X, BookOpen, Film, Sparkles
} from 'lucide-vue-next'
import { NodeType, NodeStatus, type AppNode, type InputAsset, type VideoGenerationMode } from '../types'

// Props
interface Props {
  node: AppNode
  isSelected?: boolean
  isDragging?: boolean
  isResizing?: boolean
  isConnecting?: boolean
  isGroupDragging?: boolean
  inputAssets?: InputAsset[]
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isDragging: false,
  isResizing: false,
  isConnecting: false,
  isGroupDragging: false,
  inputAssets: () => []
})

// Emits
const emit = defineEmits<{
  update: [id: string, data: Partial<AppNode['data']>, size?: { width?: number; height?: number }, title?: string]
  action: [id: string, prompt?: string]
  delete: [id: string]
  expand: [data: { type: 'image' | 'video'; src: string; images?: string[]; initialIndex?: number }]
  crop: [id: string, imageBase64: string]
  nodeMouseDown: [e: MouseEvent, id: string]
  portMouseDown: [e: MouseEvent, id: string, type: 'input' | 'output']
  portMouseUp: [e: MouseEvent, id: string, type: 'input' | 'output']
  nodeContextMenu: [e: MouseEvent, id: string]
  resizeMouseDown: [e: MouseEvent, id: string, width: number, height: number]
  inputReorder: [nodeId: string, newOrder: string[]]
  generateStoryShots: [id: string]
}>()

// Constants
const DEFAULT_NODE_WIDTH = 420
const DEFAULT_FIXED_HEIGHT = 360
const AUDIO_NODE_HEIGHT = 200
const STORY_NODE_HEIGHT = 400
const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']
const IMAGE_RESOLUTIONS = ['1k', '2k', '4k']
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p']
const IMAGE_COUNTS = [1, 2, 3, 4]
const VIDEO_COUNTS = [1, 2, 3, 4]
const STORY_GENRES = ['悬疑', '爱情', '喜剧', '科幻', '奇幻', '恐怖', '励志', '都市', '古风', '治愈']

// State
const isHovered = ref(false)
const isInputFocused = ref(false)
const isEditingTitle = ref(false)
const tempTitle = ref(props.node.title)
const localPrompt = ref(props.node.data.prompt || '')
const inputHeight = ref(48)
const showImageGrid = ref(false)
const isPlayingAudio = ref(false)
const videoBlobUrl = ref<string | null>(null)
const isLoadingVideo = ref(false)

// Refs
const mediaRef = ref<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Computed
const isWorking = computed(() => props.node.status === NodeStatus.WORKING)
const generationMode = computed(() => props.node.data.generationMode || 'DEFAULT')
const nodeWidth = computed(() => props.node.width || DEFAULT_NODE_WIDTH)
const hasInputs = computed(() => props.inputAssets && props.inputAssets.length > 0)

const nodeHeight = computed(() => {
  if (props.node.height) return props.node.height
  if ([NodeType.VIDEO_ANALYZER, NodeType.IMAGE_EDITOR, NodeType.PROMPT_INPUT].includes(props.node.type)) {
    return DEFAULT_FIXED_HEIGHT
  }
  if (props.node.type === NodeType.AUDIO_GENERATOR) return AUDIO_NODE_HEIGHT
  if (props.node.type === NodeType.STORY_GENERATOR) return STORY_NODE_HEIGHT
  const ratio = props.node.data.aspectRatio || '16:9'
  const [w, h] = ratio.split(':').map(Number)
  const extra = (props.node.type === NodeType.VIDEO_GENERATOR && generationMode.value === 'CUT') ? 36 : 0
  return ((nodeWidth.value * h) / w) + extra
})

const nodeConfig = computed(() => {
  switch (props.node.type) {
    case NodeType.PROMPT_INPUT:
      return { icon: Type, color: 'text-amber-400', border: 'border-amber-500/30' }
    case NodeType.IMAGE_GENERATOR:
      return { icon: ImageIcon, color: 'text-cyan-400', border: 'border-cyan-500/30' }
    case NodeType.VIDEO_GENERATOR:
      return { icon: VideoIcon, color: 'text-purple-400', border: 'border-purple-500/30' }
    case NodeType.AUDIO_GENERATOR:
      return { icon: Mic2, color: 'text-pink-400', border: 'border-pink-500/30' }
    case NodeType.VIDEO_ANALYZER:
      return { icon: FileSearch, color: 'text-emerald-400', border: 'border-emerald-500/30' }
    case NodeType.IMAGE_EDITOR:
      return { icon: Edit, color: 'text-rose-400', border: 'border-rose-500/30' }
    case NodeType.STORY_GENERATOR:
      return { icon: BookOpen, color: 'text-orange-400', border: 'border-orange-500/30' }
    default:
      return { icon: Type, color: 'text-slate-400', border: 'border-white/10' }
  }
})

const models = computed(() => {
  if (props.node.type === NodeType.VIDEO_GENERATOR) {
    return [
      { l: 'Veo 极速版 (Fast)', v: 'veo-3.1-fast-generate-preview' },
      { l: 'Veo 专业版 (Pro)', v: 'veo-3.1-generate-preview' },
      { l: 'Wan 2.1 (Animate)', v: 'wan-2.1-t2v-14b' }
    ]
  } else if (props.node.type === NodeType.VIDEO_ANALYZER) {
    return [
      { l: 'Gemini 2.5 Flash', v: 'gemini-2.5-flash' },
      { l: 'Gemini 3 Pro', v: 'gemini-3-pro-preview' }
    ]
  } else if (props.node.type === NodeType.AUDIO_GENERATOR) {
    return [{ l: 'Voice Factory (Gemini 2.0)', v: 'gemini-2.5-flash-preview-tts' }]
  } else if (props.node.type === NodeType.STORY_GENERATOR) {
    return [
      { l: 'Gemini 2.5 Flash', v: 'gemini-2.5-flash' },
      { l: 'Gemini 3 Pro', v: 'gemini-3-pro-preview' }
    ]
  } else {
    return [
      { l: 'Gemini 2.5', v: 'gemini-2.5-flash-image' },
      { l: 'Gemini 3 Pro', v: 'gemini-3-pro-image-preview' }
    ]
  }
})

const isBottomPanelOpen = computed(() => isHovered.value || isInputFocused.value)
const isInteracting = computed(() => props.isDragging || props.isResizing || props.isGroupDragging)
const showTopBar = computed(() => props.isSelected || isHovered.value)

// Watch
watch(() => props.node.data.prompt, (newPrompt) => {
  localPrompt.value = newPrompt || ''
})

watch(() => props.node.title, (newTitle) => {
  tempTitle.value = newTitle
})

// Video blob URL handling
watch(() => props.node.data.videoUri, async (newUri) => {
  if (videoBlobUrl.value) {
    URL.revokeObjectURL(videoBlobUrl.value)
    videoBlobUrl.value = null
  }

  if (!newUri) return

  if (newUri.startsWith('data:') || newUri.startsWith('blob:')) {
    videoBlobUrl.value = newUri
    return
  }

  isLoadingVideo.value = true
  try {
    const response = await fetch(newUri)
    const blob = await response.blob()
    const mp4Blob = new Blob([blob], { type: 'video/mp4' })
    videoBlobUrl.value = URL.createObjectURL(mp4Blob)
  } catch (err) {
    console.error('Video load error:', err)
  } finally {
    isLoadingVideo.value = false
  }
}, { immediate: true })

// Methods
const commitPrompt = () => {
  if (localPrompt.value !== (props.node.data.prompt || '')) {
    emit('update', props.node.id, { prompt: localPrompt.value })
  }
}

const handleActionClick = () => {
  commitPrompt()
  emit('action', props.node.id, localPrompt.value)
}

const handleCmdEnter = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    commitPrompt()
    emit('action', props.node.id, localPrompt.value)
  }
}

const handleTitleSave = () => {
  isEditingTitle.value = false
  if (tempTitle.value.trim() && tempTitle.value !== props.node.title) {
    emit('update', props.node.id, {}, undefined, tempTitle.value)
  } else {
    tempTitle.value = props.node.title
  }
}

const handleAspectRatioSelect = (newRatio: string) => {
  const [w, h] = newRatio.split(':').map(Number)
  let newSize: { width?: number; height?: number } = { height: undefined }
  if (w && h) {
    const currentWidth = nodeWidth.value
    const projectedHeight = (currentWidth * h) / w
    if (projectedHeight > 600) newSize.width = (600 * w) / h
  }
  emit('update', props.node.id, { aspectRatio: newRatio }, newSize)
}

const handleExpand = (e: MouseEvent) => {
  e.stopPropagation()
  if (props.node.type.includes('IMAGE') && props.node.data.image) {
    emit('expand', {
      type: 'image',
      src: props.node.data.image,
      images: props.node.data.images || [props.node.data.image],
      initialIndex: (props.node.data.images || [props.node.data.image]).indexOf(props.node.data.image)
    })
  } else if (props.node.type.includes('VIDEO') && props.node.data.videoUri) {
    const src = props.node.data.videoUri
    const videos = props.node.data.videoUris?.length ? props.node.data.videoUris : [src]
    const currentIndex = props.node.data.videoUris?.indexOf(props.node.data.videoUri) ?? 0
    emit('expand', {
      type: 'video',
      src: src,
      images: videos,
      initialIndex: Math.max(0, currentIndex)
    })
  }
}

const handleDownload = (e: MouseEvent) => {
  e.stopPropagation()
  const a = document.createElement('a')
  a.href = props.node.data.image || videoBlobUrl.value || props.node.data.audioUri || ''
  a.download = `sunstudio-${Date.now()}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const handleUploadVideo = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => emit('update', props.node.id, { videoUri: e.target?.result as string })
    reader.readAsDataURL(file)
  }
}

const handleUploadImage = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => emit('update', props.node.id, { image: e.target?.result as string })
    reader.readAsDataURL(file)
  }
}

const handleMouseEnter = () => {
  isHovered.value = true
  if ((props.node.data.images?.length ?? 0) > 1 || (props.node.data.videoUris?.length ?? 0) > 1) {
    showImageGrid.value = true
  }
  // Play video on hover
  if (mediaRef.value instanceof HTMLVideoElement) {
    mediaRef.value.play().catch(() => {})
  }
}

const handleMouseLeave = () => {
  isHovered.value = false
  showImageGrid.value = false
  // Pause video on leave
  if (mediaRef.value instanceof HTMLVideoElement) {
    mediaRef.value.pause()
    mediaRef.value.currentTime = 0
  }
}

const toggleAudio = (e: MouseEvent) => {
  e.stopPropagation()
  const audio = mediaRef.value as HTMLAudioElement
  if (!audio) return
  if (audio.paused) {
    audio.play()
    isPlayingAudio.value = true
  } else {
    audio.pause()
    isPlayingAudio.value = false
  }
}

const handleInputResizeStart = (e: MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
  const startY = e.clientY
  const startHeight = inputHeight.value

  const handleMove = (e: MouseEvent) => {
    inputHeight.value = Math.max(48, Math.min(startHeight + (e.clientY - startY), 300))
  }

  const handleUp = () => {
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
  }

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleUp)
}

// Cleanup
onUnmounted(() => {
  if (videoBlobUrl.value && !videoBlobUrl.value.startsWith('data:')) {
    URL.revokeObjectURL(videoBlobUrl.value)
  }
  if (mediaRef.value && (mediaRef.value instanceof HTMLVideoElement || mediaRef.value instanceof HTMLAudioElement)) {
    try {
      mediaRef.value.pause()
      mediaRef.value.src = ''
      mediaRef.value.load()
    } catch (e) {}
  }
})
</script>

<template>
  <div
    :class="[
      'absolute rounded-[24px] group',
      isSelected ? 'ring-1 ring-cyan-500/50 shadow-[0_0_40px_-10px_rgba(34,211,238,0.3)] z-30' : 'ring-1 ring-white/10 hover:ring-white/20 z-10'
    ]"
    :style="{
      left: node.x + 'px',
      top: node.y + 'px',
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
      background: isSelected ? 'rgba(28, 28, 30, 0.85)' : 'rgba(28, 28, 30, 0.6)',
      transition: isInteracting ? 'none' : 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
      backdropFilter: isInteracting ? 'none' : 'blur(24px)',
      willChange: isInteracting ? 'left, top, width, height' : 'auto'
    }"
    @mousedown="emit('nodeMouseDown', $event, node.id)"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @contextmenu.prevent="emit('nodeContextMenu', $event, node.id)"
  >
    <!-- Top Bar -->
    <div
      :class="[
        'absolute -top-10 left-0 w-full flex items-center justify-between px-1 transition-all duration-300',
        showTopBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      ]"
    >
      <div class="flex items-center gap-1.5 pointer-events-auto">
        <!-- Download & Expand buttons -->
        <template v-if="node.data.image || node.data.videoUri || node.data.audioUri">
          <button
            @click="handleDownload"
            class="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors"
            title="下载"
          >
            <Download :size="14" />
          </button>
          <button
            v-if="node.type !== NodeType.AUDIO_GENERATOR"
            @click="handleExpand"
            class="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors"
            title="全屏预览"
          >
            <Maximize2 :size="14" />
          </button>
        </template>
      </div>

      <div class="flex items-center gap-2 pointer-events-auto">
        <div v-if="isWorking" class="bg-[#2c2c2e]/90 backdrop-blur-md p-1.5 rounded-full border border-white/10">
          <Loader2 class="animate-spin w-3 h-3 text-cyan-400" />
        </div>
        <div class="px-2 py-1">
          <input
            v-if="isEditingTitle"
            class="bg-transparent border-none outline-none text-slate-400 text-[10px] font-bold uppercase tracking-wider w-24 text-right"
            v-model="tempTitle"
            @blur="handleTitleSave"
            @keydown.enter="handleTitleSave"
            @mousedown.stop
            autofocus
          />
          <span
            v-else
            class="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-text text-right"
            @click="isEditingTitle = true"
          >
            {{ node.title }}
          </span>
        </div>
      </div>
    </div>

    <!-- Input Port -->
    <div
      :class="[
        'absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md',
        isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''
      ]"
      @mousedown.stop="emit('portMouseDown', $event, node.id, 'input')"
      @mouseup.stop="emit('portMouseUp', $event, node.id, 'input')"
      title="Input"
    >
      <Plus :size="10" :stroke-width="3" class="text-white/50" />
    </div>

    <!-- Output Port -->
    <div
      :class="[
        'absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md',
        isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''
      ]"
      @mousedown.stop="emit('portMouseDown', $event, node.id, 'output')"
      @mouseup.stop="emit('portMouseUp', $event, node.id, 'output')"
      title="Output"
    >
      <Plus :size="10" :stroke-width="3" class="text-white/50" />
    </div>

    <!-- Main Content -->
    <div class="w-full h-full flex flex-col relative rounded-[24px] overflow-hidden bg-zinc-900">
      <div class="flex-1 min-h-0 relative bg-zinc-900">
        <!-- PROMPT_INPUT -->
        <template v-if="node.type === NodeType.PROMPT_INPUT">
          <div class="w-full h-full p-6 flex flex-col group/text">
            <div class="flex-1 bg-black/10 rounded-2xl border border-white/5 p-4 relative overflow-hidden backdrop-blur-sm transition-colors group-hover/text:bg-black/20">
              <textarea
                class="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-slate-200 placeholder-slate-500 font-medium leading-relaxed custom-scrollbar selection:bg-amber-500/30"
                placeholder="输入您的创意构想..."
                v-model="localPrompt"
                @blur="commitPrompt"
                @keydown="handleCmdEnter"
                @wheel.stop
                @mousedown.stop
                maxlength="1000"
              />
            </div>
          </div>
        </template>

        <!-- VIDEO_ANALYZER -->
        <template v-else-if="node.type === NodeType.VIDEO_ANALYZER">
          <div class="w-full h-full p-5 flex flex-col gap-3">
            <div
              class="relative w-full h-32 rounded-xl bg-black/20 border border-white/5 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-black/30 transition-colors group/upload"
              @click="!node.data.videoUri && fileInputRef?.click()"
            >
              <video
                v-if="videoBlobUrl"
                :src="videoBlobUrl"
                class="w-full h-full object-cover opacity-80"
                muted
                @mouseenter="($event.target as HTMLVideoElement).play()"
                @mouseleave="($event.target as HTMLVideoElement).pause()"
                @click="handleExpand"
              />
              <div v-else class="flex flex-col items-center gap-2 text-slate-500 group-hover/upload:text-slate-300">
                <Upload :size="20" />
                <span class="text-[10px] font-bold uppercase tracking-wider">上传视频</span>
              </div>
              <button
                v-if="node.data.videoUri"
                class="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-slate-400 hover:text-white backdrop-blur-md"
                @click.stop="fileInputRef?.click()"
              >
                <Edit :size="10" />
              </button>
              <input type="file" ref="fileInputRef" class="hidden" accept="video/*" @change="handleUploadVideo" />
            </div>
            <div class="flex-1 bg-black/10 rounded-xl border border-white/5 overflow-hidden relative group/analysis">
              <textarea
                class="w-full h-full bg-transparent p-3 resize-none focus:outline-none text-xs text-slate-300 font-mono leading-relaxed custom-scrollbar select-text placeholder:italic placeholder:text-slate-600"
                :value="node.data.analysis || ''"
                placeholder="等待分析结果，或在此粘贴文本..."
                @input="emit('update', node.id, { analysis: ($event.target as HTMLTextAreaElement).value })"
                @wheel.stop
                @mousedown.stop
                @dblclick.stop
                spellcheck="false"
              />
              <button
                v-if="node.data.analysis"
                class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-md text-slate-400 hover:text-white transition-all opacity-0 group-hover/analysis:opacity-100 backdrop-blur-md z-10"
                @click.stop="navigator.clipboard.writeText(node.data.analysis || '')"
                title="复制全部"
              >
                <Copy :size="12" />
              </button>
            </div>
            <div v-if="isWorking" class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
              <Loader2 class="animate-spin text-emerald-400" />
            </div>
          </div>
        </template>

        <!-- AUDIO_GENERATOR -->
        <template v-else-if="node.type === NodeType.AUDIO_GENERATOR">
          <div class="w-full h-full p-6 flex flex-col justify-center items-center relative overflow-hidden group/audio">
            <div class="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-900/10 z-0" />
            <template v-if="node.data.audioUri">
              <div class="flex flex-col items-center gap-4 w-full z-10">
                <audio
                  ref="mediaRef"
                  :src="node.data.audioUri"
                  @ended="isPlayingAudio = false"
                  @play="isPlayingAudio = true"
                  @pause="isPlayingAudio = false"
                  class="hidden"
                />
                <!-- Audio Visualizer -->
                <div class="flex items-center justify-center gap-[2px] h-12 w-full opacity-60 px-4">
                  <div
                    v-for="i in 20"
                    :key="i"
                    class="w-1 bg-cyan-400/80 rounded-full transition-all"
                    :style="{
                      height: isPlayingAudio ? `${20 + Math.random() * 80}%` : '20%',
                      transition: 'height 0.1s ease',
                      animation: isPlayingAudio ? `pulse 0.5s infinite ${i * 0.05}s` : 'none'
                    }"
                  />
                </div>
                <div class="flex items-center gap-4">
                  <button
                    @click="toggleAudio"
                    class="w-12 h-12 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/50 flex items-center justify-center transition-all hover:scale-105"
                  >
                    <Pause v-if="isPlayingAudio" :size="20" class="text-white" />
                    <Play v-else :size="20" class="text-white ml-1" />
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex flex-col items-center gap-3 text-slate-600 z-10 select-none">
                <Loader2 v-if="isWorking" :size="32" class="animate-spin text-pink-500" />
                <Mic2 v-else :size="32" class="text-slate-500" />
                <span class="text-[10px] font-bold uppercase tracking-widest">
                  {{ isWorking ? '生成中...' : '准备生成' }}
                </span>
              </div>
            </template>
            <div
              v-if="node.status === NodeStatus.ERROR"
              class="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"
            >
              <AlertCircle class="text-red-500 mb-2" />
              <span class="text-xs text-red-200">{{ node.data.error }}</span>
            </div>
          </div>
        </template>

        <!-- STORY_GENERATOR -->
        <template v-else-if="node.type === NodeType.STORY_GENERATOR">
          <div class="w-full h-full p-4 flex flex-col relative overflow-hidden group/story">
            <div class="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-900/10 z-0" />

            <!-- Story Title -->
            <div class="flex items-center gap-2 mb-3 z-10">
              <BookOpen :size="16" class="text-orange-400" />
              <input
                v-if="node.data.storyTitle"
                class="flex-1 bg-transparent border-none outline-none text-sm font-bold text-orange-300 placeholder-slate-500"
                :value="node.data.storyTitle"
                @input="emit('update', node.id, { storyTitle: ($event.target as HTMLInputElement).value })"
                @mousedown.stop
                placeholder="故事标题"
              />
              <span v-else class="text-sm font-bold text-slate-500">等待生成...</span>
            </div>

            <!-- Story Content -->
            <div class="flex-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden relative group/content z-10">
              <textarea
                class="w-full h-full bg-transparent p-3 resize-none focus:outline-none text-xs text-slate-300 leading-relaxed custom-scrollbar select-text placeholder:italic placeholder:text-slate-600"
                :value="node.data.story || ''"
                placeholder="在下方输入创意，点击生成按钮创作短故事..."
                @input="emit('update', node.id, { story: ($event.target as HTMLTextAreaElement).value })"
                @wheel.stop
                @mousedown.stop
                @dblclick.stop
                spellcheck="false"
              />
              <button
                v-if="node.data.story"
                class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-md text-slate-400 hover:text-white transition-all opacity-0 group-hover/content:opacity-100 backdrop-blur-md z-10"
                @click.stop="navigator.clipboard.writeText(node.data.story || '')"
                title="复制全部"
              >
                <Copy :size="12" />
              </button>
            </div>

            <!-- Generate Storyboard Button -->
            <div v-if="node.data.story" class="mt-3 z-10">
              <button
                @click.stop="emit('generateStoryShots', node.id)"
                :disabled="isWorking"
                class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/30 text-orange-300 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Film :size="14" />
                <span>生成故事分镜</span>
                <Sparkles :size="12" class="text-orange-400" />
              </button>
            </div>

            <!-- Working Overlay -->
            <div v-if="isWorking" class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20">
              <div class="flex flex-col items-center gap-3">
                <Loader2 class="animate-spin text-orange-400" :size="32" />
                <span class="text-xs text-orange-300 font-medium">{{ node.data.progress || '正在创作故事...' }}</span>
              </div>
            </div>

            <!-- Error Overlay -->
            <div
              v-if="node.status === NodeStatus.ERROR"
              class="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"
            >
              <AlertCircle class="text-red-500 mb-2" />
              <span class="text-xs text-red-200">{{ node.data.error }}</span>
            </div>
          </div>
        </template>

        <!-- IMAGE_GENERATOR / VIDEO_GENERATOR -->
        <template v-else>
          <div class="w-full h-full relative group/media overflow-hidden bg-zinc-900">
            <!-- Empty State -->
            <div
              v-if="!node.data.image && !node.data.videoUri"
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600"
            >
              <div
                class="w-20 h-20 rounded-[28px] bg-white/5 border border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 hover:scale-105 transition-all duration-300 shadow-inner"
                @click="fileInputRef?.click()"
              >
                <Loader2 v-if="isWorking" class="animate-spin text-cyan-500" :size="32" />
                <component v-else :is="nodeConfig.icon" :size="32" class="opacity-50" />
              </div>
              <span class="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">
                {{ isWorking ? '处理中...' : '拖拽或上传' }}
              </span>
              <input
                type="file"
                ref="fileInputRef"
                class="hidden"
                :accept="node.type.includes('VIDEO') ? 'video/*' : 'image/*'"
                @change="node.type.includes('VIDEO') ? handleUploadVideo($event) : handleUploadImage($event)"
              />
            </div>

            <!-- Media Content -->
            <template v-else>
              <!-- Image -->
              <img
                v-if="node.data.image"
                ref="mediaRef"
                :src="node.data.image"
                class="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105 bg-zinc-900"
                draggable="false"
                :style="{ filter: showImageGrid ? 'blur(10px)' : 'none' }"
              />
              <!-- Video -->
              <video
                v-else-if="videoBlobUrl || node.data.videoUri"
                ref="mediaRef"
                :src="videoBlobUrl || node.data.videoUri"
                class="w-full h-full object-cover bg-zinc-900"
                loop
                muted
                playsinline
                preload="auto"
                :style="{ filter: showImageGrid ? 'blur(10px)' : 'none' }"
              />

              <!-- Error Overlay -->
              <div
                v-if="node.status === NodeStatus.ERROR"
                class="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"
              >
                <AlertCircle class="text-red-500 mb-2" />
                <span class="text-xs text-red-200">{{ node.data.error }}</span>
              </div>

              <!-- Image/Video Grid -->
              <div
                v-if="showImageGrid && (node.data.images || node.data.videoUris)"
                class="absolute inset-0 bg-black/40 z-10 grid grid-cols-2 gap-2 p-2"
              >
                <template v-if="node.data.images">
                  <div
                    v-for="(img, idx) in node.data.images"
                    :key="idx"
                    :class="[
                      'relative rounded-lg overflow-hidden cursor-pointer border-2 bg-zinc-900',
                      img === node.data.image ? 'border-cyan-500' : 'border-transparent hover:border-white/50'
                    ]"
                    @click.stop="emit('update', node.id, { image: img })"
                  >
                    <img :src="img" class="w-full h-full object-cover" />
                  </div>
                </template>
                <template v-else-if="node.data.videoUris">
                  <div
                    v-for="(uri, idx) in node.data.videoUris"
                    :key="idx"
                    :class="[
                      'relative rounded-lg overflow-hidden cursor-pointer border-2 bg-zinc-900',
                      uri === node.data.videoUri ? 'border-cyan-500' : 'border-transparent hover:border-white/50'
                    ]"
                    @click.stop="emit('update', node.id, { videoUri: uri })"
                  >
                    <video v-if="uri" :src="uri" class="w-full h-full object-cover bg-zinc-900" muted loop autoplay />
                    <div v-else class="w-full h-full flex items-center justify-center bg-white/5 text-xs text-slate-500">
                      Failed
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Bottom Panel -->
    <div
      :class="[
        'absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500',
        isBottomPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'
      ]"
      style="transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1)"
    >
      <!-- Input Thumbnails (if has inputs) -->
      <div v-if="hasInputs" class="w-full flex justify-center mb-2 z-0 relative">
        <div class="flex items-center gap-[6px]">
          <div
            v-for="(asset, index) in inputAssets"
            :key="asset.id"
            class="relative rounded-md overflow-hidden border border-white/20 shadow-lg bg-black/60 group"
            :style="{ width: '48px', height: '48px' }"
          >
            <video
              v-if="asset.type === 'video'"
              :src="asset.src"
              class="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-zinc-900"
              muted
              loop
              autoplay
            />
            <img
              v-else
              :src="asset.src"
              class="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-zinc-900"
            />
            <div class="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-md" />
            <div class="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 z-20 shadow-sm pointer-events-none">
              <span class="text-[9px] font-bold text-white leading-none">{{ index + 1 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Glass Panel -->
      <div
        v-if="node.type !== NodeType.PROMPT_INPUT"
        class="w-full rounded-[20px] p-1 flex flex-col gap-1 bg-[#2c2c2e]/95 backdrop-blur-2xl border border-white/10 shadow-2xl relative z-[100]"
        @mousedown.stop
        @wheel.stop
      >
        <!-- Prompt Input -->
        <div class="relative group/input bg-black/10 rounded-[16px]">
          <textarea
            class="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed"
            :style="{ height: `${Math.min(inputHeight, 200)}px` }"
            :placeholder="node.type === NodeType.AUDIO_GENERATOR ? '描述您想生成的音乐或音效...' : node.type === NodeType.STORY_GENERATOR ? '输入您的故事创意，例如：一个关于时间旅行的爱情故事...' : '描述您的修改或生成需求...'"
            v-model="localPrompt"
            @blur="isInputFocused = false; commitPrompt()"
            @keydown="handleCmdEnter"
            @focus="isInputFocused = true"
            @mousedown.stop
            :readonly="isWorking"
          />
          <div
            class="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity"
            @mousedown="handleInputResizeStart"
          >
            <div class="w-8 h-1 rounded-full bg-white/10 group-hover/input:bg-white/20" />
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
          <div class="flex items-center gap-2">
            <!-- Model Selector -->
            <div class="relative group/model">
              <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400">
                <span>{{ models.find(m => m.v === node.data.model)?.l || 'AI Model' }}</span>
                <ChevronDown :size="10" />
              </div>
              <div class="absolute bottom-full left-0 pb-2 w-40 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]">
                <div class="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div
                    v-for="m in models"
                    :key="m.v"
                    @click="emit('update', node.id, { model: m.v })"
                    :class="[
                      'px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10',
                      node.data.model === m.v ? 'text-cyan-400 bg-white/5' : 'text-slate-400'
                    ]"
                  >
                    {{ m.l }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Story Genre (for STORY_GENERATOR) -->
            <div v-if="node.type === NodeType.STORY_GENERATOR" class="relative group/genre">
              <div class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-orange-400">
                <BookOpen :size="12" />
                <span>{{ node.data.storyGenre || '类型' }}</span>
              </div>
              <div class="absolute bottom-full left-0 pb-2 w-24 opacity-0 translate-y-2 pointer-events-none group-hover/genre:opacity-100 group-hover/genre:translate-y-0 group-hover/genre:pointer-events-auto transition-all duration-200 z-[200]">
                <div class="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                  <div
                    v-for="g in STORY_GENRES"
                    :key="g"
                    @click="emit('update', node.id, { storyGenre: g })"
                    :class="[
                      'px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10',
                      node.data.storyGenre === g ? 'text-orange-400 bg-white/5' : 'text-slate-400'
                    ]"
                  >
                    {{ g }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Aspect Ratio -->
            <div v-if="node.type !== NodeType.VIDEO_ANALYZER && node.type !== NodeType.AUDIO_GENERATOR && node.type !== NodeType.STORY_GENERATOR" class="relative group/ratio">
              <div class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400">
                <Scaling :size="12" />
                <span>{{ node.data.aspectRatio || '16:9' }}</span>
              </div>
              <div class="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/ratio:opacity-100 group-hover/ratio:translate-y-0 group-hover/ratio:pointer-events-auto transition-all duration-200 z-[200]">
                <div class="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div
                    v-for="r in (node.type.includes('VIDEO') ? VIDEO_ASPECT_RATIOS : IMAGE_ASPECT_RATIOS)"
                    :key="r"
                    @click="handleAspectRatioSelect(r)"
                    :class="[
                      'px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10',
                      node.data.aspectRatio === r ? 'text-cyan-400 bg-white/5' : 'text-slate-400'
                    ]"
                  >
                    {{ r }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Resolution -->
            <div v-if="(node.type.includes('IMAGE') || node.type === NodeType.VIDEO_GENERATOR) && node.type !== NodeType.STORY_GENERATOR" class="relative group/resolution">
              <div class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400">
                <Monitor :size="12" />
                <span>{{ node.data.resolution || (node.type.includes('IMAGE') ? '1k' : '720p') }}</span>
              </div>
              <div class="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:translate-y-0 group-hover/resolution:pointer-events-auto transition-all duration-200 z-[200]">
                <div class="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div
                    v-for="r in (node.type.includes('IMAGE') ? IMAGE_RESOLUTIONS : VIDEO_RESOLUTIONS)"
                    :key="r"
                    @click="emit('update', node.id, { resolution: r })"
                    :class="[
                      'px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10',
                      node.data.resolution === r ? 'text-cyan-400 bg-white/5' : 'text-slate-400'
                    ]"
                  >
                    {{ r }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Count -->
            <div v-if="(node.type.includes('IMAGE') || node.type === NodeType.VIDEO_GENERATOR) && node.type !== NodeType.STORY_GENERATOR" class="relative group/count">
              <div class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400">
                <Layers :size="12" />
                <span>{{ node.type.includes('IMAGE') ? (node.data.imageCount || 1) : (node.data.videoCount || 1) }}</span>
              </div>
              <div class="absolute bottom-full left-0 pb-2 w-16 opacity-0 translate-y-2 pointer-events-none group-hover/count:opacity-100 group-hover/count:translate-y-0 group-hover/count:pointer-events-auto transition-all duration-200 z-[200]">
                <div class="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div
                    v-for="c in (node.type.includes('IMAGE') ? IMAGE_COUNTS : VIDEO_COUNTS)"
                    :key="c"
                    @click="emit('update', node.id, node.type.includes('IMAGE') ? { imageCount: c } : { videoCount: c })"
                    :class="[
                      'px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10',
                      ((node.type.includes('IMAGE') ? node.data.imageCount : node.data.videoCount) || 1) === c ? 'text-cyan-400 bg-white/5' : 'text-slate-400'
                    ]"
                  >
                    {{ c }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Generate Button -->
          <button
            @click="handleActionClick"
            :disabled="isWorking"
            :class="[
              'relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300',
              isWorking
                ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95'
            ]"
          >
            <Loader2 v-if="isWorking" class="animate-spin" :size="12" />
            <Wand2 v-else :size="12" />
            <span>{{ isWorking ? '生成中...' : '生成' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Resize Handle -->
    <div
      class="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-50"
      @mousedown.stop="emit('resizeMouseDown', $event, node.id, nodeWidth, nodeHeight)"
    >
      <div class="w-1.5 h-1.5 rounded-full bg-current" />
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

