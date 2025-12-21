<script setup lang="ts">
import { ref, computed } from 'vue'
import { Sparkles, Loader2, AlertCircle, Trash2, Play } from 'lucide-vue-next'
import UploadButton from './UploadButton.vue'
import ExpandedView from '../ExpandedView.vue'

interface Props {
  // 视频 URL
  video?: string | null
  // 是否正在生成
  isGenerating?: boolean
  // 视频生成状态
  generatingStatus?: 'queued' | 'in_progress' | 'completed' | 'failed'
  // 视频生成进度 0-100
  generatingProgress?: number
  // 视频尺寸配置
  width?: string
  height?: string
  // 上传按钮文本
  uploadText?: string
  // 是否禁用上传
  disabled?: boolean
  // 是否禁用生成
  disableGenerate?: boolean
  // 是否禁用预览
  disablePreview?: boolean
  // 是否禁用删除
  disableDelete?: boolean
  // 是否启用拖拽上传
  enableDragDrop?: boolean
  // 接受的文件类型
  accept?: string
  // 自定义类名
  customClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  video: null,
  isGenerating: false,
  generatingStatus: undefined,
  generatingProgress: 0,
  width: '160px',
  height: '90px',
  uploadText: '上传视频',
  disabled: false,
  disableGenerate: false,
  disablePreview: false,
  disableDelete: false,
  enableDragDrop: true,
  accept: 'video/*',
  customClass: ''
})

const emit = defineEmits<{
  // 上传事件
  upload: [event: Event]
  // 生成事件
  generate: []
  // 删除事件
  delete: []
  // 视频变化事件（上传或生成后）
  change: [video: string | null]
}>()

const expandedMedia = ref<{ src: string, type: 'video' } | null>(null)
const isDragging = ref(false)
const videoError = ref(false)
const containerRef = ref<HTMLDivElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const handleVideoClick = () => {
  if (props.disablePreview || !props.video || videoError.value) return
  expandedMedia.value = {
    src: props.video,
    type: 'video'
  }
}

const processFile = (file: File) => {
  if (!file.type.startsWith('video/')) {
    console.warn('文件不是视频类型')
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    emit('change', result)
  }
  reader.onerror = () => {
    console.error('读取文件失败')
    videoError.value = true
  }
  reader.readAsDataURL(file)
}

const handleUpload = (event: Event) => {
  if (props.disabled) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  processFile(file)
  input.value = ''
  emit('upload', event)
}

const handleGenerate = () => {
  if (props.disableGenerate || props.isGenerating) return
  emit('generate')
}

const handleDelete = () => {
  if (props.disableDelete) return
  emit('delete')
  emit('change', null)
}

const handleClosePreview = () => {
  expandedMedia.value = null
}

// 拖拽上传处理
const handleDragEnter = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

const handleDragOver = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
}

const handleDragLeave = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
  if (e.target === containerRef.value) {
    isDragging.value = false
  }
}

const handleDrop = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('video/')) {
      processFile(file)
    }
  }
}

// 视频加载错误处理
const handleVideoError = () => {
  videoError.value = true
}

const handleVideoLoad = () => {
  videoError.value = false
}

