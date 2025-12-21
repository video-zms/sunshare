<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { X, Check, Crop, Move } from 'lucide-vue-next'

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

type InteractionType = 'create' | 'move' | 'resize'
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const props = defineProps<{
  imageSrc: string
}>()

const emit = defineEmits<{
  confirm: [croppedBase64: string]
  cancel: []
}>()

const RATIOS = [
  { label: '自由', value: null },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '1:1', value: 1 },
]

const crop = ref<CropRect | null>(null)
const aspectRatio = ref<number | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const interaction = ref<{
  type: InteractionType
  handle?: ResizeHandle
  startPos: { x: number; y: number }
  startCrop: CropRect | null
}>({ type: 'create', startPos: { x: 0, y: 0 }, startCrop: null })

const getRelativePos = (e: MouseEvent) => {
  if (!imgRef.value) return { x: 0, y: 0 }
  const rect = imgRef.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

const clampRect = (rect: CropRect, maxW: number, maxH: number): CropRect => {
  let { x, y, width, height } = rect

  if (x < 0) x = 0
  if (y < 0) y = 0
  if (width > maxW) width = maxW
  if (height > maxH) height = maxH

  if (x + width > maxW) x = maxW - width
  if (y + height > maxH) y = maxH - height

  return { x, y, width, height }
}

const handleMouseDown = (e: MouseEvent, type: InteractionType, handle?: ResizeHandle) => {
  e.preventDefault()
  e.stopPropagation()

  const pos = getRelativePos(e)

  let startCrop = crop.value
  if (type === 'create') {
    startCrop = { x: pos.x, y: pos.y, width: 0, height: 0 }
    crop.value = startCrop
  }

  interaction.value = {
    type,
    handle,
    startPos: { x: pos.x, y: pos.y },
    startCrop: startCrop ? { ...startCrop } : null,
  }
}

const handleGlobalMouseMove = (e: MouseEvent) => {
  if (!imgRef.value || !interaction.value.startCrop) return

  if (e.buttons === 0) {
    interaction.value = { ...interaction.value, type: 'create' }
    return
  }

  const pos = getRelativePos(e)
  const maxW = imgRef.value.width
  const maxH = imgRef.value.height
  const { startPos, startCrop } = interaction.value

  if (interaction.value.type === 'move') {
    const dx = pos.x - startPos.x
    const dy = pos.y - startPos.y

    const newRect = {
      ...startCrop,
      x: startCrop.x + dx,
      y: startCrop.y + dy,
    }

    crop.value = clampRect(newRect, maxW, maxH)
  } else if (interaction.value.type === 'create') {
    let currentX = Math.max(0, Math.min(pos.x, maxW))
    let currentY = Math.max(0, Math.min(pos.y, maxH))

    const anchorX = startCrop.x
    const anchorY = startCrop.y

    let width = Math.abs(currentX - anchorX)
    let height = Math.abs(currentY - anchorY)

    if (aspectRatio.value) {
      if (width / height > aspectRatio.value) {
        height = width / aspectRatio.value
      } else {
        width = height * aspectRatio.value
      }
    }

    const dirX = currentX >= anchorX ? 1 : -1
    const dirY = currentY >= anchorY ? 1 : -1

    let x = anchorX + (dirX === -1 ? -width : 0)
    let y = anchorY + (dirY === -1 ? -height : 0)

    if (x < 0) {
      x = 0
      if (aspectRatio.value) height = width / aspectRatio.value
    }
    if (y < 0) {
      y = 0
      if (aspectRatio.value) width = height * aspectRatio.value
    }
    if (x + width > maxW) {
      if (dirX === 1) width = maxW - x
      else x = maxW - width
      if (aspectRatio.value) height = width / aspectRatio.value
    }
    if (y + height > maxH) {
      if (dirY === 1) height = maxH - y
      else y = maxH - height
      if (aspectRatio.value) width = height * aspectRatio.value
    }

    crop.value = { x, y, width, height }
  } else if (interaction.value.type === 'resize' && interaction.value.handle) {
    let anchorX = 0,
      anchorY = 0
    switch (interaction.value.handle) {
      case 'nw':
        anchorX = startCrop.x + startCrop.width
        anchorY = startCrop.y + startCrop.height
        break
      case 'ne':
        anchorX = startCrop.x
        anchorY = startCrop.y + startCrop.height
        break
      case 'sw':
        anchorX = startCrop.x + startCrop.width
        anchorY = startCrop.y
        break
      case 'se':
        anchorX = startCrop.x
        anchorY = startCrop.y
        break
    }

    const currentX = Math.max(0, Math.min(pos.x, maxW))
    const currentY = Math.max(0, Math.min(pos.y, maxH))

    let newW = Math.abs(currentX - anchorX)
    let newH = Math.abs(currentY - anchorY)

    if (aspectRatio.value) {
      newH = newW / aspectRatio.value

      const isNorth = interaction.value.handle.includes('n')
      const projectedY = isNorth ? anchorY - newH : anchorY + newH

      if (projectedY < 0 || projectedY > maxH) {
        newH = Math.abs(currentY - anchorY)
        newW = newH * aspectRatio.value
      }
    }

    let newX = interaction.value.handle.includes('w') ? anchorX - newW : anchorX
    let newY = interaction.value.handle.includes('n') ? anchorY - newH : anchorY

    if (newX < 0) newX = 0
    if (newY < 0) newY = 0
    if (newX + newW > maxW) newW = maxW - newX
    if (newY + newH > maxH) newH = maxH - newY

    crop.value = { x: newX, y: newY, width: newW, height: newH }
  }
}

const handleGlobalMouseUp = () => {
  interaction.value = { ...interaction.value, type: 'create', startCrop: null }
}

onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

// Adjust existing crop when ratio changes
watch(aspectRatio, (newRatio) => {
  if (crop.value && newRatio && crop.value.width > 0 && crop.value.height > 0) {
    const centerX = crop.value.x + crop.value.width / 2
    const centerY = crop.value.y + crop.value.height / 2

    let newW = crop.value.width
    let newH = newW / newRatio

    if (newH > (imgRef.value?.height || 0)) {
      newH = imgRef.value?.height || 0
      newW = newH * newRatio
    }

    let newX = centerX - newW / 2
    let newY = centerY - newH / 2

    if (imgRef.value) {
      crop.value = clampRect(
        { x: newX, y: newY, width: newW, height: newH },
        imgRef.value.width,
        imgRef.value.height
      )
    }
  }
})

const handleConfirm = () => {
  if (!imgRef.value || !crop.value || crop.value.width === 0) {
    emit('confirm', props.imageSrc)
    return
  }

  const canvas = document.createElement('canvas')
  const sx = imgRef.value.naturalWidth / imgRef.value.width
  const sy = imgRef.value.naturalHeight / imgRef.value.height

  canvas.width = crop.value.width * sx
  canvas.height = crop.value.height * sy

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(
      imgRef.value,
      crop.value.x * sx,
      crop.value.y * sy,
      crop.value.width * sx,
      crop.value.height * sy,
      0,
      0,
      crop.value.width * sx,
      crop.value.height * sy
    )
    emit('confirm', canvas.toDataURL('image/png'))
  }
}

