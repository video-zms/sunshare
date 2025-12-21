<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  X,
  Brush,
  Eraser,
  Palette,
  Undo,
  Trash2,
  Download,
  Play,
  Image as ImageIcon,
  Activity,
  Wand2,
  Loader2,
  ChevronDown,
  Layers,
} from 'lucide-vue-next'
import { generateImageFromText, generateVideo } from '../services/geminiService'

type Tool = 'brush' | 'eraser'
type Mode = 'video' | 'image' | 'pose'

const emit = defineEmits<{
  close: []
  generate: [type: 'image' | 'video', result: string, prompt: string]
}>()

const PRESET_COLORS = [
  '#000000',
  '#ffffff',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#4cd964',
  '#5ac8fa',
  '#007aff',
  '#5856d6',
  '#ff2d55',
  '#8e8e93',
]

// Canvas & Drawing State
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const tool = ref<Tool>('brush')
const brushColor = ref('#000000')
const brushSize = ref(5)
const eraserSize = ref(30)
const canvasHistory = ref<ImageData[]>([])

// Background Image State
const backgroundImage = ref<HTMLImageElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// UI State
const activeMode = ref<Mode>('video')
const prompt = ref('')
const isGenerating = ref(false)
const showPalette = ref(false)

const modes = [
  { id: 'video' as Mode, label: '涂鸦生视频', icon: Play },
  { id: 'image' as Mode, label: '涂鸦生图', icon: ImageIcon },
  { id: 'pose' as Mode, label: '姿势生成器 (Pose)', icon: Activity },
]

// Init Canvas
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    saveHistory()
  }
})

const saveHistory = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    canvasHistory.value = [...canvasHistory.value.slice(-10), data]
  }
}

const handleUndo = () => {
  if (canvasHistory.value.length <= 1) return
  const newHistory = [...canvasHistory.value]
  newHistory.pop()
  const prevState = newHistory[newHistory.value.length - 1]
  canvasHistory.value = newHistory

  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx && prevState) {
    ctx.putImageData(prevState, 0, 0)
  }
}

const handleClear = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    saveHistory()
  }
}

const handleImportBackground = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => (backgroundImage.value = img)
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// Drawing Handlers
const getPos = (e: MouseEvent | TouchEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

const startDrawing = (e: MouseEvent | TouchEvent) => {
  isDrawing.value = true
  const { x, y } = getPos(e)
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    if (tool.value === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = eraserSize.value
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = brushColor.value
      ctx.lineWidth = brushSize.value
    }
  }
}

const draw = (e: MouseEvent | TouchEvent) => {
  if (!isDrawing.value) return
  const { x, y } = getPos(e)
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) {
    ctx.lineTo(x, y)
    ctx.stroke()
  }
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    const ctx = canvasRef.value?.getContext('2d')
    ctx?.closePath()
    if (ctx) ctx.globalCompositeOperation = 'source-over'
    saveHistory()
  }
}

// Composite Logic (Merge Background + Sketch)
const getCompositeDataURL = (): string => {
  const canvas = canvasRef.value
  if (!canvas) return ''

  const osc = document.createElement('canvas')
  osc.width = canvas.width
  osc.height = canvas.height
  const ctx = osc.getContext('2d')
  if (!ctx) return ''

  // 1. Fill White Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, osc.width, osc.height)

  // 2. Draw Background Image
  if (backgroundImage.value) {
    const scale = Math.min(osc.width / backgroundImage.value.width, osc.height / backgroundImage.value.height)
    const w = backgroundImage.value.width * scale
    const h = backgroundImage.value.height * scale
    const x = (osc.width - w) / 2
    const y = (osc.height - h) / 2
    ctx.drawImage(backgroundImage.value, x, y, w, h)
  }

  // 3. Draw User Sketch
  ctx.drawImage(canvas, 0, 0)

  return osc.toDataURL('image/png')
}

