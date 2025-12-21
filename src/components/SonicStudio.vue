<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  X, Play, Pause, Download, Mic2, Disc, Wand2, Volume2,
  Upload, FileAudio, User, Smile, FileText, MessageCircle,
  Activity, AudioLines, Loader2
} from 'lucide-vue-next'
import { generateAudio, transcribeAudio, connectLiveSession } from '../services/geminiService'

interface Props {
  isOpen: boolean
  history: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  generate: [src: string, prompt: string, duration: number]
}>()

type TabMode = 'factory' | 'transcribe' | 'live'

const VOICE_PERSONAS = [
  { label: '深沉叙述 (Narrator)', desc: 'Deep, resonant male voice, slow pacing, storytelling style.', gender: 'Male' },
  { label: '活力解说 (Energetic)', desc: 'High energy, fast paced, enthusiastic YouTuber style.', gender: 'Any' },
  { label: '知性新闻 (News)', desc: 'Professional, articulate, neutral tone, broadcast standard.', gender: 'Female' },
  { label: '动漫少女 (Anime)', desc: 'High pitched, cute, expressive, "kawaii" aesthetic.', gender: 'Female' },
  { label: '电影旁白 (Epic)', desc: 'Gravelly, dramatic, movie trailer voice, intense.', gender: 'Male' },
  { label: '慈祥长者 (Elder)', desc: 'Warm, shaky, wise, slow speaking grandmother/grandfather.', gender: 'Any' },
]

const EMOTIONS = [
  { label: '默认 (Neutral)', value: 'neutral' },
  { label: '开心 (Happy)', value: 'cheerful and excited' },
  { label: '悲伤 (Sad)', value: 'melancholic and tearful' },
  { label: '愤怒 (Angry)', value: 'furious and shouting' },
  { label: '耳语 (Whisper)', value: 'whispering quietly' },
  { label: '恐惧 (Scared)', value: 'trembling and fearful' },
]

const PRESET_COVERS = [
  'from-pink-500 to-rose-500',
  'from-cyan-500 to-blue-500',
  'from-purple-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-slate-700 to-slate-900',
]

// --- Tab State ---
const activeTab = ref<TabMode>('factory')

// --- Voice Factory State ---
const textPrompt = ref('')
const selectedPersona = ref<any>(null)
const selectedEmotion = ref(EMOTIONS[0])
const referenceAudio = ref<string | null>(null)
const referenceFileName = ref<string | null>(null)
const isGenerating = ref(false)

// --- Transcriber State ---
const transcribeFile = ref<string | null>(null)
const transcribeFileName = ref<string | null>(null)
const transcript = ref('')
const isTranscribing = ref(false)

// --- Live Conversation State ---
const isLiveActive = ref(false)
const liveStatus = ref('Ready')
let audioContext: AudioContext | null = null
let nextStartTime = 0
let session: any = null
let processor: ScriptProcessorNode | null = null
let stream: MediaStream | null = null

// --- Player State ---
const currentTrack = ref<any>(null)
const isPlaying = ref(false)
const volume = ref(0.8)
const currentTime = ref(0)
const duration = ref(0)
const audioRef = ref<HTMLAudioElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const transcribeInputRef = ref<HTMLInputElement | null>(null)

// --- Audio Helpers ---
const decodeAudioData = async (base64PCM: string, ctx: AudioContext) => {
  const binaryString = atob(base64PCM)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)

  const int16 = new Int16Array(bytes.buffer)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768
  }

  const buffer = ctx.createBuffer(1, float32.length, 24000)
  buffer.copyToChannel(float32, 0)
  return buffer
}

const convertFloat32ToInt16PCM = (float32: Float32Array) => {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// --- Player Logic ---
watch(currentTrack, async (track) => {
  if (track && audioRef.value) {
    audioRef.value.src = track.src
    try {
      await audioRef.value.play()
      isPlaying.value = true
    } catch (e) {
      console.error('Playback failed', e)
    }
  }
})

const togglePlay = () => {
  if (!audioRef.value || !currentTrack.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
    isPlaying.value = false
  } else {
    audioRef.value.play()
    isPlaying.value = true
  }
}

const handleTimeUpdate = () => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
    duration.value = audioRef.value.duration || 0
  }
}

const handleEnded = () => {
  isPlaying.value = false
}

