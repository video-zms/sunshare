<script setup lang="ts">
import { ref } from 'vue'
import { Plus, X, GripVertical, Link, Trash2, ArrowRight, Loader2 } from 'lucide-vue-next'
import type { SmartSequenceItem } from '../types'

interface Props {
  /** 帧列表 */
  frames: SmartSequenceItem[]
  /** 正在拖拽的帧索引 */
  draggingIndex: number | null
  /** 拖拽悬停的帧索引 */
  dragOverIndex: number | null
  /** 最大帧数 */
  maxFrames: number
  /** 是否可以生成 */
  canGenerate: boolean
  /** 是否正在生成 */
  isGenerating: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  removeFrame: [id: string]
  clearFrames: []
  startDrag: [index: number]
  updateDragOver: [index: number]
  endDrag: []
  openTransitionEditor: [id: string]
  uploadFiles: [files: FileList]
  generate: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

// --- 拖拽处理 ---
const handleDragStart = (e: DragEvent, index: number) => {
  emit('startDrag', index)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // 创建透明拖拽图像
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)
  }
}

const handleDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  emit('updateDragOver', index)
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  emit('endDrag')

  // 处理外部文件拖放
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    emit('uploadFiles', e.dataTransfer.files)
  }
}

const handleDragEnd = () => {
  emit('endDrag')
}

// --- 文件上传 ---
const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('uploadFiles', target.files)
  }
  target.value = ''
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}
</script>

<template>
  <div
    class="bg-[#0a0a0c]/95 backdrop-blur-2xl border border-white/10 rounded-b-2xl rounded-t-sm shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-4 flex items-center gap-4 relative z-10"
    style="width: min(90vw, 820px)"
    @drop="handleDrop"
    @dragover.prevent
  >
    <!-- 帧列表滚动区域 -->
    <div class="flex-1 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 min-h-[80px]">
      <template v-for="(frame, index) in frames" :key="frame.id">
        <!-- 可拖拽的帧缩略图 -->
        <div
          :class="[
            'relative w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden border transition-all duration-300 ease-out group select-none',
            draggingIndex === index
              ? 'opacity-30 scale-90 grayscale'
              : 'border-white/10 hover:border-white/30 bg-white/5',
            dragOverIndex === index ? 'translate-x-2' : ''
          ]"
          @dragover="handleDragOver($event, index)"
        >
          <img
            :src="frame.src"
            class="w-full h-full object-cover pointer-events-none"
            draggable="false"
          />

          <!-- 序号标记 -->
          <div class="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-[8px] font-bold text-white/80 pointer-events-none">
            {{ index + 1 }}
          </div>

          <!-- 删除按钮 -->
          <button
            @click.stop="emit('removeFrame', frame.id)"
            class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-black/60 hover:bg-red-500 text-white/70 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-20"
          >
            <X :size="10" :stroke-width="3" />
          </button>

          <!-- 拖拽手柄 -->
          <div
            class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-black/20 backdrop-blur-[1px]"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @dragend="handleDragEnd"
          >
            <div class="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center border border-white/20 text-white/80 hover:scale-110 transition-transform">
              <GripVertical :size="16" />
            </div>
          </div>
        </div>

        <!-- 转场连接按钮 -->
        <div
          v-if="index < frames.length - 1"
          class="relative flex flex-col items-center justify-center w-6 shrink-0 z-10"
        >
          <div class="h-[2px] w-full bg-white/10 absolute top-1/2 -translate-y-1/2 -z-10" />
          <button
            @click="emit('openTransitionEditor', frame.id)"
            :class="[
              'w-5 h-5 rounded-full flex items-center justify-center transition-all hover:scale-110 border',
              frame.transition.prompt
                ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                : 'bg-[#2c2c2e] border-white/20 text-slate-500 hover:text-white hover:border-white'
            ]"
          >
            <Link :size="10" :stroke-width="2.5" />
          </button>
          <span class="text-[8px] text-slate-500 mt-1 font-mono tracking-tighter">
            {{ frame.transition.duration }}s
          </span>
        </div>
      </template>

      <!-- 添加按钮 -->
      <div
        v-if="frames.length < maxFrames"
        class="w-[72px] h-[72px] shrink-0 rounded-lg border border-dashed border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all group active:scale-95"
        @click="triggerFileInput"
        @dragover.prevent
        @drop="handleDrop"
      >
        <Plus :size="18" class="text-slate-500 group-hover:text-white transition-colors" />
        <span class="text-[9px] text-slate-500 font-medium">Add</span>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        accept="image/*"
        multiple
        @change="handleFileChange"
      />
    </div>

    <!-- 右侧操作区 -->
    <div class="pl-4 border-l border-white/10 flex flex-col gap-2 shrink-0">
      <!-- 清空按钮 -->
      <button
        @click="emit('clearFrames')"
        class="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
        title="全部清空"
      >
        <Trash2 :size="14" />
      </button>

      <!-- 生成按钮 -->
      <button
        @click="emit('generate')"
        :disabled="!canGenerate"
        :class="[
          'w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg',
          canGenerate
            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:scale-110 hover:shadow-cyan-500/30'
            : 'bg-white/10 text-slate-600 cursor-not-allowed'
        ]"
        title="生成视频"
      >
        <Loader2 v-if="isGenerating" :size="18" class="animate-spin" />
        <ArrowRight v-else :size="18" :stroke-width="3" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 4px;
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

