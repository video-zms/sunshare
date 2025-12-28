<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, LayoutGrid, ChevronDown, Loader2 } from 'lucide-vue-next'
import type { StoryboardShot, StoryScene, StoryCharacter, StoryProp, ArtStyle } from '../../types'
import { ART_STYLES } from '../../types'
import { GRID_LAYOUTS, type GridLayout } from '../../services/geminiService'

interface Props {
  isOpen: boolean
  shots: StoryboardShot[]
  scenes: StoryScene[]
  characters: StoryCharacter[]
  storyProps?: StoryProp[]
  currentArtStyle?: ArtStyle
}

const props = withDefaults(defineProps<Props>(), {
  storyProps: () => []
})

interface GridGenerateConfig {
  startIndex: number
  layout: GridLayout
  artStyle: ArtStyle
  model: string
}

const emit = defineEmits<{
  'close': []
  'generate': [config: GridGenerateConfig]
}>()

// 响应式状态
const startShotIndex = ref(0)
const selectedLayout = ref<GridLayout>(GRID_LAYOUTS[3]) // 默认9宫格
const selectedModel = ref('gemini-2.5-flash-image')
const selectedArtStyle = ref<ArtStyle>(ART_STYLES[0])
const showModelDropdown = ref(false)

const imageGenModels = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-image' },
  { label: 'Gemini 3 Pro', value: 'gemini-3-pro-image-preview' },
  { label: 'Imagen 3.0', value: 'imagen-3.0-generate-002' }
]

// 初始化
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    startShotIndex.value = 0
    selectedLayout.value = GRID_LAYOUTS[3] // 默认9宫格
    selectedArtStyle.value = props.currentArtStyle || ART_STYLES[0]
    selectedModel.value = 'gemini-2.5-flash-image'
    showModelDropdown.value = false
  }
})

// 计算属性：获取连续 N 个分镜
const selectedShots = computed(() => {
  return props.shots.slice(startShotIndex.value, startShotIndex.value + selectedLayout.value.total)
})

// 验证：是否有足够的分镜
const hasEnoughShots = computed(() => {
  return props.shots.length - startShotIndex.value >= selectedLayout.value.total
})

// 可选的起始分镜选项
const availableStartOptions = computed(() => {
  const options = []
  const totalNeeded = selectedLayout.value.total
  for (let i = 0; i <= props.shots.length - totalNeeded; i++) {
    const shot = props.shots[i]
    const endShot = props.shots[i + totalNeeded - 1]
    options.push({
      index: i,
      label: `镜号 ${shot.shotNumber} - ${endShot.shotNumber}`,
      shot
    })
  }
  return options
})

// 处理生成
const handleGenerate = () => {
  if (!hasEnoughShots.value) return

  emit('generate', {
    startIndex: startShotIndex.value,
    layout: selectedLayout.value,
    artStyle: selectedArtStyle.value,
    model: selectedModel.value
  })
}

// 获取场景名称
const getSceneName = (sceneId?: string) => {
  if (!sceneId) return ''
  const scene = props.scenes.find(s => s.id === sceneId)
  return scene?.name || ''
}