// --- Voice Factory Handlers ---
const handleUploadSample = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    referenceFileName.value = file.name
    const reader = new FileReader()
    reader.onload = (ev) => {
      referenceAudio.value = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const clearReference = (e: Event) => {
  e.stopPropagation()
  referenceAudio.value = null
  referenceFileName.value = null
}

const handleGenerateClick = async () => {
  if (!textPrompt.value.trim() || isGenerating.value) return
  isGenerating.value = true
  try {
    const audioUri = await generateAudio(
      textPrompt.value,
      referenceAudio.value || undefined,
      { persona: selectedPersona.value, emotion: selectedEmotion.value }
    )
    emit('generate', audioUri, textPrompt.value, 0)
    currentTrack.value = {
      id: `temp-${Date.now()}`,
      src: audioUri,
      title: textPrompt.value.substring(0, 30) + (textPrompt.value.length > 30 ? '...' : ''),
      timestamp: Date.now()
    }
  } catch (e) {
    console.error(e)
    alert('生成失败，请重试')
  } finally {
    isGenerating.value = false
  }
}

// --- Transcriber Handlers ---
const handleUploadTranscribe = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    transcribeFileName.value = file.name
    const reader = new FileReader()
    reader.onload = (ev) => {
      transcribeFile.value = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const clearTranscribeFile = (e: Event) => {
  e.stopPropagation()
  transcribeFile.value = null
  transcribeFileName.value = null
}

const handleTranscribeClick = async () => {
  if (!transcribeFile.value || isTranscribing.value) return
  isTranscribing.value = true
  try {
    const text = await transcribeAudio(transcribeFile.value)
    transcript.value = text
  } catch (e) {
    console.error(e)
    alert('转录失败')
  } finally {
    isTranscribing.value = false
  }
}

const copyTranscript = () => {
  navigator.clipboard.writeText(transcript.value)
}

// --- Live Conversation Handlers ---
const startLive = async () => {
  try {
    liveStatus.value = 'Connecting...'
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    audioContext = ctx
    nextStartTime = 0

    session = await connectLiveSession(
      async (pcmBase64) => {
        if (ctx.state === 'suspended') await ctx.resume()
        const buffer = await decodeAudioData(pcmBase64, ctx)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)

        const now = ctx.currentTime
        const startTime = Math.max(now, nextStartTime)
        source.start(startTime)
        nextStartTime = startTime + buffer.duration
      },
      () => stopLive()
    )

    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const source = ctx.createMediaStreamSource(stream)

    processor = ctx.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      const pcmInt16 = convertFloat32ToInt16PCM(inputData)
      const base64 = arrayBufferToBase64(pcmInt16.buffer)

      session.sendRealtimeInput({
        media: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64
        }
      })
    }

    source.connect(processor)
    const mute = ctx.createGain()
    mute.gain.value = 0
    processor.connect(mute)
    mute.connect(ctx.destination)

    liveStatus.value = 'Connected & Listening'
    isLiveActive.value = true
  } catch (e) {
    console.error('Live Error', e)
    liveStatus.value = 'Error Connecting'
    stopLive()
  }
}

const stopLive = () => {
  session = null
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  isLiveActive.value = false
  liveStatus.value = 'Ready'
}

const toggleLive = () => {
  if (isLiveActive.value) stopLive()
  else startLive()
}

