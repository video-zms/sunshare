<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Save, Key, ExternalLink, Bot, ChevronDown, Check, Image, Video } from 'lucide-vue-next'
import SelectDropdown from './storyboard/SelectDropdown.vue'
import { LLM_PROVIDERS, type LLMProvider, type LLMProviderConfig, type ImageGenConfig, type VideoGenConfig, type SoraVideoGenConfig } from '../types'
import { 
  saveLLMConfig, 
  getLLMConfig, 
  clearModelCache,
  getImageGenConfig,
  saveImageGenConfig,
  getVideoGenConfig,
  saveVideoGenConfig,
  getSoraVideoGenConfig,
  saveSoraVideoGenConfig
} from '../services/geminiService'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// Pollo API Key
const polloKey = ref('')

// LLM 配置
const selectedProvider = ref<LLMProvider>('gemini')
const apiKey = ref('')
const baseUrl = ref('')
const selectedModel = ref('')

// 图片生成配置
const imageGenEnabled = ref(false)
const imageGenApiKey = ref('')
const imageGenBaseUrl = ref('')
const imageGenModel = ref('gemini-2.5-flash-image')

// 视频生成配置
const videoGenEnabled = ref(false)
const videoGenApiKey = ref('')
const videoGenBaseUrl = ref('')
const videoGenModel = ref('veo-3.1-fast-generate-preview')

// Sora 视频生成配置（专门用于 multipart/form-data 格式的 API）
const soraVideoGenEnabled = ref(false)
const soraVideoGenApiKey = ref('')
const soraVideoGenBaseUrl = ref('')
const soraVideoGenModel = ref('sora-2')

const isSaved = ref(false)

// 当前选中的提供商信息
const currentProviderInfo = computed(() => {
  return LLM_PROVIDERS.find(p => p.id === selectedProvider.value)
})

// 可用的模型列表
const availableModels = computed(() => {
  return currentProviderInfo.value?.models || []
})

// 加载已保存的配置
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      // 加载 Pollo Key
      const storedPolloKey = localStorage.getItem('pollo_api_key')
      if (storedPolloKey) polloKey.value = storedPolloKey

      // 加载 LLM 配置
      const config = getLLMConfig()
      selectedProvider.value = config.provider
      apiKey.value = config.apiKey
      baseUrl.value = config.baseUrl || ''
      selectedModel.value = config.model || ''

      // 加载图片生成配置
      const imageGenConfig = getImageGenConfig()
      imageGenEnabled.value = imageGenConfig.enabled
      imageGenApiKey.value = imageGenConfig.apiKey
      imageGenBaseUrl.value = imageGenConfig.baseUrl || ''
      imageGenModel.value = imageGenConfig.model || 'gemini-2.5-flash-image'

      // 加载视频生成配置
      const videoGenConfig = getVideoGenConfig()
      videoGenEnabled.value = videoGenConfig.enabled
      videoGenApiKey.value = videoGenConfig.apiKey
      videoGenBaseUrl.value = videoGenConfig.baseUrl || ''
      videoGenModel.value = videoGenConfig.model || 'veo-3.1-fast-generate-preview'

      // 加载 Sora 视频生成配置
      const soraVideoGenConfig = getSoraVideoGenConfig()
      soraVideoGenEnabled.value = soraVideoGenConfig.enabled
      soraVideoGenApiKey.value = soraVideoGenConfig.apiKey
      soraVideoGenBaseUrl.value = soraVideoGenConfig.baseUrl || ''
      soraVideoGenModel.value = soraVideoGenConfig.model || 'sora-2'
    }
  },
  { immediate: true }
)

// 当提供商变化时，重置模型选择
watch(selectedProvider, (newProvider) => {
  const providerInfo = LLM_PROVIDERS.find(p => p.id === newProvider)
  if (providerInfo && providerInfo.models.length > 0) {
    selectedModel.value = providerInfo.models[0].id
  } else {
    selectedModel.value = ''
  }
  
  // 重置 baseUrl（除非是自定义提供商）
  if (newProvider !== 'custom') {
    baseUrl.value = ''
  }
})