// 获取人物名称
const getCharacterNames = (characterIds?: string[]) => {
  if (!characterIds || characterIds.length === 0) return ''
  return characterIds
    .map(id => props.characters.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

const selectedModelLabel = computed(() => {
  return imageGenModels.find(m => m.value === selectedModel.value)?.label || selectedModel.value
})

// 最小分镜数量要求
const minShotsRequired = computed(() => {
  return Math.min(...GRID_LAYOUTS.map(l => l.total))
})

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8">
    <div class="bg-[#1c1c1e] rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between p-6 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <LayoutGrid :size="20" class="text-purple-400" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">宫格生成</h2>
            <p class="text-xs text-slate-500 mt-0.5">一次性生成多个分镜的连贯画面</p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <!-- 分镜数量检查 -->
        <div v-if="shots.length < minShotsRequired" class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p class="text-sm text-red-400">
            当前分镜数量不足 {{ minShotsRequired }} 个（当前：{{ shots.length }}），无法使用宫格生成功能
          </p>
        </div>

        <template v-else>
          <!-- 宫格类型选择 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-3">选择宫格类型</label>
            <div class="grid grid-cols-4 gap-3">
              <button
                v-for="layout in GRID_LAYOUTS"
                :key="`${layout.rows}x${layout.cols}`"
                @click="selectedLayout = layout; startShotIndex = 0"
                :disabled="shots.length < layout.total"
                :class="[
                  'relative p-4 rounded-xl border-2 transition-all group',
                  selectedLayout.rows === layout.rows && selectedLayout.cols === layout.cols
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20',
                  shots.length < layout.total && 'opacity-50 cursor-not-allowed'
                ]"
              >
                <div class="text-center">
                  <div class="text-lg font-bold text-white mb-1">{{ layout.name }}</div>
                  <div class="text-xs text-slate-500">{{ layout.total }} 个分镜</div>
                  <div v-if="shots.length < layout.total" class="text-xs text-red-400 mt-1">
                    需要 {{ layout.total }} 个分镜
                  </div>
                </div>
                <div
                  v-if="selectedLayout.rows === layout.rows && selectedLayout.cols === layout.cols"
                  class="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center"
                >
                  <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          <!-- 起始分镜选择 -->
          <div v-if="availableStartOptions.length > 0">
            <label class="block text-sm font-medium text-slate-300 mb-2">选择起始分镜</label>
            <select
              v-model.number="startShotIndex"
              class="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:border-white/20 transition-colors"
            >
              <option v-for="option in availableStartOptions" :key="option.index" :value="option.index">
                {{ option.label }}
              </option>
            </select>
            <p v-if="!hasEnoughShots" class="text-red-400 text-xs mt-2">
              剩余分镜不足 {{ selectedLayout.total }} 个，请调整起始位置
            </p>
          </div>

          <!-- 分镜预览（动态宫格） -->
          <div v-if="selectedShots.length > 0">
            <label class="block text-sm font-medium text-slate-300 mb-3">
              将生成以下 {{ selectedLayout.total }} 个分镜的 {{ selectedLayout.name }} 图像
            </label>
            <div
              class="grid gap-3"
              :style="{ gridTemplateColumns: `repeat(${selectedLayout.cols}, minmax(0, 1fr))` }"
            >
              <div
                v-for="(shot, index) in selectedShots"
                :key="shot.id"
                class="border border-white/10 rounded-xl p-3 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-purple-500/30 transition-colors group"
              >
                <!-- 编号标记 -->
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                      {{ index + 1 }}
                    </div>
                    <span class="text-xs text-cyan-400 font-medium">镜号 {{ shot.shotNumber }}</span>
                  </div>
                </div>

                <!-- 分镜描述 -->
                <div class="text-xs text-slate-300 line-clamp-2 mb-2 min-h-[32px]">
                  {{ shot.description || '无描述' }}
                </div>

                <!-- 场景和人物 -->
                <div class="space-y-1">
                  <div v-if="shot.sceneId" class="text-[10px] text-emerald-400/80 truncate">
                    场景: {{ getSceneName(shot.sceneId) }}
                  </div>
                  <div v-if="shot.characterIds && shot.characterIds.length > 0" class="text-[10px] text-purple-400/80 truncate">
                    人物: {{ getCharacterNames(shot.characterIds) }}
                  </div>
                  <div class="text-[10px] text-slate-600 truncate">
                    {{ shot.sceneType }} · {{ shot.cameraMovement }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 画风选择 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-3">选择画风</label>
            <div class="grid grid-cols-5 gap-3">
              <button
                v-for="style in ART_STYLES"
                :key="style.id"
                @click="selectedArtStyle = style"
                :class="[
                  'relative p-4 rounded-xl border-2 transition-all group hover:scale-105',
                  selectedArtStyle.id === style.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                ]"
              >
                <div
                  class="w-full aspect-square rounded-lg mb-2"
                  :style="{ background: style.previewColor }"
                />
                <div class="text-xs font-medium text-white text-center">{{ style.name }}</div>
                <div
                  v-if="selectedArtStyle.id === style.id"
                  class="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center"
                >
                  <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          <!-- 模型选择 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">生成模型</label>
            <div class="relative">
              <button
                @click="showModelDropdown = !showModelDropdown"
                class="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:border-white/20 transition-colors flex items-center justify-between"
              >
                <span>{{ selectedModelLabel }}</span>
                <ChevronDown :size="16" class="text-slate-500" />
              </button>
              <div
                v-if="showModelDropdown"
                class="absolute top-full left-0 right-0 mt-2 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl z-10 overflow-hidden"
              >
                <button
                  v-for="model in imageGenModels"
                  :key="model.value"
                  @click="selectedModel = model.value; showModelDropdown = false"
                  :class="[
                    'w-full px-4 py-2.5 text-left text-sm transition-colors',
                    selectedModel === model.value
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-slate-300 hover:bg-white/5'
                  ]"
                >
                  {{ model.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- 说明提示 -->
          <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p class="text-sm text-blue-300 leading-relaxed">
              <span class="font-semibold">提示：</span>
              宫格生成将把 {{ selectedLayout.total }} 个分镜的描述合并为一个提示词，AI会生成一张包含所有场景的{{ selectedLayout.rows }}×{{ selectedLayout.cols }}网格图像。
              生成后系统会自动将图像拆分为 {{ selectedLayout.total }} 张独立图片并分配给对应的分镜。
            </p>
          </div>
        </template>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex items-center justify-between p-6 border-t border-white/10">
        <button
          @click="emit('close')"
          class="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
        >
          取消
        </button>
        <button
          @click="handleGenerate"
          :disabled="!hasEnoughShots || shots.length < minShotsRequired"
          class="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-sm font-medium text-white hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 shadow-lg shadow-purple-500/20"
        >
          <span class="flex items-center gap-2">
            <LayoutGrid :size="16" />
            生成 {{ selectedLayout.name }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