const dragOverlayClass = computed(() => {
  return isDragging.value
    ? 'opacity-100 border-cyan-500 bg-cyan-500/10'
    : 'opacity-0'
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative group/video"
    :class="[customClass, enableDragDrop ? 'cursor-pointer' : '']"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- 有视频时显示视频 -->
    <div
      v-if="video && !videoError"
      :class="[
        'rounded-xl overflow-hidden border border-white/10 cursor-pointer transition-all hover:border-white/20',
        disablePreview ? '' : 'hover:shadow-lg hover:shadow-cyan-500/20'
      ]"
      :style="{
        width: width,
        height: height
      }"
      @click="handleVideoClick"
    >
      <video
        ref="videoRef"
        :src="video"
        class="w-full h-full object-cover"
        @error="handleVideoError"
        @loadeddata="handleVideoLoad"
        muted
        preload="metadata"
      />
      
      <!-- 生成状态覆盖层（有视频但还在生成新视频时） -->
      <div
        v-if="generatingStatus && (generatingStatus === 'queued' || generatingStatus === 'in_progress')"
        class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl z-10"
      >
        <Loader2 :size="24" class="animate-spin text-purple-400 mb-2" />
        <div class="text-xs text-white font-medium mb-1">
          {{ generatingStatus === 'queued' ? '排队中...' : '生成中...' }}
        </div>
        <div v-if="generatingProgress > 0" class="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            class="h-full bg-purple-500 transition-all duration-300"
            :style="{ width: `${generatingProgress}%` }"
          />
        </div>
        <div v-if="generatingProgress > 0" class="text-[10px] text-slate-400 mt-1">
          {{ generatingProgress }}%
        </div>
      </div>
    </div>

    <!-- 视频加载失败 -->
    <div
      v-else-if="video && videoError"
      :class="[
        'rounded-xl overflow-hidden border border-red-500/30 bg-red-500/5 flex flex-col items-center justify-center',
        disablePreview ? '' : 'cursor-pointer'
      ]"
      :style="{
        width: width,
        height: height
      }"
      @click="handleVideoClick"
    >
      <AlertCircle :size="20" class="text-red-400 mb-1" />
      <span class="text-[10px] text-red-400">视频加载失败</span>
    </div>

    <!-- 没有视频时显示上传区域 -->
    <div v-else class="relative" :style="{ width: width, height: height }">
      <UploadButton
        mode="empty"
        :accept="accept"
        :empty-config="{
          width: width,
          height: height,
          text: uploadText
        }"
        :disabled="disabled || (generatingStatus === 'queued' || generatingStatus === 'in_progress')"
        @change="handleUpload"
      />
      
      <!-- 生成状态覆盖层 -->
      <div
        v-if="generatingStatus && (generatingStatus === 'queued' || generatingStatus === 'in_progress')"
        class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl z-10"
      >
        <Loader2 :size="24" class="animate-spin text-purple-400 mb-2" />
        <div class="text-xs text-white font-medium mb-1">
          {{ generatingStatus === 'queued' ? '排队中...' : '生成中...' }}
        </div>
        <div v-if="generatingProgress > 0" class="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            class="h-full bg-purple-500 transition-all duration-300"
            :style="{ width: `${generatingProgress}%` }"
          />
        </div>
        <div v-if="generatingProgress > 0" class="text-[10px] text-slate-400 mt-1">
          {{ generatingProgress }}%
        </div>
      </div>
      
      <!-- 生成失败提示 -->
      <div
        v-else-if="generatingStatus === 'failed'"
        class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/20 border border-red-500/30 rounded-xl z-10"
      >
        <AlertCircle :size="20" class="text-red-400 mb-1" />
        <div class="text-xs text-red-400">生成失败</div>
      </div>
      
      <!-- 没有视频时也显示操作按钮 -->
      <div
        class="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover/video:opacity-100 transition-opacity rounded-xl"
        @click.stop
      >
        <!-- 生成按钮 -->
        <button
          v-if="!disableGenerate"
          @click.stop="handleGenerate"
          :disabled="isGenerating || generatingStatus === 'queued' || generatingStatus === 'in_progress'"
          class="p-2 bg-purple-500/80 hover:bg-purple-500 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="AI生成视频"
        >
          <Loader2 v-if="isGenerating || generatingStatus === 'queued' || generatingStatus === 'in_progress'" :size="14" class="animate-spin" />
          <Sparkles v-else :size="14" />
        </button>

        <!-- 上传按钮 -->
        <UploadButton
          mode="button"
          :accept="accept"
          :disabled="disabled"
          :button-config="{
            size: 'md',
            variant: 'default',
            iconSize: 14,
            showText: false
          }"
          custom-class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"
          @change="handleUpload"
        />
      </div>
    </div>

    <!-- 拖拽上传提示层 -->
    <div
      v-if="enableDragDrop && !video"
      :class="[
        'absolute inset-0 rounded-xl border-2 border-dashed transition-all pointer-events-none flex items-center justify-center',
        dragOverlayClass
      ]"
      :style="{
        width: width,
        height: height
      }"
    >
      <div class="text-center">
        <div class="text-cyan-400 text-sm font-medium mb-1">松开以上传</div>
        <div class="text-[10px] text-cyan-400/70">支持拖拽视频文件</div>
      </div>
    </div>

    <!-- 删除按钮 - 固定在右上角 -->
    <button
      v-if="video && !videoError && !disableDelete"
      @click.stop="handleDelete"
      class="absolute top-1 right-1 p-1 hover:text-red-500 rounded-md text-white transition-all opacity-0 group-hover/video:opacity-100 z-20 shadow-lg"
      title="删除视频"
    >
      <Trash2 :size="12" />
    </button>

    <!-- 悬停时显示操作按钮 -->
    <div
      v-if="video && !videoError"
      class="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover/video:opacity-100 transition-opacity rounded-xl"
      :style="{
        width: width,
        height: height
      }"
      @click.stop
    >
      <!-- 播放按钮 -->
      <button
        v-if="!disablePreview"
        @click.stop="handleVideoClick"
        class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
        title="播放视频"
      >
        <Play :size="14" fill="white" />
      </button>

      <!-- 生成按钮 -->
      <button
        v-if="!disableGenerate"
        @click="handleGenerate"
        :disabled="isGenerating || generatingStatus === 'queued' || generatingStatus === 'in_progress'"
        class="p-2 bg-purple-500/80 hover:bg-purple-500 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :title="video ? '重新生成' : 'AI生成'"
      >
        <Loader2 v-if="isGenerating || generatingStatus === 'queued' || generatingStatus === 'in_progress'" :size="14" class="animate-spin" />
        <Sparkles v-else :size="14" />
      </button>

      <!-- 上传按钮 -->
      <UploadButton
        mode="button"
        :accept="accept"
        :disabled="disabled"
        :button-config="{
          size: 'md',
          variant: 'default',
          iconSize: 14,
          showText: false
        }"
        custom-class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"
        @change="handleUpload"
      />
    </div>

    <!-- 预览大视频 -->
    <ExpandedView :media="expandedMedia" @close="handleClosePreview" />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