const handleProviderChange = (providerId: string | string[] | undefined) => {
  selectedProvider.value = (Array.isArray(providerId) ? providerId[0] : providerId) as LLMProvider
}

const handleModelChange = (modelId: string | string[] | undefined) => {
  selectedModel.value = Array.isArray(modelId) ? modelId[0] : (modelId || '')
}

const handleSave = () => {
  // 保存 Pollo Key
  localStorage.setItem('pollo_api_key', polloKey.value.trim())

  // 保存 LLM 配置
  const config: LLMProviderConfig = {
    provider: selectedProvider.value,
    apiKey: apiKey.value.trim(),
    baseUrl: baseUrl.value.trim() || undefined,
    model: selectedModel.value || undefined
  }
  saveLLMConfig(config)
  clearModelCache() // 清除缓存以使用新配置

  // 保存图片生成配置
  const imageGenConfig: ImageGenConfig = {
    enabled: imageGenEnabled.value,
    apiKey: imageGenApiKey.value.trim(),
    baseUrl: imageGenBaseUrl.value.trim() || undefined,
    model: imageGenModel.value.trim() || undefined
  }
  saveImageGenConfig(imageGenConfig)

  // 保存视频生成配置
  const videoGenConfig: VideoGenConfig = {
    enabled: videoGenEnabled.value,
    apiKey: videoGenApiKey.value.trim(),
    baseUrl: videoGenBaseUrl.value.trim() || undefined,
    model: videoGenModel.value.trim() || undefined
  }
  saveVideoGenConfig(videoGenConfig)

  // 保存 Sora 视频生成配置
  const soraVideoGenConfig: SoraVideoGenConfig = {
    enabled: soraVideoGenEnabled.value,
    apiKey: soraVideoGenApiKey.value.trim(),
    baseUrl: soraVideoGenBaseUrl.value.trim() || undefined,
    model: soraVideoGenModel.value.trim() || undefined
  }
  saveSoraVideoGenConfig(soraVideoGenConfig)

  isSaved.value = true
  setTimeout(() => (isSaved.value = false), 2000)
  setTimeout(() => emit('close'), 500)
}

const handleBackdropClick = () => {
  emit('close')
}

const handleContentClick = (e: Event) => {
  e.stopPropagation()
}