// --- Helpers ---
const getRandomCover = (id: string) => {
  const index = id.charCodeAt(id.length - 1) % PRESET_COVERS.length
  return PRESET_COVERS[index]
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Cleanup
onUnmounted(() => {
  stopLive()
})
</script>

<template>
  <div
    :class="[
      'fixed inset-0 z-[100] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] bg-[#0a0a0c] overflow-hidden flex',
      isOpen ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 -translate-x-10 pointer-events-none'
    ]"
    style="transform-origin: left center"
  >
    <!-- Background Ambience -->
    <div class="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />
    <div class="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[100px] pointer-events-none" />

    <!-- Left Sidebar -->
    <div class="w-64 h-full border-r border-white/5 bg-[#121214] flex flex-col z-10">
      <div class="h-16 flex items-center px-6 border-b border-white/5 gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
          <AudioLines :size="16" class="text-white" />
        </div>
        <span class="text-sm font-bold tracking-wide text-white">Audio Hub</span>
      </div>

      <div class="flex flex-col gap-1 p-4">
        <button
          @click="activeTab = 'factory'"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
            activeTab === 'factory' ? 'bg-white/10 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          ]"
        >
          <Mic2 :size="16" /> 声音工厂 (Voice Factory)
        </button>
        <button
          @click="activeTab = 'transcribe'"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
            activeTab === 'transcribe' ? 'bg-white/10 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          ]"
        >
          <FileText :size="16" /> 语音转文字 (Transcriber)
        </button>
        <button
          @click="activeTab = 'live'"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
            activeTab === 'live' ? 'bg-white/10 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          ]"
        >
          <MessageCircle :size="16" /> 实时对话 (Live Chat)
        </button>
      </div>

      <!-- History -->
      <div class="mt-auto p-4 border-t border-white/5">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">历史记录</div>
        <div class="flex-1 overflow-y-auto custom-scrollbar space-y-1 h-48">
          <div v-if="history.length === 0" class="text-xs text-slate-600 text-center py-4">暂无历史</div>
          <div
            v-else
            v-for="item in history"
            :key="item.id"
            @click="currentTrack = item"
            :class="[
              'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all',
              currentTrack?.id === item.id ? 'bg-white/10' : 'hover:bg-white/5'
            ]"
          >
            <div :class="['w-6 h-6 rounded bg-gradient-to-br flex items-center justify-center shrink-0', getRandomCover(item.id)]">
              <Mic2 :size="10" class="text-white/70" />
            </div>
            <span :class="['text-xs truncate', currentTrack?.id === item.id ? 'text-cyan-400' : 'text-slate-400']">{{ item.title }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col relative z-0">
      <!-- Close Button -->
      <div class="absolute top-6 left-6 flex items-center gap-4 z-20">
        <button @click="emit('close')" class="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <X :size="20" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
        <div class="max-w-5xl mx-auto flex flex-col gap-8">

          <!-- TAB 1: VOICE FACTORY -->
          <template v-if="activeTab === 'factory'">
            <div class="space-y-1 pl-12">
              <h1 class="text-3xl font-black text-white tracking-tight">声音工厂 <span class="text-slate-500 font-light ml-2 text-xl">Voice Factory</span></h1>
              <p class="text-slate-400 text-sm">Create realistic voiceovers, clone voices, and generate emotional speech.</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div class="lg:col-span-1 flex flex-col gap-6">
                <!-- Voice Clone Upload -->
                <div class="space-y-3">
                  <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Upload :size="12" /> 声音克隆 (参考音频)</h2>
                  <div
                    :class="[
                      'relative h-32 rounded-xl border border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group overflow-hidden',
                      referenceAudio ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10'
                    ]"
                    @click="fileInputRef?.click()"
                  >
                    <input type="file" ref="fileInputRef" class="hidden" accept="audio/*" @change="handleUploadSample" />
                    <template v-if="referenceAudio">
                      <div class="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400"><FileAudio :size="20" /></div>
                      <span class="text-xs font-medium text-cyan-200 truncate max-w-[80%]">{{ referenceFileName }}</span>
                      <button @click="clearReference" class="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-red-500/80 text-white/50 hover:text-white transition-colors"><X :size="10" /></button>
                    </template>
                    <template v-else>
                      <Mic2 :size="24" class="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      <span class="text-xs text-slate-500 group-hover:text-slate-300">点击上传参考音频</span>
                      <span class="text-[9px] text-slate-600 text-center px-4">AI 将模仿此声音朗读文本 (Approximate)</span>
                    </template>
                  </div>
                </div>

                <!-- Emotions -->
                <div class="space-y-3">
                  <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Smile :size="12" /> 情感基调</h2>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      v-for="emo in EMOTIONS"
                      :key="emo.value"
                      @click="selectedEmotion = emo"
                      :class="[
                        'px-3 py-2 rounded-lg text-xs font-medium text-left transition-all',
                        selectedEmotion.value === emo.value ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
                      ]"
                    >
                      {{ emo.label }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="lg:col-span-2 flex flex-col gap-6">
                <!-- Text Input -->
                <div class="relative group flex-1">
                  <div class="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                  <div class="relative bg-[#1c1c1e] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col h-full min-h-[240px]">
                    <textarea
                      v-model="textPrompt"
                      class="w-full flex-1 bg-transparent text-lg text-slate-200 placeholder-slate-600 focus:outline-none resize-none font-medium leading-relaxed"
                      placeholder="在此输入您想生成的语音文本..."
                    />
                    <div class="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                      <div class="flex items-center gap-2">
                        <div v-if="selectedPersona" class="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-[10px] text-purple-300 flex items-center gap-1"><User :size="10" /> {{ selectedPersona.label }}</div>
                        <div v-if="referenceAudio" class="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-[10px] text-cyan-300 flex items-center gap-1"><FileAudio :size="10" /> Custom Clone</div>
                      </div>
                      <button
                        @click="handleGenerateClick"
                        :disabled="!textPrompt.trim() || isGenerating"
                        :class="[
                          'px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2',
                          !textPrompt.trim() || isGenerating ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:scale-105 hover:shadow-cyan-500/25'
                        ]"
                      >
                        <Loader2 v-if="isGenerating" :size="16" class="animate-spin" />
                        <Wand2 v-else :size="16" />
                        {{ isGenerating ? '合成中...' : '生成语音' }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Personas -->
                <div class="space-y-3">
                  <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User :size="12" /> 声音画像 (Personas)</h2>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <button
                      v-for="persona in VOICE_PERSONAS"
                      :key="persona.label"
                      @click="selectedPersona = persona; referenceAudio = null; referenceFileName = null"
                      :class="[
                        'p-3 rounded-xl border text-left transition-all group',
                        selectedPersona?.label === persona.label ? 'bg-purple-500/10 border-purple-500/50' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                      ]"
                    >
                      <div class="flex justify-between items-start mb-1">
                        <span :class="['text-xs font-bold', selectedPersona?.label === persona.label ? 'text-purple-400' : 'text-slate-300']">{{ persona.label }}</span>
                      </div>
                      <p class="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{{ persona.desc }}</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- TAB 2: TRANSCRIBER -->
          <template v-else-if="activeTab === 'transcribe'">
            <div class="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-12">
              <div class="space-y-1">
                <h1 class="text-3xl font-black text-white tracking-tight">语音转文字 <span class="text-slate-500 font-light ml-2 text-xl">Transcriber</span></h1>
                <p class="text-slate-400 text-sm">Accurately transcribe audio files into text using Gemini 2.5.</p>
              </div>

              <div
                :class="[
                  'relative h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:bg-white/5',
                  transcribeFile ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10'
                ]"
                @click="transcribeInputRef?.click()"
              >
                <input type="file" ref="transcribeInputRef" class="hidden" accept="audio/*" @change="handleUploadTranscribe" />
                <template v-if="transcribeFile">
                  <FileAudio :size="48" class="text-cyan-400" />
                  <span class="text-sm font-medium text-cyan-200">{{ transcribeFileName }}</span>
                  <button @click="clearTranscribeFile" class="absolute top-4 right-4 p-2 bg-black/40 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-full"><X :size="16" /></button>
                </template>
                <template v-else>
                  <Upload :size="48" class="text-slate-600" />
                  <div class="text-center">
                    <span class="text-sm font-bold text-slate-400">点击上传音频文件</span>
                    <p class="text-xs text-slate-600 mt-1">支持 MP3, WAV, M4A, AAC</p>
                  </div>
                </template>
              </div>

              <div class="flex justify-center">
                <button
                  @click="handleTranscribeClick"
                  :disabled="!transcribeFile || isTranscribing"
                  :class="[
                    'px-8 py-3 rounded-full font-bold text-sm shadow-lg transition-all flex items-center gap-2',
                    !transcribeFile || isTranscribing ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-cyan-500 text-black hover:scale-105'
                  ]"
                >
                  <Loader2 v-if="isTranscribing" :size="18" class="animate-spin" />
                  <FileText v-else :size="18" />
                  {{ isTranscribing ? '转录中...' : '开始转录' }}
                </button>
              </div>

              <div v-if="transcript" class="bg-[#1c1c1e] border border-white/10 rounded-2xl p-6 relative">
                <button @click="copyTranscript" class="absolute top-4 right-4 p-2 text-slate-500 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg transition-colors" title="复制"><FileText :size="14" /></button>
                <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">转录结果</h3>
                <p class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{{ transcript }}</p>
              </div>
            </div>
          </template>

          <!-- TAB 3: LIVE CONVERSATION -->
          <template v-else-if="activeTab === 'live'">
            <div class="flex flex-col items-center justify-center gap-10 py-10 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-12">
              <div class="space-y-2 text-center">
                <h1 class="text-3xl font-black text-white tracking-tight">实时语音对话 <span class="text-slate-500 font-light ml-2 text-xl">Live</span></h1>
                <p class="text-slate-400 text-sm">Bidirectional real-time conversation with Gemini 2.0 Flash Exp.</p>
              </div>

              <div class="relative w-64 h-64 flex items-center justify-center">
                <!-- Visualizer Rings -->
                <template v-if="isLiveActive">
                  <div class="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping opacity-20" style="animation-duration: 2s" />
                  <div class="absolute inset-4 bg-purple-500/20 rounded-full animate-ping opacity-20" style="animation-duration: 3s; animation-delay: 0.5s" />
                </template>

                <!-- Status Circle -->
                <div
                  :class="[
                    'relative z-10 w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-4',
                    isLiveActive ? 'bg-gradient-to-br from-cyan-900/50 to-purple-900/50 border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.3)]' : 'bg-[#1c1c1e] border-white/10'
                  ]"
                >
                  <Activity :size="48" :class="isLiveActive ? 'text-cyan-400 animate-pulse' : 'text-slate-600'" />
                  <span :class="['text-xs font-bold mt-4 uppercase tracking-widest', isLiveActive ? 'text-cyan-200' : 'text-slate-600']">{{ liveStatus }}</span>
                </div>
              </div>

              <button
                @click="toggleLive"
                :class="[
                  'px-10 py-4 rounded-full font-bold text-base shadow-xl transition-all flex items-center gap-3 hover:scale-105 active:scale-95',
                  isLiveActive ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white' : 'bg-cyan-500 text-black hover:bg-cyan-400'
                ]"
              >
                <X v-if="isLiveActive" :size="20" />
                <Mic2 v-else :size="20" />
                {{ isLiveActive ? '结束对话' : '开始对话' }}
              </button>

              <p class="text-[10px] text-slate-500 max-w-sm text-center">
                Uses Gemini Live API (WebSocket). Please allow microphone access. Ensure you are in a quiet environment for best results.
              </p>
            </div>
          </template>

        </div>
      </div>

      <!-- Player Bar -->
      <div v-if="activeTab === 'factory' || (currentTrack && activeTab !== 'live')" class="h-24 bg-[#121214]/90 backdrop-blur-xl border-t border-white/10 flex items-center px-8 gap-8 relative z-20">
        <!-- Track Info -->
        <div class="w-64 flex items-center gap-4">
          <div :class="['w-14 h-14 rounded-lg bg-gradient-to-br shadow-lg flex items-center justify-center', currentTrack ? getRandomCover(currentTrack.id) : 'from-slate-700 to-slate-800']">
            <Mic2 v-if="currentTrack" :size="24" class="text-white/80" />
            <Disc v-else :size="24" class="text-slate-500" />
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-white truncate">{{ currentTrack?.title || 'Ready to speak' }}</span>
            <span class="text-xs text-slate-500">Voice Factory AI</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex-1 flex flex-col items-center gap-2 max-w-2xl mx-auto">
          <div class="flex items-center gap-6">
            <button
              @click="togglePlay"
              :disabled="!currentTrack"
              :class="['w-10 h-10 rounded-full flex items-center justify-center transition-all', currentTrack ? 'bg-white text-black hover:scale-110' : 'bg-white/10 text-slate-600']"
            >
              <Pause v-if="isPlaying" :size="20" fill="currentColor" />
              <Play v-else :size="20" fill="currentColor" class="ml-0.5" />
            </button>
          </div>
          <div class="w-full flex items-center gap-3 text-[10px] font-mono text-slate-500">
            <span>{{ formatTime(currentTime) }}</span>
            <div class="flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden group/bar cursor-pointer">
              <div class="absolute top-0 left-0 h-full bg-cyan-500 rounded-full" :style="{ width: `${(currentTime / (duration || 1)) * 100}%` }" />
            </div>
            <span>{{ formatTime(duration) }}</span>
          </div>
        </div>

        <!-- Volume -->
        <div class="w-64 flex items-center justify-end gap-4">
          <div class="flex items-center gap-2 group/vol">
            <Volume2 :size="16" class="text-slate-400" />
            <div class="w-20 h-1 bg-white/10 rounded-full relative cursor-pointer">
              <div class="absolute top-0 left-0 h-full bg-slate-400 group-hover/vol:bg-white rounded-full" :style="{ width: `${volume * 100}%` }" />
            </div>
          </div>
          <button class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><Download :size="18" /></button>
        </div>

        <audio ref="audioRef" @timeupdate="handleTimeUpdate" @ended="handleEnded" @loadedmetadata="handleTimeUpdate" />
      </div>
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

.animate-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

