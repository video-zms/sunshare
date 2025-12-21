<script setup lang="ts">
import type { SmartSequenceItem } from '../types'

interface Props {
  /** 帧列表 */
  frames: SmartSequenceItem[]
  /** 当前悬停的帧索引 */
  hoverIndex: number | null
}

defineProps<Props>()

const emit = defineEmits<{
  hoverChange: [index: number | null]
}>()

const handleMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const frames = target.querySelectorAll('[data-frame-index]')
  const index = Math.min(
    frames.length - 1,
    Math.floor(((e.clientX - rect.left) / rect.width) * frames.length)
  )
  emit('hoverChange', index)
}

const handleMouseLeave = () => {
  emit('hoverChange', null)
}
</script>

<template>
  <div
    class="w-full h-6 bg-[#1c1c1e]/80 backdrop-blur-md rounded-t-lg border-t border-x border-white/5 relative overflow-hidden flex cursor-crosshair group/strip"
    style="width: min(90vw, 820px)"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- 帧缩略图 -->
    <div
      v-for="(frame, index) in frames"
      :key="frame.id"
      :data-frame-index="index"
      class="flex-1 h-full relative border-r border-white/5 last:border-0 overflow-hidden"
    >
      <img
        :src="frame.src"
        class="w-full h-full object-cover opacity-30 grayscale group-hover/strip:opacity-50 transition-opacity"
        draggable="false"
      />
    </div>

    <!-- 悬停高亮 -->
    <div
      v-if="hoverIndex !== null && frames.length > 0"
      class="absolute top-0 bottom-0 bg-cyan-500/20 border-x border-cyan-500/50 pointer-events-none transition-all duration-75 ease-out"
      :style="{
        left: `${(hoverIndex / frames.length) * 100}%`,
        width: `${100 / frames.length}%`
      }"
    />
  </div>
</template>