// 获取提供商的获取 Key 链接
const getProviderKeyLink = (provider: LLMProvider): string => {
  const links: Record<LLMProvider, string> = {
    gemini: 'https://aistudio.google.com/apikey',
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    deepseek: 'https://platform.deepseek.com/api_keys',
    custom: ''
  }
  return links[provider]
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
    @click="handleBackdropClick"
  >
    <div
      class="w-[520px] max-h-[90vh] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
      @click="handleContentClick"
    >
      <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
        <button @click="emit('close')" class="text-slate-500 hover:text-white transition-colors">
          <X :size="18" />
        </button>
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-slate-700/50 rounded-lg">
            <Key :size="16" class="text-white" />
          </div>
          <span class="text-sm font-bold text-white">设置 (Settings)</span>
        </div>
      </div>

      <div class="p-6 space-y-6 overflow-y-auto flex-1">
        <!-- LLM 提供商设置 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <Bot :size="18" class="text-cyan-400" />
            <span class="text-sm font-bold text-white">AI 模型配置</span>
          </div>

          <!-- 提供商选择 -->
          <div class="space-y-2">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">模型提供商</label>
            <SelectDropdown
              :options="LLM_PROVIDERS"
              :model-value="selectedProvider"
              placeholder="选择提供商"
              dropdown-width="100%"
              hover-border-color="cyan-500"
              active-color="emerald"
              @update:model-value="handleProviderChange"
            >
              <template #option="{ option, isSelected }">
                <div class="flex-1">
                  <div class="text-sm text-white">{{ option.name }}</div>
                  <div class="text-xs text-slate-500">{{ (option as any).description }}</div>
                </div>
                <Check v-if="isSelected" :size="16" class="text-cyan-400 ml-auto" />
              </template>
            </SelectDropdown>
          </div>

          <!-- API Key -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">API Key</label>
              <a
                v-if="getProviderKeyLink(selectedProvider)"
                :href="getProviderKeyLink(selectedProvider)"
                target="_blank"
                rel="noreferrer"
                class="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <span>获取 Key</span>
                <ExternalLink :size="10" />
              </a>
            </div>
            <input
              type="password"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
              placeholder="输入 API Key..."
              v-model="apiKey"
            />
          </div>

          <!-- Base URL (可选) -->
          <div class="space-y-2">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Base URL <span class="text-slate-600">(可选，用于自定义代理)</span>
            </label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
              placeholder="https://api.example.com/v1"
              v-model="baseUrl"
            />
          </div>

          <!-- 模型选择 -->
          <div class="space-y-2" v-if="availableModels.length > 0">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">模型</label>
            <SelectDropdown
              :options="availableModels"
              :model-value="selectedModel"
              placeholder="选择模型"
              dropdown-width="100%"
              hover-border-color="cyan-500"
              active-color="emerald"
              @update:model-value="handleModelChange"
            >
              <template #option="{ option, isSelected }">
                <div class="flex-1">
                  <div class="text-sm text-white">{{ option.name }}</div>
                  <div v-if="(option as any).supportsVision" class="text-xs text-emerald-400">支持视觉</div>
                </div>
                <Check v-if="isSelected" :size="16" class="text-cyan-400 ml-auto" />
              </template>
            </SelectDropdown>
          </div>

          <!-- 自定义模型名称 -->
          <div class="space-y-2" v-if="selectedProvider === 'custom'">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">模型名称</label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
              placeholder="gpt-4o / claude-3-opus..."
              v-model="selectedModel"
            />
          </div>

          <p class="text-[11px] text-slate-500 leading-relaxed">
            选择您的 AI 模型提供商。支持 Google Gemini、OpenAI、Anthropic Claude、DeepSeek 等主流模型。
            密钥仅保存在浏览器本地存储中。
          </p>
        </div>

        <div class="border-t border-white/5 pt-6"></div>

        <!-- 图片生成配置 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <Image :size="18" class="text-purple-400" />
            <span class="text-sm font-bold text-white">图片生成配置</span>
          </div>

          <!-- 启用独立配置开关 -->
          <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/10">
            <div>
              <div class="text-sm text-white font-medium">使用独立的 API Key</div>
              <div class="text-xs text-slate-500 mt-0.5">为图片生成配置专用的 API Key</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="imageGenEnabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            </label>
          </div>

          <!-- 图片生成 API Key -->
          <div class="space-y-2" v-if="imageGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">图片生成 API Key</label>
            <input
              type="password"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              placeholder="输入图片生成专用的 API Key..."
              v-model="imageGenApiKey"
            />
          </div>

          <!-- 图片生成 Base URL -->
          <div class="space-y-2" v-if="imageGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Base URL <span class="text-slate-600">(可选)</span>
            </label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              placeholder="https://api.example.com/v1"
              v-model="imageGenBaseUrl"
            />
          </div>

          <!-- 图片生成模型 -->
          <div class="space-y-2" v-if="imageGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">模型名称</label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
              placeholder="gemini-2.5-flash-image"
              v-model="imageGenModel"
            />
          </div>

          <p class="text-[11px] text-slate-500 leading-relaxed" v-if="imageGenEnabled">
            配置图片生成专用的 API Key。如果未启用，将使用上方 AI 模型配置中的 API Key。
          </p>
        </div>

        <div class="border-t border-white/5 pt-6"></div>

        <!-- 视频生成配置 -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <Video :size="18" class="text-pink-400" />
            <span class="text-sm font-bold text-white">视频生成配置</span>
          </div>

          <!-- 启用独立配置开关 -->
          <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/10">
            <div>
              <div class="text-sm text-white font-medium">使用独立的 API Key</div>
              <div class="text-xs text-slate-500 mt-0.5">为视频生成配置专用的 API Key</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="videoGenEnabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>

          <!-- 视频生成 API Key -->
          <div class="space-y-2" v-if="videoGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">视频生成 API Key</label>
            <input
              type="password"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50 transition-colors font-mono"
              placeholder="输入视频生成专用的 API Key..."
              v-model="videoGenApiKey"
            />
          </div>

          <!-- 视频生成 Base URL -->
          <div class="space-y-2" v-if="videoGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Base URL <span class="text-slate-600">(可选)</span>
            </label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50 transition-colors font-mono"
              placeholder="https://api.example.com/v1"
              v-model="videoGenBaseUrl"
            />
          </div>

          <!-- 视频生成模型 -->
          <div class="space-y-2" v-if="videoGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">模型名称</label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50 transition-colors font-mono"
              placeholder="veo-3.1-fast-generate-preview"
              v-model="videoGenModel"
            />
          </div>

          <p class="text-[11px] text-slate-500 leading-relaxed" v-if="videoGenEnabled">
            配置视频生成专用的 API Key。如果未启用，将使用上方 AI 模型配置中的 API Key。
          </p>
        </div>

        <div class="border-t border-white/5 pt-6"></div>

        <!-- Sora 视频生成配置（multipart/form-data 格式） -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <Video :size="18" class="text-emerald-400" />
            <span class="text-sm font-bold text-white">Sora 视频生成配置</span>
          </div>

          <!-- 启用独立配置开关 -->
          <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/10">
            <div>
              <div class="text-sm text-white font-medium">使用独立的 API Key</div>
              <div class="text-xs text-slate-500 mt-0.5">为 Sora 视频生成（multipart/form-data 格式）配置专用的 API Key</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="soraVideoGenEnabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <!-- Sora 视频生成 API Key -->
          <div class="space-y-2" v-if="soraVideoGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sora 视频生成 API Key</label>
            <input
              type="password"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              placeholder="输入 Sora 视频生成专用的 API Key..."
              v-model="soraVideoGenApiKey"
            />
          </div>

          <!-- Sora 视频生成 Base URL -->
          <div class="space-y-2" v-if="soraVideoGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Base URL <span class="text-slate-600">(可选)</span>
            </label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              placeholder="https://xxxxx/v1/videos"
              v-model="soraVideoGenBaseUrl"
            />
          </div>

          <!-- Sora 视频生成模型 -->
          <div class="space-y-2" v-if="soraVideoGenEnabled">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">模型名称</label>
            <input
              type="text"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              placeholder="sora-2"
              v-model="soraVideoGenModel"
            />
          </div>

          <p class="text-[11px] text-slate-500 leading-relaxed" v-if="soraVideoGenEnabled">
            配置 Sora 视频生成专用的 API Key（使用 multipart/form-data 格式）。如果未启用，将使用上方 AI 模型配置中的 API Key。
          </p>
        </div>

        <div class="border-t border-white/5 pt-6"></div>

        <!-- Pollo API Key 设置 -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pollo.ai API Key (Wan 2.5)</label>
            <a
              href="https://pollo.ai/dashboard/api-keys"
              target="_blank"
              rel="noreferrer"
              class="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span>获取 Key</span>
              <ExternalLink :size="10" />
            </a>
          </div>

          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span class="text-slate-500 font-mono text-xs">key-</span>
            </div>
            <input
              type="password"
              autocomplete="off"
              class="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
              placeholder="粘贴您的 Pollo API Key..."
              v-model="polloKey"
            />
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed">
            用于激活 <strong>Wan 2.1 / Wan 2.5</strong> 视频生成模型。
          </p>
        </div>
      </div>

      <div class="p-4 border-t border-white/5 bg-[#121214] flex justify-end shrink-0">
        <button
          @click="handleSave"
          :class="[
            'px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
            isSaved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-cyan-400',
          ]"
        >
          <Save :size="14" />
          {{ isSaved ? '已保存' : '保存设置' }}
        </button>
      </div>
    </div>
  </div>
</template>
