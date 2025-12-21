<script setup lang="ts">
import { X, MapPin, Check } from 'lucide-vue-next'
import type { StoryScene } from '../../types'

interface Props {
  isOpen: boolean
  scenes: StoryScene[]
  selectedCount: number
  selectedSceneId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'update:selectedSceneId': [value: string | null]
  'apply': []
}>()
</script>

<template>
  <Transition name="dropdown">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="emit('update:isOpen', false)"
    >
      <div class="w-[500px] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl p-6" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <MapPin :size="20" class="text-emerald-400" />
            批量设置场景
          </h3>
          <button @click="emit('update:isOpen', false)" class="p-1 hover:bg-white/10 rounded-lg">
            <X :size="18" class="text-slate-400" />
          </button>
        </div>

        <p class="text-xs text-slate-500 mb-4">
          为选中的 <strong class="text-white">{{ selectedCount }}</strong> 个分镜设置场景
        </p>

        <div class="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar mb-4">
          <!-- 无场景选项 -->
          <div
            class="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors"
            :class="selectedSceneId === null ? 'bg-slate-500/20 ring-1 ring-slate-500/50' : 'hover:bg-white/5'"
            @click="emit('update:selectedSceneId', null)"
          >
            <div class="w-12 h-12 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center">
              <X :size="20" class="text-slate-500" />
            </div>
            <div class="flex-1">
              <span class="text-sm text-slate-400">无场景</span>
              <p class="text-[10px] text-slate-600">清除场景关联</p>
            </div>
            <Check v-if="selectedSceneId === null" :size="16" class="text-slate-400" />
          </div>

          <!-- 场景列表 -->
          <div
            v-for="scene in scenes"
            :key="scene.id"
            class="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors"
            :class="selectedSceneId === scene.id ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'hover:bg-white/5'"
            @click="emit('update:selectedSceneId', scene.id)"
          >
            <!-- 场景缩略图 -->
            <div class="w-12 h-12 rounded-lg overflow-hidden bg-black/30 border border-white/10 flex-shrink-0">
              <img
                v-if="scene.image"
                :src="scene.image"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <div
                  class="w-6 h-6 rounded-full"
                  :style="{ backgroundColor: scene.color }"
                />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: scene.color }"
                />
                <span class="text-sm text-white font-medium truncate">{{ scene.name }}</span>
              </div>
              <p class="text-[10px] text-slate-500 truncate mt-0.5">{{ scene.description || '暂无描述' }}</p>
            </div>
            <Check v-if="selectedSceneId === scene.id" :size="16" class="text-emerald-400 flex-shrink-0" />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button
            @click="emit('update:isOpen', false)"
            class="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            @click="emit('apply')"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            应用
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

