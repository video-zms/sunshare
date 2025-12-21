<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { X, Clock } from 'lucide-vue-next'

interface Props {
  /** 是否显示 */
  visible: boolean
  /** 当前编辑的帧ID */
  frameId: string | null
  /** 运镜描述 */
  prompt: string
  /** 持续时间 */
  duration: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  save: []
  cancel: []
  updatePrompt: [value: string]
  updateDuration: [value: number]
}>()

const modalRef = ref<HTMLDivElement | null>(null)

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  if (!props.visible) return
  
  const target = event.target as HTMLElement
  // 检查是否点击了连接按钮
  if (target.closest('button[data-link-btn]')) return
  
  if (modalRef.value && !modalRef.value.contains(target)) {
    emit('save')
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleClickOutside)
})

// 当编辑的帧变化时，重置焦点
watch(() => props.frameId, () => {
  // 可以在这里添加焦点逻辑
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-95"
  >
    <div
      v-if="visible"
      ref="modalRef"
      class="absolute bottom-[130px] z-[100] w-[240px] aspect-[9/16] bg-[#18181b] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
      style="left: 50%; transform: translateX(-50%)"
    >
      <!-- 头部 -->
      <div class="px-4 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <span class="text-xs font-bold text-slate-200 tracking-wide">运镜描述</span>
        <button
          @click="emit('save')"
          class="text-slate-500 hover:text-white transition-colors"
        >
          <X :size="12" />
        </button>
      </div>

      <!-- 文本输入区 -->
      <div class="flex-1 p-4">
        <textarea
          :value="prompt"
          @input="emit('updatePrompt', ($event.target as HTMLTextAreaElement).value)"
          class="w-full h-full bg-[#09090b] border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed custom-scrollbar shadow-inner"
          placeholder="描述镜头之间的转换..."
          autofocus
        />
      </div>

      <!-- 底部操作区 -->
      <div class="p-4 pt-0 flex flex-col gap-3">
        <!-- 时长滑块 -->
        <div class="flex items-center gap-2 bg-[#09090b] border border-white/10 rounded-xl px-3 py-2">
          <Clock :size="12" class="text-slate-500 shrink-0" />
          <input
            type="range"
            min="1"
            max="6"
            step="0.5"
            :value="duration"
            @input="emit('updateDuration', parseFloat(($event.target as HTMLInputElement).value))"
            class="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer duration-slider"
          />
          <span class="text-[10px] font-mono text-slate-300 min-w-[24px] text-right">
            {{ duration }}s
          </span>
        </div>

        <!-- 确认按钮 -->
        <button
          @click="emit('save')"
          class="w-full py-2.5 bg-white text-black hover:bg-cyan-400 rounded-xl text-xs font-bold transition-colors shadow-lg"
        >
          确认
        </button>
      </div>

      <!-- 底部箭头指示器 -->
      <div class="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#18181b] border-r border-b border-white/10 rotate-45 pointer-events-none" />
    </div>
  </Transition>
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

.duration-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #06b6d4;
  cursor: pointer;
}

.duration-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #06b6d4;
  cursor: pointer;
  border: none;
}
</style>

