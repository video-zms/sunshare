<script setup lang="ts">
import { X, Users, User, Check } from 'lucide-vue-next'
import type { StoryCharacter } from '../../types'

interface Props {
  isOpen: boolean
  characters: StoryCharacter[]
  selectedCount: number
  selectedCharacterIds: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'toggle-character': [id: string]
  'apply': [mode: 'replace' | 'add']
}>()
</script>

<template>
  <Transition name="dropdown">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="emit('update:isOpen', false)"
    >
      <div class="w-[520px] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl p-6" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Users :size="20" class="text-purple-400" />
            批量设置人物
          </h3>
          <button @click="emit('update:isOpen', false)" class="p-1 hover:bg-white/10 rounded-lg">
            <X :size="18" class="text-slate-400" />
          </button>
        </div>

        <p class="text-xs text-slate-500 mb-4">
          为选中的 <strong class="text-white">{{ selectedCount }}</strong> 个分镜设置人物（可多选）
        </p>

        <div class="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar mb-4 pr-1">
          <div
            v-for="char in characters"
            :key="char.id"
            class="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors"
            :class="selectedCharacterIds.has(char.id) ? 'bg-purple-500/20 ring-1 ring-purple-500/50' : 'hover:bg-white/5 bg-white/[0.02]'"
            @click="emit('toggle-character', char.id)"
          >
            <!-- 人物头像 -->
            <div class="relative flex-shrink-0">
              <div class="w-10 h-10 rounded-full overflow-hidden bg-black/30 border border-white/10">
                <img
                  v-if="char.image"
                  :src="char.image"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <User :size="18" class="text-slate-600" />
                </div>
              </div>
              <!-- 颜色标识 -->
              <div
                class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1c1c1e]"
                :style="{ backgroundColor: char.color }"
              />
            </div>
            
            <div class="flex-1 min-w-0">
              <span class="text-sm text-white font-medium truncate block">{{ char.name }}</span>
              <p class="text-[10px] text-slate-500 truncate">{{ char.description || '暂无描述' }}</p>
            </div>

            <!-- 选中状态 -->
            <div
              :class="[
                'w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                selectedCharacterIds.has(char.id) 
                  ? 'bg-purple-500 border-purple-500' 
                  : 'border-white/20'
              ]"
            >
              <Check v-if="selectedCharacterIds.has(char.id)" :size="12" class="text-white" />
            </div>
          </div>
          
          <div v-if="characters.length === 0" class="col-span-2 text-center py-12 text-slate-600 text-sm">
            暂无人物，请先添加
          </div>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-xs text-slate-500">
            已选择 <strong class="text-purple-400">{{ selectedCharacterIds.size }}</strong> 个人物
          </span>
          <div class="flex gap-2">
            <button
              @click="emit('update:isOpen', false)"
              class="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              @click="emit('apply', 'add')"
              :disabled="selectedCharacterIds.size === 0"
              class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              追加
            </button>
            <button
              @click="emit('apply', 'replace')"
              class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              替换
            </button>
          </div>
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

