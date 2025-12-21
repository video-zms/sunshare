<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Images, Brush, ImageIcon, LayoutGrid, MapPin, Users, Package, Check, Loader2, Sparkles, User } from 'lucide-vue-next'
import { ChevronDown } from 'lucide-vue-next'
import type { StoryScene, StoryCharacter, StoryProp, ArtStyle } from '../../types'
import { ART_STYLES } from '../../types'

interface Props {
  isOpen: boolean
  scenes: StoryScene[]
  characters: StoryCharacter[]
  storyProps: StoryProp[]
  isGenerating: boolean
  progress: { completed: number; total: number; currentItem: string }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'generate': [config: {
    type: 'scenes' | 'characters' | 'props' | 'all'
    artStyle: ArtStyle
    model: string
    selectedScenes: Set<string>
    selectedCharacters: Set<string>
    selectedProps: Set<string>
  }]
}>()

const batchGenerateType = ref<'scenes' | 'characters' | 'props' | 'all'>('all')
const batchSelectedArtStyle = ref<ArtStyle>(ART_STYLES[0])
const batchGenerateSelectedScenes = ref<Set<string>>(new Set())
const batchGenerateSelectedCharacters = ref<Set<string>>(new Set())
const batchGenerateSelectedProps = ref<Set<string>>(new Set())
const batchSelectedModel = ref('gemini-2.5-flash-image')
const showModelDropdown = ref(false)

const imageGenModels = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-image' },
  { label: 'Gemini 3 Pro', value: 'gemini-3-pro-image-preview' },
  { label: 'Imagen 3.0', value: 'imagen-3.0-generate-002' }
]

// 初始化选择
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    batchGenerateSelectedScenes.value = new Set(props.scenes.map(s => s.id))
    batchGenerateSelectedCharacters.value = new Set(props.characters.map(c => c.id))
    batchGenerateSelectedProps.value = new Set(props.storyProps.map(p => p.id))
    showModelDropdown.value = false
  }
})

const toggleBatchGenerateScene = (sceneId: string) => {
  if (batchGenerateSelectedScenes.value.has(sceneId)) {
    batchGenerateSelectedScenes.value.delete(sceneId)
  } else {
    batchGenerateSelectedScenes.value.add(sceneId)
  }
  batchGenerateSelectedScenes.value = new Set(batchGenerateSelectedScenes.value)
}

const toggleBatchGenerateCharacter = (characterId: string) => {
  if (batchGenerateSelectedCharacters.value.has(characterId)) {
    batchGenerateSelectedCharacters.value.delete(characterId)
  } else {
    batchGenerateSelectedCharacters.value.add(characterId)
  }
  batchGenerateSelectedCharacters.value = new Set(batchGenerateSelectedCharacters.value)
}

const toggleBatchGenerateProp = (propId: string) => {
  if (batchGenerateSelectedProps.value.has(propId)) {
    batchGenerateSelectedProps.value.delete(propId)
  } else {
    batchGenerateSelectedProps.value.add(propId)
  }
  batchGenerateSelectedProps.value = new Set(batchGenerateSelectedProps.value)
}

const toggleAllScenes = () => {
  if (batchGenerateSelectedScenes.value.size === props.scenes.length) {
    batchGenerateSelectedScenes.value = new Set()
  } else {
    batchGenerateSelectedScenes.value = new Set(props.scenes.map(s => s.id))
  }
}

const toggleAllCharacters = () => {
  if (batchGenerateSelectedCharacters.value.size === props.characters.length) {
    batchGenerateSelectedCharacters.value = new Set()
  } else {
    batchGenerateSelectedCharacters.value = new Set(props.characters.map(c => c.id))
  }
}

const toggleAllProps = () => {
  if (batchGenerateSelectedProps.value.size === props.storyProps.length) {
    batchGenerateSelectedProps.value = new Set()
  } else {
    batchGenerateSelectedProps.value = new Set(props.storyProps.map(p => p.id))
  }
}

