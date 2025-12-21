<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, h, type VNode } from 'vue'
import { X, Eraser, Copy, CornerDownLeft, Loader2, Sparkles, Brain, PenLine, Wand2 } from 'lucide-vue-next'
import { sendChatMessage } from '../services/geminiService'

interface Message {
  role: 'user' | 'model'
  text: string
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const messages = ref<Message[]>([{ role: 'model', text: '你好！我是您的创意助手。今天想创作些什么？' }])
const isLoading = ref(false)
const input = ref('')

// States for different modes
const isThinkingMode = ref(false)
const isStoryboardActive = ref(false)
const isHelpMeWriteActive = ref(false)

const chatEndRef = ref<HTMLDivElement | null>(null)
const panelRef = ref<HTMLDivElement | null>(null)
const copiedIndex = ref<number | null>(null)

const SPRING_ANIMATION = 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]'

// Auto-scroll
watch(
  [messages, isLoading, () => props.isOpen],
  () => {
    if (props.isOpen) {
      nextTick(() => {
        setTimeout(() => chatEndRef.value?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
    }
  },
  { deep: true }
)

// Handle click outside to close
const handleClickOutside = (event: MouseEvent) => {
  if (props.isOpen && panelRef.value && !panelRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})

const handleSendMessage = async () => {
  if (!input.value.trim() || isLoading.value) return

  const userText = input.value
  input.value = ''

  const newMessages: Message[] = [...messages.value, { role: 'user', text: userText }]
  messages.value = newMessages
  isLoading.value = true

  try {
    const history = messages.value.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))

    const responseText = await sendChatMessage(history, userText, {
      isThinkingMode: isThinkingMode.value,
      isStoryboard: isStoryboardActive.value,
      isHelpMeWrite: isHelpMeWriteActive.value,
    })

    messages.value = [...messages.value, { role: 'model', text: responseText }]
  } catch (error: any) {
    messages.value = [...messages.value, { role: 'model', text: error.message || '连接错误，请稍后重试。' }]
  } finally {
    isLoading.value = false
  }
}

const handleClearChat = () => {
  messages.value = [{ role: 'model', text: '你好！我是您的创意助手。今天想创作些什么？' }]
}

const handleCopy = (text: string, index: number) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      copiedIndex.value = index
      setTimeout(() => (copiedIndex.value = null), 2000)
    })
    .catch((err) => console.error('Copy failed', err))
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

const handlePanelMouseDown = (e: MouseEvent) => {
  e.stopPropagation()
}

const handlePanelWheel = (e: WheelEvent) => {
  e.stopPropagation()
}

// Parse inline styles (bold)
const parseInlineStyles = (text: string): (string | VNode)[] => {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return h('span', { key: i, class: 'text-white font-bold mx-0.5' }, content)
    }
    return part
  })
}

