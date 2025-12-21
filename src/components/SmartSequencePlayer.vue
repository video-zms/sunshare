<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Play, Pause, Maximize2, Minimize2, Download, Loader2, MonitorPlay } from 'lucide-vue-next'

interface Props {
  /** 结果视频URL */
  resultVideoUrl: string | null
  /** 当前预览图片 */
  previewSrc: string | null
  /** 是否正在生成 */
  isGenerating: boolean
  /** 是否正在播放 */
  isPlaying: boolean
  /** 是否展开全屏 */
  isExpanded: boolean
  /** 帧数量 */
  frameCount: number
  /** 总时长 */
  totalDuration: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  togglePlay: []
  toggleExpanded: []
  updatePlaying: [value: boolean]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

// 监听播放状态变化
watch(() => props.isPlaying, (playing) => {
  if (!videoRef.value || !props.resultVideoUrl) return
  
  if (playing) {
    videoRef.value.play().catch(() => {
      emit('updatePlaying', false)
    })
  } else {
    videoRef.value.pause()
  }
})

// 监听生成完成，自动播放
watch(() => props.resultVideoUrl, (url) => {
  if (url && videoRef.value) {
    setTimeout(() => {
      videoRef.value?.play().then(() => {
        emit('updatePlaying', true)
      }).catch(() => {})
    }, 100)
  }
})

const handleVideoClick = () => {
  if (props.resultVideoUrl) {
    emit('togglePlay')
  }
}

const handleVideoEnded = () => {
  emit('updatePlaying', false)
}

const downloadFileName = computed(() => {
  return `sunstudio_seq_${Date.now()}.mp4`
})
</script>

<template>
  <div
    :class="[
      'relative bg-black border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-500',
      isExpanded
        ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[28.125vw] max-w-[90vw] max-h-[80vh] z-[100] rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)]'
        : 'w-[360px] h-[202px] rounded-xl'
    ]"
  >
    <!-- 左上角控制按钮 -->
    <div
      :class="[
        'absolute top-3 left-3 flex gap-2 z-20 transition-opacity duration-200',
        isGenerating ? 'opacity-0' : 'opacity-0 hover:opacity-100 group-hover/player:opacity-100'
      ]"
    >
      <!-- 展开/收起按钮 -->
      <button
        @click.stop="emit('toggleExpanded')"
        class="p-2 bg-black/60 backdrop-blur-md rounded-lg text-white/70 hover:text-white border border-white/10 hover:scale-105 transition-all"
        :title="isExpanded ? '退出全屏' : '放大预览'"
      >
        <Minimize2 v-if="isExpanded" :size="16" />
        <Maximize2 v-else :size="16" />
      </button>

      <!-- 下载按钮 -->
      <a
        v-if="resultVideoUrl"
        :href="resultVideoUrl"
        :download="downloadFileName"
        @click.stop
        class="p-2 bg-black/60 backdrop-blur-md rounded-lg text-white/70 hover:text-white border border-white/10 hover:scale-105 transition-all"
        title="下载视频"
      >
        <Download :size="16" />
      </a>
    </div>

    <!-- 生成中状态 -->
    <div v-if="isGenerating" class="flex flex-col items-center gap-3">
      <Loader2 :size="32" class="animate-spin text-cyan-500" />
      <span class="text-[10px] font-bold text-slate-400 tracking-widest uppercase animate-pulse">
        正在生成智能补帧...
      </span>
    </div>

    <!-- 视频播放 -->
    <div
      v-else-if="resultVideoUrl"
      class="relative w-full h-full group/video cursor-pointer"
      @click="handleVideoClick"
    >
      <video
        ref="videoRef"
        :src="resultVideoUrl"
        class="w-full h-full object-contain"
        loop
        playsinline
        @ended="handleVideoEnded"
      />
      <!-- 播放按钮覆盖层 -->
      <div
        v-if="!isPlaying"
        class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
      >
        <Play :size="48" class="text-white/80 fill-white/20" />
      </div>
    </div>

    <!-- 预览图片 -->
    <div v-else-if="previewSrc" class="relative w-full h-full">
      <img :src="previewSrc" class="w-full h-full object-contain opacity-80" />
      
      <!-- 中央播放按钮（禁用状态） -->
      <div class="absolute inset-0 flex items-center justify-center">
        <button
          disabled
          class="w-14 h-14 rounded-full flex items-center justify-center transition-all backdrop-blur-md bg-white/5 border border-white/10 cursor-default opacity-50"
        >
          <Play :size="24" class="text-white ml-1" />
        </button>
      </div>

      <!-- 信息覆盖层 -->
      <div class="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[9px] text-slate-300 font-mono border border-white/5 pointer-events-none">
        {{ totalDuration }}s • {{ frameCount }} Frames
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="flex flex-col items-center text-slate-600 gap-2 select-none">
      <MonitorPlay :size="32" :stroke-width="1" />
      <span class="text-[10px] font-medium tracking-wider">智能多帧预览</span>
    </div>
  </div>
</template>

