<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Save, Key, ExternalLink } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const polloKey = ref('')
const isSaved = ref(false)

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      const stored = localStorage.getItem('pollo_api_key')
      if (stored) polloKey.value = stored
    }
  },
  { immediate: true }
)

const handleSave = () => {
  localStorage.setItem('pollo_api_key', polloKey.value.trim())
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
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
    @click="handleBackdropClick"
  >
    <div
      class="w-[480px] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      @click="handleContentClick"
    >
      <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
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

      <div class="p-6 space-y-6">
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
            用于激活 <strong>Wan 2.1 / Wan 2.5</strong> 视频生成模型。密钥仅保存在您的浏览器本地存储中，不会上传至 SunStudio 服务器。
          </p>
        </div>
      </div>

      <div class="p-4 border-t border-white/5 bg-[#121214] flex justify-end">
        <button
          @click="handleSave"
          :class="[
            'px-6 py-2 rounded-xl text-xs font-bold transition-all',
            isSaved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-cyan-400',
          ]"
        >
          {{ isSaved ? '已保存' : '保存设置' }}
        </button>
      </div>
    </div>
  </div>
</template>