// Render formatted message
const renderFormattedMessage = (text: string): VNode => {
  const lines = text.split('\n')
  const elements: VNode[] = []

  lines.forEach((line, index) => {
    const key = `line-${index}`
    const trimmed = line.trim()

    // Empty lines
    if (!trimmed) {
      elements.push(h('div', { key, class: 'h-2' }))
      return
    }

    // H1 (# Title)
    if (line.startsWith('# ')) {
      elements.push(
        h(
          'h1',
          {
            key,
            class:
              'text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mt-5 mb-3 border-b border-white/10 pb-2',
          },
          line.replace(/^#\s/, '')
        )
      )
      return
    }

    // H2 (## Title)
    if (line.startsWith('## ')) {
      elements.push(
        h('h2', { key, class: 'text-sm font-bold text-white mt-4 mb-2 flex items-center gap-2' }, [
          h('span', { class: 'w-1 h-4 bg-cyan-500 rounded-full inline-block' }),
          line.replace(/^##\s/, ''),
        ])
      )
      return
    }

    // H3/H4 (### Title)
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      const content = line.replace(/^#+\s/, '')
      elements.push(h('h3', { key, class: 'text-xs font-bold text-cyan-300 mt-3 mb-1 uppercase tracking-wider' }, content))
      return
    }

    // List Items (* Item or - Item)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const content = trimmed.replace(/^[\*\-]\s/, '')
      elements.push(
        h('div', { key, class: 'flex gap-2 ml-1 mb-1.5 items-start group/list' }, [
          h('span', {
            class: 'w-1.5 h-1.5 rounded-full bg-white/20 mt-[7px] shrink-0 group-hover/list:bg-cyan-400 transition-colors',
          }),
          h('div', { class: 'text-[13px] leading-relaxed text-slate-300 flex-1' }, parseInlineStyles(content)),
        ])
      )
      return
    }

    // Numbered Lists (1. Item)
    if (/^\d+\.\s/.test(trimmed)) {
      const [num, ...rest] = trimmed.split(/\.\s/)
      const content = rest.join('. ')
      elements.push(
        h('div', { key, class: 'flex gap-2 ml-1 mb-1.5 items-start' }, [
          h('span', { class: 'text-xs font-mono text-cyan-500/80 mt-[2px] shrink-0' }, `${num}.`),
          h('div', { class: 'text-[13px] leading-relaxed text-slate-300 flex-1' }, parseInlineStyles(content)),
        ])
      )
      return
    }

    // Blockquotes (> Quote)
    if (trimmed.startsWith('> ')) {
      const content = trimmed.replace(/^>\s/, '')
      elements.push(
        h(
          'div',
          { key, class: 'pl-3 border-l-2 border-cyan-500/30 italic text-slate-400 my-2 text-xs' },
          parseInlineStyles(content)
        )
      )
      return
    }

    // Normal Paragraphs
    elements.push(
      h('div', { key, class: 'text-[13px] leading-relaxed text-slate-300 mb-1' }, parseInlineStyles(line))
    )
  })

  return h('div', { class: 'space-y-0.5 select-text cursor-text' }, elements)
}

const thinkingStatusText = () => {
  if (isThinkingMode.value) return '深度思考中...'
  if (isStoryboardActive.value) return '正在规划分镜...'
  if (isHelpMeWriteActive.value) return '正在润色文本...'
  return '正在思考创意...'
}

const placeholderText = () => {
  if (isStoryboardActive.value) return '输入视频描述，我将为您生成专业分镜脚本...'
  if (isThinkingMode.value) return '输入复杂问题，进行深度逻辑推理...'
  if (isHelpMeWriteActive.value) return '输入简短想法，我将帮您扩写和润色...'
  return '输入您的想法，让 AI 为您完善...'
}
</script>

<template>
  <div
    ref="panelRef"
    :class="[
      'fixed right-6 top-1/2 -translate-y-1/2 h-[85vh] w-[420px] bg-[#1c1c1e]/95 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-2xl z-40 flex flex-col overflow-hidden',
      SPRING_ANIMATION,
      isOpen ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-10 scale-95 pointer-events-none',
    ]"
    @mousedown="handlePanelMouseDown"
    @wheel="handlePanelWheel"
  >
    <!-- Header -->
    <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md z-10 shrink-0">
      <div class="flex items-center gap-1">
        <button
          @click="emit('close')"
          class="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors group"
        >
          <X :size="14" class="group-hover:scale-110 transition-transform" />
        </button>
        <button
          @click="handleClearChat"
          class="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-red-400 transition-colors group"
          title="清空对话"
        >
          <Eraser :size="14" class="group-hover:scale-110 transition-transform" />
        </button>
      </div>
      <div class="flex items-center gap-2.5">
        <div class="flex flex-col items-end">
          <span class="text-xs font-bold text-slate-200 tracking-wide">AI 创意助手</span>
          <span class="text-[10px] text-slate-500 font-medium">提示词优化 & 灵感生成</span>
        </div>
        <div
          class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 shadow-inner"
        >
          <Sparkles :size="14" class="text-cyan-400" />
        </div>
      </div>
    </div>

    <!-- Chat Content -->
    <div class="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-[#0a0a0c]/50">
      <div
        v-for="(m, i) in messages"
        :key="i"
        :class="['flex w-full', m.role === 'user' ? 'justify-end' : 'justify-start']"
      >
        <div :class="['flex flex-col max-w-[92%] gap-1.5', m.role === 'user' ? 'items-end' : 'items-start']">
          <!-- Role Label -->
          <div class="flex items-center gap-2 px-1">
            <span v-if="m.role === 'model'" class="text-[10px] font-bold text-cyan-500/80 uppercase tracking-wider"
              >SunStudio AI</span
            >
            <span v-if="m.role === 'user'" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">You</span>
          </div>

          <!-- Message Bubble -->
          <div class="group relative transition-all w-full">
            <div
              :class="[
                'relative px-5 py-4 rounded-2xl shadow-sm border select-text cursor-text',
                m.role === 'user'
                  ? 'bg-[#2c2c2e] border-white/10 text-slate-100 rounded-tr-sm'
                  : 'bg-[#1c1c1e] border-white/5 text-slate-300 rounded-tl-sm w-full pr-10',
              ]"
            >
              <component v-if="m.role === 'model'" :is="renderFormattedMessage(m.text)" />
              <p v-else class="leading-6 text-[13px] whitespace-pre-wrap">{{ m.text }}</p>

              <!-- Copy Button -->
              <button
                @click="handleCopy(m.text, i)"
                class="absolute top-2 right-2 p-1.5 rounded-full bg-black/20 hover:bg-black/50 border border-white/5 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:scale-110 z-10"
                title="复制内容"
              >
                <span v-if="copiedIndex === i" class="text-[10px] font-bold text-green-400">OK</span>
                <Copy v-else :size="10" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2">
        <div class="flex flex-col gap-2 max-w-[85%]">
          <span
            :class="['text-[10px] font-bold uppercase tracking-wider px-1', isThinkingMode ? 'text-indigo-400' : 'text-cyan-500/80']"
          >
            {{ isThinkingMode ? 'Deep Thinking' : 'Thinking' }}
          </span>
          <div
            :class="[
              'px-5 py-4 bg-[#1c1c1e] border rounded-2xl rounded-tl-sm flex items-center gap-3 w-fit shadow-lg',
              isThinkingMode ? 'border-indigo-500/30 shadow-indigo-900/20' : 'border-white/5 shadow-cyan-900/10',
            ]"
          >
            <Loader2 :size="16" :class="['animate-spin', isThinkingMode ? 'text-indigo-400' : 'text-cyan-500']" />
            <span :class="['text-xs font-medium tracking-wide', isThinkingMode ? 'text-indigo-200' : 'text-slate-400']">
              {{ thinkingStatusText() }}
            </span>
          </div>
        </div>
      </div>
      <div ref="chatEndRef" />
    </div>

    <!-- Input Area -->
    <div class="p-4 bg-[#1c1c1e] border-t border-white/5 shrink-0 flex flex-col gap-2">
      <!-- Tool Bar -->
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <button
            @click="
              () => {
                isThinkingMode = !isThinkingMode
                isStoryboardActive = false
                isHelpMeWriteActive = false
              }
            "
            :class="[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border',
              isThinkingMode
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                : 'bg-white/5 text-slate-500 border-transparent hover:text-slate-300',
            ]"
          >
            <Brain :size="12" :class="isThinkingMode ? 'animate-pulse' : ''" />
            <span>深度思考模式</span>
          </button>

          <button
            @click="
              () => {
                isStoryboardActive = !isStoryboardActive
                isThinkingMode = false
                isHelpMeWriteActive = false
              }
            "
            :class="[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border',
              isStoryboardActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-white/5 text-slate-500 border-transparent hover:text-slate-300',
            ]"
          >
            <PenLine :size="12" />
            <span>分镜脚本</span>
          </button>

          <button
            @click="
              () => {
                isHelpMeWriteActive = !isHelpMeWriteActive
                isThinkingMode = false
                isStoryboardActive = false
              }
            "
            :class="[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border',
              isHelpMeWriteActive
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.2)]'
                : 'bg-white/5 text-slate-500 border-transparent hover:text-slate-300',
            ]"
          >
            <Wand2 :size="12" />
            <span>帮我写</span>
          </button>
        </div>

        <span v-if="isThinkingMode" class="text-[9px] text-indigo-400/70 font-mono tracking-tight">Gemini 3 Pro</span>
      </div>

      <div class="relative group/input">
        <textarea
          class="w-full bg-black/20 border border-white/10 rounded-[20px] pl-4 pr-12 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:bg-black/40 focus:border-cyan-500/30 transition-all resize-none custom-scrollbar leading-5"
          :placeholder="placeholderText()"
          v-model="input"
          @keydown="handleKeyDown"
          rows="1"
          :style="{ minHeight: '48px', maxHeight: '120px' }"
        />
        <button
          @click="handleSendMessage"
          :disabled="!input.trim() || isLoading"
          :class="[
            'absolute right-2 top-2 p-2 rounded-full transition-all duration-300',
            input.trim() && !isLoading
              ? 'bg-cyan-500 text-black hover:bg-cyan-400 hover:scale-105 shadow-lg shadow-cyan-500/20'
              : 'bg-white/5 text-slate-600 cursor-not-allowed',
          ]"
        >
          <Loader2 v-if="isLoading" :size="16" class="animate-spin" />
          <CornerDownLeft v-else :size="16" />
        </button>
      </div>
      <div class="text-[9px] text-slate-600 text-center font-medium tracking-wide">Shift + Enter 换行</div>
    </div>
  </div>
</template>