const cropStyle = computed(() => {
  if (!crop.value) return {}
  return {
    left: `${crop.value.x}px`,
    top: `${crop.value.y}px`,
    width: `${crop.value.width}px`,
    height: `${crop.value.height}px`,
  }
})

const innerImageStyle = computed(() => {
  if (!crop.value || !imgRef.value) return {}
  return {
    width: `${imgRef.value.width}px`,
    height: `${imgRef.value.height}px`,
    left: `${-crop.value.x}px`,
    top: `${-crop.value.y}px`,
    opacity: 1,
  }
})

const currentRatioLabel = computed(() => {
  return RATIOS.find((r) => r.value === aspectRatio.value)?.label
})

const handles = ['nw', 'ne', 'sw', 'se'] as const
</script>

<template>
  <div
    class="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300"
  >
    <!-- Top Bar: Title -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
      <div
        class="bg-[#2c2c2e]/90 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/10 text-slate-300 text-xs font-medium flex items-center gap-2 shadow-2xl"
      >
        <Crop :size="14" class="text-cyan-400" />
        <span>局部分镜截取</span>
      </div>
      <span class="text-[10px] text-slate-500 font-medium">拖拽四角调整 • 按住中间移动</span>
    </div>

    <!-- Main Canvas Area -->
    <div
      ref="containerRef"
      class="relative max-w-[85vw] max-h-[65vh] border border-white/10 shadow-2xl rounded-lg overflow-hidden select-none bg-black/50 group"
      style="cursor: crosshair"
      @mousedown="(e) => handleMouseDown(e, 'create')"
    >
      <img
        ref="imgRef"
        :src="imageSrc"
        class="max-w-full max-h-[65vh] object-contain block opacity-50"
        draggable="false"
      />

      <!-- Active Crop Area -->
      <div v-if="crop && crop.width > 0" class="absolute" :style="cropStyle">
        <!-- 1. Clear Image View Inside -->
        <div class="absolute inset-0 overflow-hidden">
          <img :src="imageSrc" class="absolute max-w-none" :style="innerImageStyle" />
        </div>

        <!-- 2. Dark Overlay Outline -->
        <div class="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none" />

        <!-- 3. Grid & Border -->
        <div class="absolute inset-0 border-2 border-cyan-400 z-10 pointer-events-none">
          <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
            <div class="border-r border-white/50" />
            <div class="border-r border-white/50" />
            <div class="col-span-3 border-b border-white/50 -mt-[33%]" />
            <div class="col-span-3 border-b border-white/50 mt-[33%]" />
          </div>
        </div>

        <!-- 4. Move Handler (Invisible Center) -->
        <div
          class="absolute inset-0 z-20 cursor-move group/move"
          @mousedown.stop="(e) => handleMouseDown(e, 'move')"
        >
          <div
            class="absolute inset-0 flex items-center justify-center opacity-0 group-hover/move:opacity-100 transition-opacity duration-200"
          >
            <div class="bg-black/50 p-2 rounded-full backdrop-blur-sm">
              <Move :size="16" class="text-white" />
            </div>
          </div>
        </div>

        <!-- 5. Resize Handles (Corners) -->
        <div
          v-for="h in handles"
          :key="h"
          class="absolute w-4 h-4 bg-white border-2 border-cyan-500 rounded-full z-30 shadow-sm hover:scale-125 transition-transform"
          :style="{
            cursor: `${h}-resize`,
            left: h.includes('w') ? '-8px' : 'auto',
            right: h.includes('e') ? '-8px' : 'auto',
            top: h.includes('n') ? '-8px' : 'auto',
            bottom: h.includes('s') ? '-8px' : 'auto',
          }"
          @mousedown.stop="(e) => handleMouseDown(e, 'resize', h)"
        />

        <!-- Size Label -->
        <div class="absolute -top-7 left-0 flex gap-2 z-20 pointer-events-none">
          <div class="bg-cyan-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-md">
            {{ Math.round(crop.width) }} × {{ Math.round(crop.height) }}
          </div>
          <div
            v-if="aspectRatio"
            class="bg-black/60 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-md"
          >
            {{ currentRatioLabel }}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Bar: Aspect Ratios & Actions -->
    <div class="flex flex-col items-center gap-6 mt-8 w-full max-w-2xl px-4">
      <!-- Aspect Ratio Selector -->
      <div
        class="flex items-center gap-2 p-1 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-lg overflow-x-auto custom-scrollbar max-w-full"
      >
        <button
          v-for="ratio in RATIOS"
          :key="ratio.label"
          @click="aspectRatio = ratio.value"
          :class="[
            'relative px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
            aspectRatio === ratio.value
              ? 'bg-cyan-500 text-black shadow-md scale-105 z-10'
              : 'text-slate-400 hover:text-white hover:bg-white/5',
          ]"
        >
          {{ ratio.label }}
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-4">
        <button
          @click="emit('cancel')"
          class="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors border border-white/5"
        >
          取消
        </button>
        <button
          @click="handleConfirm"
          :disabled="!crop || crop.width === 0"
          :class="[
            'px-8 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all flex items-center gap-2',
            !crop || crop.width === 0
              ? 'bg-white/5 text-slate-500 cursor-not-allowed'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black hover:scale-105 shadow-cyan-500/20',
          ]"
        >
          <Check :size="14" /> 确认裁剪
        </button>
      </div>
    </div>
  </div>
</template>