const batchGenerateItemCount = computed(() => {
  let count = 0
  if (batchGenerateType.value === 'scenes' || batchGenerateType.value === 'all') {
    count += batchGenerateSelectedScenes.value.size
  }
  if (batchGenerateType.value === 'characters' || batchGenerateType.value === 'all') {
    count += batchGenerateSelectedCharacters.value.size
  }
  if (batchGenerateType.value === 'props' || batchGenerateType.value === 'all') {
    count += batchGenerateSelectedProps.value.size
  }
  return count
})

const handleGenerate = () => {
  emit('generate', {
    type: batchGenerateType.value,
    artStyle: batchSelectedArtStyle.value,
    model: batchSelectedModel.value,
    selectedScenes: batchGenerateSelectedScenes.value,
    selectedCharacters: batchGenerateSelectedCharacters.value,
    selectedProps: batchGenerateSelectedProps.value
  })
}
</script>

<template>
  <Transition name="dropdown">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="!isGenerating && emit('update:isOpen', false); showModelDropdown = false"
    >
      <div class="w-[700px] max-h-[85vh] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden" @click.stop>
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Images :size="20" class="text-purple-400" />
            AI批量生成图片
          </h3>
          <button 
            @click="!isGenerating && emit('update:isOpen', false)" 
            :disabled="isGenerating"
            class="p-1 hover:bg-white/10 rounded-lg disabled:opacity-50"
          >
            <X :size="18" class="text-slate-400" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <!-- 画风选择 -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <Brush :size="16" class="text-pink-400" />
              <span class="text-sm font-medium text-white">选择画风</span>
            </div>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="style in ART_STYLES"
                :key="style.id"
                @click="batchSelectedArtStyle = style"
                :class="[
                  'relative px-3 py-3 rounded-xl text-xs font-medium transition-all text-left',
                  batchSelectedArtStyle.id === style.id 
                    ? 'ring-2 ring-offset-2 ring-offset-[#1c1c1e]' 
                    : 'hover:bg-white/5 bg-white/[0.02]'
                ]"
                :style="{ 
                  backgroundColor: batchSelectedArtStyle.id === style.id ? style.previewColor + '30' : undefined,
                  '--tw-ring-color': style.previewColor
                }"
              >
                <div 
                  class="w-3 h-3 rounded-full mb-2"
                  :style="{ backgroundColor: style.previewColor }"
                />
                <div class="text-white font-medium truncate">{{ style.name }}</div>
                <div class="text-slate-500 text-[10px] truncate mt-0.5">{{ style.description }}</div>
              </button>
            </div>
          </div>

          <!-- 模型选择 -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <ImageIcon :size="16" class="text-blue-400" />
              <span class="text-sm font-medium text-white">选择模型</span>
            </div>
            <div class="relative">
              <button
                @click="showModelDropdown = !showModelDropdown"
                class="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:border-blue-500/50 transition-colors"
              >
                <span>{{ imageGenModels.find(m => m.value === batchSelectedModel)?.label || batchSelectedModel }}</span>
                <ChevronDown :size="16" class="text-slate-500 transition-transform" :class="{ 'rotate-180': showModelDropdown }" />
              </button>
              <Transition name="dropdown">
                <div
                  v-if="showModelDropdown"
                  class="absolute top-full left-0 mt-1 w-full bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl z-50"
                  @click.stop
                >
                  <div
                    v-for="model in imageGenModels"
                    :key="model.value"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-white/10',
                      batchSelectedModel === model.value ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300'
                    ]"
                    @click="batchSelectedModel = model.value; showModelDropdown = false"
                  >
                    <span class="truncate flex-1">{{ model.label }}</span>
                    <Check v-if="batchSelectedModel === model.value" :size="14" class="text-blue-400" />
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 生成类型选择 -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <LayoutGrid :size="16" class="text-cyan-400" />
              <span class="text-sm font-medium text-white">生成范围</span>
            </div>
            <div class="flex gap-2">
              <button
                @click="batchGenerateType = 'all'"
                :class="[
                  'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  batchGenerateType === 'all' 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-purple-500/20 text-white ring-1 ring-white/20' 
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                ]"
              >
                全部（场景 + 人物 + 道具）
              </button>
              <button
                @click="batchGenerateType = 'scenes'"
                :class="[
                  'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  batchGenerateType === 'scenes' 
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' 
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                ]"
              >
                仅场景
              </button>
              <button
                @click="batchGenerateType = 'characters'"
                :class="[
                  'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  batchGenerateType === 'characters' 
                    ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' 
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                ]"
              >
                仅人物
              </button>
              <button
                @click="batchGenerateType = 'props'"
                :class="[
                  'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  batchGenerateType === 'props' 
                    ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30' 
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                ]"
              >
                仅道具
              </button>
            </div>
          </div>

          <!-- 场景选择 -->
          <div v-if="batchGenerateType === 'scenes' || batchGenerateType === 'all'">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <MapPin :size="16" class="text-emerald-400" />
                <span class="text-sm font-medium text-white">选择场景</span>
                <span class="text-xs text-slate-500">({{ batchGenerateSelectedScenes.size }}/{{ scenes.length }})</span>
              </div>
              <button
                @click="toggleAllScenes"
                class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {{ batchGenerateSelectedScenes.size === scenes.length ? '取消全选' : '全选' }}
              </button>
            </div>
            <div class="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
              <div
                v-for="scene in scenes"
                :key="scene.id"
                @click="toggleBatchGenerateScene(scene.id)"
                :class="[
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                  batchGenerateSelectedScenes.has(scene.id) 
                    ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' 
                    : 'bg-white/[0.02] hover:bg-white/5'
                ]"
              >
                <div
                  class="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden border border-white/10"
                  :style="{ backgroundColor: scene.color + '30' }"
                >
                  <img v-if="scene.image" :src="scene.image" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: scene.color }" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-white font-medium truncate">{{ scene.name }}</div>
                  <div class="text-[10px] text-slate-500 truncate">{{ scene.description || '暂无描述' }}</div>
                </div>
                <div
                  :class="[
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                    batchGenerateSelectedScenes.has(scene.id) 
                      ? 'bg-emerald-500 border-emerald-500' 
                      : 'border-white/20'
                  ]"
                >
                  <Check v-if="batchGenerateSelectedScenes.has(scene.id)" :size="10" class="text-white" />
                </div>
              </div>
              <div v-if="scenes.length === 0" class="col-span-3 text-center py-8 text-slate-600 text-sm">
                暂无场景
              </div>
            </div>
          </div>

          <!-- 人物选择 -->
          <div v-if="batchGenerateType === 'characters' || batchGenerateType === 'all'">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <Users :size="16" class="text-purple-400" />
                <span class="text-sm font-medium text-white">选择人物</span>
                <span class="text-xs text-slate-500">({{ batchGenerateSelectedCharacters.size }}/{{ characters.length }})</span>
              </div>
              <button
                @click="toggleAllCharacters"
                class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {{ batchGenerateSelectedCharacters.size === characters.length ? '取消全选' : '全选' }}
              </button>
            </div>
            <div class="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
              <div
                v-for="char in characters"
                :key="char.id"
                @click="toggleBatchGenerateCharacter(char.id)"
                :class="[
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                  batchGenerateSelectedCharacters.has(char.id) 
                    ? 'bg-purple-500/20 ring-1 ring-purple-500/50' 
                    : 'bg-white/[0.02] hover:bg-white/5'
                ]"
              >
                <div class="relative flex-shrink-0">
                  <div class="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-black/30">
                    <img v-if="char.image" :src="char.image" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <User :size="14" class="text-slate-600" />
                    </div>
                  </div>
                  <div
                    class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1c1c1e]"
                    :style="{ backgroundColor: char.color }"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-white font-medium truncate">{{ char.name }}</div>
                  <div class="text-[10px] text-slate-500 truncate">{{ char.description || '暂无描述' }}</div>
                </div>
                <div
                  :class="[
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                    batchGenerateSelectedCharacters.has(char.id) 
                      ? 'bg-purple-500 border-purple-500' 
                      : 'border-white/20'
                  ]"
                >
                  <Check v-if="batchGenerateSelectedCharacters.has(char.id)" :size="10" class="text-white" />
                </div>
              </div>
              <div v-if="characters.length === 0" class="col-span-3 text-center py-8 text-slate-600 text-sm">
                暂无人物
              </div>
            </div>
          </div>

          <!-- 道具选择 -->
          <div v-if="batchGenerateType === 'props' || batchGenerateType === 'all'">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <Package :size="16" class="text-orange-400" />
                <span class="text-sm font-medium text-white">选择道具</span>
                <span class="text-xs text-slate-500">({{ batchGenerateSelectedProps.size }}/{{ props.length }})</span>
              </div>
              <button
                @click="toggleAllProps"
                class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {{ batchGenerateSelectedProps.size === props.length ? '取消全选' : '全选' }}
              </button>
            </div>
            <div class="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
              <div
                v-for="prop in props"
                :key="prop.id"
                @click="toggleBatchGenerateProp(prop.id)"
                :class="[
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                  batchGenerateSelectedProps.has(prop.id) 
                    ? 'bg-orange-500/20 ring-1 ring-orange-500/50' 
                    : 'bg-white/[0.02] hover:bg-white/5'
                ]"
              >
                <div class="relative flex-shrink-0">
                  <div class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-black/30">
                    <img v-if="prop.image" :src="prop.image" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <Package :size="14" class="text-slate-600" />
                    </div>
                  </div>
                  <div
                    class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1c1c1e]"
                    :style="{ backgroundColor: prop.color }"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-white font-medium truncate">{{ prop.name }}</div>
                  <div class="text-[10px] text-slate-500 truncate">{{ prop.description || '暂无描述' }}</div>
                </div>
                <div
                  :class="[
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                    batchGenerateSelectedProps.has(prop.id) 
                      ? 'bg-orange-500 border-orange-500' 
                      : 'border-white/20'
                  ]"
                >
                  <Check v-if="batchGenerateSelectedProps.has(prop.id)" :size="10" class="text-white" />
                </div>
              </div>
              <div v-if="props.length === 0" class="col-span-3 text-center py-8 text-slate-600 text-sm">
                暂无道具
              </div>
            </div>
          </div>

          <!-- 生成进度 -->
          <div v-if="isGenerating" class="p-4 bg-white/5 rounded-xl">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-white font-medium">生成进度</span>
              <span class="text-xs text-slate-400">{{ progress.completed }}/{{ progress.total }}</span>
            </div>
            <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div 
                class="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                :style="{ width: `${(progress.completed / progress.total) * 100}%` }"
              />
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 :size="12" class="animate-spin" />
              <span>{{ progress.currentItem }}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-[#18181b]/50">
          <div class="text-xs text-slate-500">
            将使用 <strong class="text-pink-400">{{ batchSelectedArtStyle.name }}</strong> 风格生成 
            <strong class="text-white">{{ batchGenerateItemCount }}</strong> 张图片
            <span v-if="batchGenerateType === 'all'">
              （场景 {{ batchGenerateSelectedScenes.size }} + 人物 {{ batchGenerateSelectedCharacters.size }} + 道具 {{ batchGenerateSelectedProps.size }}）
            </span>
          </div>
          <div class="flex gap-2">
            <button
              @click="emit('update:isOpen', false)"
              :disabled="isGenerating"
              class="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              @click="handleGenerate"
              :disabled="isGenerating || batchGenerateItemCount === 0"
              class="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="isGenerating" :size="14" class="animate-spin" />
              <Sparkles v-else :size="14" />
              <span>{{ isGenerating ? '生成中...' : '开始生成' }}</span>
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

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