// Generation Logic
const handleGenerate = async () => {
  if (!prompt.value.trim() || isGenerating.value) return
  isGenerating.value = true

  try {
    if (activeMode.value === 'pose') {
      // Pose Generator Mode
      const posePrompt = `
        Generate a simple, high-contrast black line art sketch on a white background.
        Subject: ${prompt.value}.
        Style: Minimalist stick figure or outline drawing, clear lines, no shading.
      `

      const res = await generateImageFromText(posePrompt, 'gemini-2.5-flash-image', [], {
        aspectRatio: '16:9',
        count: 1,
      })
      const imgUrl = res[0]

      // Draw Result onto Canvas
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = canvasRef.value
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
          ctx.globalCompositeOperation = 'source-over'

          const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
          const w = img.width * scale
          const h = img.height * scale
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2

          ctx.drawImage(img, x, y, w, h)
          saveHistory()
          isGenerating.value = false
        }
      }
      img.onerror = () => {
        throw new Error('Failed to load generated pose image')
      }
      img.src = imgUrl
    } else {
      // Video/Image Mode
      const compositeBase64 = getCompositeDataURL()

      if (activeMode.value === 'video') {
        const res = await generateVideo(prompt.value, 'veo-3.1-fast-generate-preview', { aspectRatio: '16:9' }, compositeBase64)
        emit('generate', 'video', res.uri, prompt.value)
      } else {
        const res = await generateImageFromText(prompt.value, 'gemini-2.5-flash-image', [compositeBase64], {
          aspectRatio: '16:9',
          count: 1,
        })
        emit('generate', 'image', res[0], prompt.value)
      }
      emit('close')
    }
  } catch (e) {
    console.error(e)
    alert('生成失败，请重试')
    isGenerating.value = false
  }
}

const handleDownload = () => {
  if (canvasRef.value) {
    const a = document.createElement('a')
    a.href = getCompositeDataURL()
    a.download = 'sketch.png'
    a.click()
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleGenerate()
  }
}

const modelName = computed(() => {
  if (activeMode.value === 'pose') return 'Gemini 2.5 (Pose)'
  if (activeMode.value === 'video') return 'Veo 3.1 Fast'
  return 'Gemini 2.5'
})

const generateButtonText = computed(() => {
  return activeMode.value === 'pose' ? '生成姿势' : '生成作品'
})

const placeholderText = computed(() => {
  return activeMode.value === 'pose'
    ? '描述姿势 (e.g. A stick figure running fast)...'
    : '描述画面内容 (e.g. Milk splash around the bottle)...'
})
</script>

