<script setup lang="ts">
import { Upload, Clock, Sparkles, Loader2, Copy, Trash2, ImageIcon } from 'lucide-vue-next'
import UploadButton from '../common/UploadButton.vue'
import type { StoryboardShot, StoryScene, StoryCharacter } from '../../types'

interface Props {
  shot: StoryboardShot
  scenes: StoryScene[]
  characters: StoryCharacter[]
  isSelected: boolean
  isGenerating: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-select': []
  'image-upload': [e: Event]
  'generate-image': []
  'generate-from-ai': []
  'duplicate': []
  'delete': []
}>()

const getSceneById = (id?: string) => {
  if (!id) return null
  return props.scenes.find(s => s.id === id) || null
}

const getCharacterById = (id: string) => {
  return props.characters.find(c => c.id === id) || null
}
</script>

<template>
  <div
    :class="[
      'group relative rounded-2xl border overflow-hidden transition-all cursor-pointer hover:scale-[1.02]',
      isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-white/10 hover:border-white/20'
    ]"
    @click="emit('toggle-select')"
  >
    <!-- Image -->
    <div class="aspect-video bg-[#1c1c1e] relative">
      <img
        v-if="shot.sceneImage"
        :src="shot.sceneImage"
        class="w-full h-full object-cover"
      />
      <UploadButton
        v-else
        mode="empty"
        accept="image/*"
        :empty-config="{
          width: '100%',
          height: '100%',
          iconSize: 24,
          text: '上传分镜图',
          backgroundColor: 'bg-transparent'
        }"
        custom-class="w-full h-full"
        @change="(e) => emit('image-upload', e)"
      />

      <!-- Shot Number Badge -->
      <div class="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center text-xs font-bold">
        {{ shot.shotNumber }}
      </div>

      <!-- Duration Badge -->
      <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium flex items-center gap-1">
        <Clock :size="10" />
        {{ shot.duration }}s
      </div>
    </div>

    <!-- Info -->
    <div class="p-3 bg-[#18181b]">
      <div class="flex items-center gap-2 text-[10px] text-slate-500 mb-2 flex-wrap">
        <span class="px-1.5 py-0.5 bg-white/5 rounded">{{ shot.sceneType }}</span>
        <span class="px-1.5 py-0.5 bg-white/5 rounded">{{ shot.cameraMovement }}</span>
        <!-- Scene badge -->
        <span
          v-if="shot.sceneId && getSceneById(shot.sceneId)"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded"
          :style="{ backgroundColor: getSceneById(shot.sceneId)?.color + '30' }"
        >
          <div
            class="w-2 h-2 rounded-full"
            :style="{ backgroundColor: getSceneById(shot.sceneId)?.color }"
          />
          <span :style="{ color: getSceneById(shot.sceneId)?.color }">{{ getSceneById(shot.sceneId)?.name }}</span>
        </span>
      </div>
      <!-- Characters -->
      <div v-if="shot.characterIds && shot.characterIds.length > 0" class="flex items-center gap-1 mb-2 flex-wrap">
        <div
          v-for="charId in shot.characterIds.slice(0, 2)"
          :key="charId"
          class="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-slate-400"
        >
          <div
            class="w-2 h-2 rounded-full"
            :style="{ backgroundColor: getCharacterById(charId)?.color }"
          />
          <span>{{ getCharacterById(charId)?.name }}</span>
        </div>
        <span v-if="shot.characterIds.length > 2" class="text-[10px] text-slate-600">
          +{{ shot.characterIds.length - 2 }}
        </span>
      </div>
      <p class="text-xs text-slate-300 line-clamp-2">
        {{ shot.description || '暂无描述' }}
      </p>
    </div>

    <!-- Hover Actions -->
    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
      <button
        @click.stop="emit('generate-image')"
        :disabled="isGenerating"
        class="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl text-cyan-300 transition-colors disabled:opacity-50"
        :title="shot.sceneImage ? '重新生成分镜图' : '生成分镜图'"
      >
        <Loader2 v-if="isGenerating" :size="16" class="animate-spin" />
        <ImageIcon v-else :size="16" />
      </button>
      <button
        @click.stop="emit('generate-from-ai')"
        class="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-300 transition-colors"
        title="AI分析"
      >
        <Sparkles :size="16" />
      </button>
      <button
        @click.stop="emit('duplicate')"
        class="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
        title="复制"
      >
        <Copy :size="16" />
      </button>
      <button
        @click.stop="emit('delete')"
        class="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 transition-colors"
        title="删除"
      >
        <Trash2 :size="16" />
      </button>
    </div>
  </div>
</template>

