<script setup lang="ts">
import { watch, computed } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import { useSmartSequence } from '../composables/useSmartSequence'
import type { SmartSequenceItem } from '../types'

import SmartSequencePlayer from './SmartSequencePlayer.vue'
import SmartSequenceTimeline from './SmartSequenceTimeline.vue'
import SmartSequenceFrameList from './SmartSequenceFrameList.vue'
import SmartSequenceTransitionEditor from './SmartSequenceTransitionEditor.vue'

interface Props {
  /** 是否打开 */
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  generate: [frames: SmartSequenceItem[]]
  connectStart: [e: MouseEvent, type: 'input' | 'output']
}>()

// 使用智能多帧 composable
const sequence = useSmartSequence()

const {
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
  totalDuration,
  canGenerate,
  getCurrentPreviewSrc,
  removeFrame,
  clearFrames,
  startDrag,
  updateDragOver,
  endDrag,
  setHoverIndex,
  openTransitionEditor,
  saveTransition,
  updateTempPrompt,
  updateTempDuration,
  togglePlay,
  setPlaying,
  toggleExpanded,
  setExpanded,
  startGeneration,
  completeGeneration,
  failGeneration,
  processDroppedFiles
} = sequence

// 处理生成
const handleGenerate = async () => {
  if (!startGeneration()) return

  try {
    // 发出生成事件，让父组件处理实际的生成逻辑
    emit('generate', frames.value)
  } catch (error) {
    console.error('Generation failed', error)
    failGeneration()
  }
}

// 暴露方法给父组件，用于接收生成结果
const onGenerateComplete = (url: string) => {
  completeGeneration(url)
}

const onGenerateFail = () => {
  failGeneration()
}

// 处理文件上传
const handleUploadFiles = async (files: FileList) => {
  await processDroppedFiles(files)
}

// 处理关闭
const handleClose = () => {
  emit('close')
}

// 处理连接开始
const handleConnectStart = (e: MouseEvent, type: 'input' | 'output') => {
  emit('connectStart', e, type)
}

// 计算当前预览源
const previewSrc = computed(() => getCurrentPreviewSrc.value)

// 监听展开状态，点击背景关闭
watch(isExpanded, (expanded) => {
  if (!expanded) return
  // 展开时的逻辑可以在这里处理
})

// 暴露方法供父组件调用
defineExpose({
  onGenerateComplete,
  onGenerateFail
})
</script>

<template>
  <Teleport to="body">
    <!-- 展开时的背景遮罩 -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isExpanded"
        class="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm"
        @click="setExpanded(false)"
      />
    </Transition>

    <!-- 主 Dock 容器 -->
    <Transition
      enter-active-class="transition-all duration-500 ease-out"
      enter-from-class="translate-y-20 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-300 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-20 opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2"
      >
        <!-- 层级 1: 播放器 -->
        <div class="relative group/player mb-2">
          <!-- 连接端口 (非展开时显示) -->
          <template v-if="!isExpanded">
            <!-- 输入端口 -->
            <div
              @mousedown="handleConnectStart($event, 'input')"
              class="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center opacity-0 group-hover/player:opacity-100 hover:scale-125 transition-all cursor-crosshair z-30"
              title="连接输入"
            >
              <Plus :size="12" class="text-white/50" />
            </div>

            <!-- 输出端口 -->
            <div
              @mousedown="handleConnectStart($event, 'output')"
              class="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center opacity-0 group-hover/player:opacity-100 hover:scale-125 transition-all cursor-crosshair z-30"
              title="连接输出"
            >
              <Plus :size="12" class="text-white/50" />
            </div>
          </template>

          <SmartSequencePlayer
            :result-video-url="resultVideoUrl"
            :preview-src="previewSrc"
            :is-generating="isGenerating"
            :is-playing="isPlaying"
            :is-expanded="isExpanded"
            :frame-count="frames.length"
            :total-duration="totalDuration"
            @toggle-play="togglePlay"
            @toggle-expanded="toggleExpanded"
            @update-playing="setPlaying"
          />
        </div>

        <!-- 层级 2: 时间轴预览条 -->
        <SmartSequenceTimeline
          v-if="frames.length > 0"
          :frames="frames"
          :hover-index="hoverIndex"
          @hover-change="setHoverIndex"
        />

        <!-- 层级 3: 帧列表 -->
        <div class="relative">
          <!-- 关闭按钮 -->
          <button
            @click="handleClose"
            class="absolute -top-3 left-0 -translate-y-full p-2 text-slate-400 hover:text-white bg-black/50 backdrop-blur rounded-full border border-white/10 transition-colors z-20"
          >
            <X :size="14" />
          </button>

          <SmartSequenceFrameList
            :frames="frames"
            :dragging-index="draggingIndex"
            :drag-over-index="dragOverIndex"
            :max-frames="maxFrames"
            :can-generate="canGenerate"
            :is-generating="isGenerating"
            @remove-frame="removeFrame"
            @clear-frames="clearFrames"
            @start-drag="startDrag"
            @update-drag-over="updateDragOver"
            @end-drag="endDrag"
            @open-transition-editor="openTransitionEditor"
            @upload-files="handleUploadFiles"
            @generate="handleGenerate"
          />
        </div>

        <!-- 转场编辑弹窗 -->
        <SmartSequenceTransitionEditor
          :visible="!!editingTransitionId"
          :frame-id="editingTransitionId"
          :prompt="tempPrompt"
          :duration="tempDuration"
          @save="saveTransition"
          @cancel="saveTransition"
          @update-prompt="updateTempPrompt"
          @update-duration="updateTempDuration"
        />
      </div>
    </Transition>
  </Teleport>
</template>