<template>
  <div class="fixed inset-0 z-[100] bg-[#0a0a0c] flex flex-col animate-in fade-in duration-300">
    <!-- 1. Top Navigation Bar -->
    <div class="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#1c1c1e]">
      <button
        @click="emit('close')"
        class="absolute left-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
      >
        <X :size="16" />
      </button>

      <div class="flex-1 flex justify-center">
        <div class="flex bg-black/30 p-1 rounded-lg">
          <button
            v-for="mode in modes"
            :key="mode.id"
            @click="activeMode = mode.id"
            :class="[
              'flex items-center gap-2 px-6 py-1.5 rounded-md text-xs font-bold transition-all',
              activeMode === mode.id ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300',
            ]"
          >
            <component :is="mode.icon" :size="12" />
            {{ mode.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Main Canvas Area -->
    <div class="flex-1 relative bg-[#121214] flex items-center justify-center p-8 overflow-hidden">
      <!-- Floating Toolbar -->
      <div
        class="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-[#2c2c2e]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl"
      >
        <button
          @click="tool = 'brush'"
          :class="[
            'p-2.5 rounded-full transition-colors',
            tool === 'brush' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white hover:bg-white/5',
          ]"
          title="画笔"
        >
          <Brush :size="16" />
        </button>

        <button
          @click="tool = 'eraser'"
          :class="[
            'p-2.5 rounded-full transition-colors',
            tool === 'eraser' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white hover:bg-white/5',
          ]"
          title="橡皮擦"
        >
          <Eraser :size="16" />
        </button>

        <div class="w-px h-6 bg-white/10 mx-1" />

        <div class="relative">
          <button
            @click="showPalette = !showPalette"
            class="p-2.5 rounded-full transition-colors text-slate-400 hover:text-white hover:bg-white/5 relative"
            title="调色板"
          >
            <Palette :size="16" :style="{ color: tool === 'brush' ? brushColor : undefined }" />
            <div
              class="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-[#2c2c2e]"
              :style="{ backgroundColor: brushColor }"
            />
          </button>

          <div
            v-if="showPalette"
            class="absolute top-full left-1/2 -translate-x-1/2 mt-3 p-3 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl grid grid-cols-4 gap-2 w-48 z-30"
          >
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              @click="
                () => {
                  brushColor = c
                  tool = 'brush'
                  showPalette = false
                }
              "
              :class="['w-8 h-8 rounded-full border-2', brushColor === c ? 'border-white' : 'border-transparent hover:scale-110']"
              :style="{ backgroundColor: c }"
            />
          </div>
        </div>

        <div class="w-px h-6 bg-white/10 mx-1" />

        <button @click="handleUndo" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5">
          <Undo :size="16" />
        </button>

        <button @click="handleClear" class="p-2.5 rounded-full text-red-400 hover:bg-red-500/10">
          <Trash2 :size="16" />
        </button>
      </div>

      <!-- The Canvas Wrapper -->
      <div
        class="relative shadow-2xl rounded-lg overflow-hidden border border-white/5 bg-[#ffffff] select-none"
        style="aspect-ratio: 16/9; height: 100%; max-height: 800px"
      >
        <!-- Background Image Layer -->
        <img
          v-if="backgroundImage"
          :src="backgroundImage.src"
          class="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-50"
          alt="Reference"
        />

        <canvas
          ref="canvasRef"
          class="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawing"
          @touchmove="draw"
          @touchend="stopDrawing"
        />
      </div>
    </div>

    <!-- 3. Bottom Control Bar -->
    <div class="h-20 bg-[#1c1c1e] border-t border-white/10 flex items-center px-8 gap-4">
      <!-- Tools (Left) -->
      <div class="flex items-center gap-2 mr-4">
        <div
          class="relative p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
          @click="fileInputRef?.click()"
          title="导入底图"
        >
          <Layers :size="16" />
          <input ref="fileInputRef" type="file" class="hidden" accept="image/*" @change="handleImportBackground" />
        </div>
        <button
          @click="handleDownload"
          class="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/5"
          title="下载当前画布"
        >
          <Download :size="16" />
        </button>
      </div>

      <!-- Input Area -->
      <div class="flex-1 relative">
        <input
          type="text"
          v-model="prompt"
          :placeholder="placeholderText"
          class="w-full h-11 bg-black/30 border border-white/10 rounded-xl px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          @keydown="handleKeyDown"
        />
      </div>

      <!-- Settings & Generate -->
      <div class="flex items-center gap-3">
        <div
          class="h-11 px-4 flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl text-xs text-slate-300 font-medium"
        >
          <span>{{ modelName }}</span>
          <ChevronDown :size="12" class="text-slate-500" />
        </div>

        <div class="w-px h-6 bg-white/10 mx-2" />

        <button
          @click="handleGenerate"
          :disabled="isGenerating || !prompt.trim()"
          :class="[
            'h-11 px-6 rounded-xl flex items-center gap-2 font-bold text-sm transition-all',
            isGenerating || !prompt.trim()
              ? 'bg-white/5 text-slate-500 cursor-not-allowed'
              : activeMode === 'pose'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:scale-105'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:scale-105',
          ]"
        >
          <Loader2 v-if="isGenerating" class="animate-spin" :size="16" />
          <Wand2 v-else :size="16" />
          <span>{{ generateButtonText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

