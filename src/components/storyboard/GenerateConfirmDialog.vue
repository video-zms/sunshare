<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X, ImageIcon, Film, AlertCircle, Check } from 'lucide-vue-next'
import TextField from '../common/TextField.vue'
import ImageField from '../common/ImageField.vue'
import type { StoryboardShot, StoryScene, StoryCharacter, StoryProp } from '../../types'

interface Props {
  isOpen: boolean
  type: 'image' | 'video'
  shot: StoryboardShot | null
  shots: StoryboardShot[] // 所有分镜列表，用于选择其他分镜的分镜图
  scenes: StoryScene[]
  characters: StoryCharacter[]
  storyProps: StoryProp[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'confirm': [data: {
    prompt: string
    sceneReferenceImage?: string | null
    characterReferenceImages?: Array<{ id: string, image?: string | null }>
    propReferenceImages?: Array<{ id: string, image?: string | null }>
    otherShotImages?: Array<{ shotId: string, shotNumber: number, image: string }> // 其他分镜的分镜图
  }]
  'cancel': []
}>()

// 可编辑的提示词
const editablePrompt = ref('')

// 可编辑的参考图
const sceneReferenceImage = ref<string | null>(null)
const characterReferenceImages = ref<Array<{ id: string, image?: string | null }>>([])
const propReferenceImages = ref<Array<{ id: string, image?: string | null }>>([])
const selectedOtherShotImages = ref<Array<{ shotId: string, shotNumber: number, image: string }>>([]) // 选中的其他分镜图
const isOtherShotsSelectorOpen = ref(false) // 其他分镜选择器是否打开

// 构建完整的提示词（包含所有分镜信息）
const buildFullPrompt = (shot: StoryboardShot) => {
  const parts: string[] = []
  
  // 添加分镜描述
  if (shot.description) {
    parts.push(shot.description)
  }
  
  // 添加景别
  if (shot.sceneType) {
    parts.push(`\n景别: ${shot.sceneType}`)
  }
  
  // 添加运镜
  if (shot.cameraMovement) {
    parts.push(`\n运镜: ${shot.cameraMovement}`)
  }
  
  // 添加台词
  if (shot.dialogue) {
    parts.push(`\n台词: ${shot.dialogue}`)
  }
  
  // 添加备注（如果有）
  if (shot.notes) {
    parts.push(`\n备注: ${shot.notes}`)
  }
  
  return parts.join('. ')
}

// 初始化数据
watch([() => props.isOpen, () => props.shot], () => {
  if (props.isOpen && props.shot) {
    // 初始化提示词（包含所有分镜信息）
    editablePrompt.value = buildFullPrompt(props.shot)
    
    // 初始化场景参考图
    if (props.shot.sceneId) {
      const scene = props.scenes.find(s => s.id === props.shot?.sceneId)
      sceneReferenceImage.value = scene?.image || null
    } else {
      sceneReferenceImage.value = null
    }
    
    // 初始化人物参考图
    if (props.shot.characterIds && props.shot.characterIds.length > 0) {
      characterReferenceImages.value = props.shot.characterIds.map(charId => {
        const char = props.characters.find(c => c.id === charId)
        return {
          id: charId,
          image: char?.image || null
        }
      })
    } else {
      characterReferenceImages.value = []
    }
    
    // 初始化道具参考图
    if (props.shot.propIds && props.shot.propIds.length > 0) {
      propReferenceImages.value = props.shot.propIds.map(propId => {
        const prop = props.storyProps.find(p => p.id === propId)
        return {
          id: propId,
          image: prop?.image || null
        }
      })
    } else {
      propReferenceImages.value = []
    }
    
    // 清空其他分镜图选择
    selectedOtherShotImages.value = []
    isOtherShotsSelectorOpen.value = false
  }
}, { immediate: true })

const sceneName = computed(() => {
  if (!props.shot?.sceneId) return '未设置场景'
  const scene = props.scenes.find(s => s.id === props.shot?.sceneId)
  return scene?.name || '未知场景'
})

const characterNames = computed(() => {
  if (!props.shot?.characterIds || props.shot.characterIds.length === 0) return '无'
  const chars = props.characters.filter(c => props.shot?.characterIds?.includes(c.id))
  return chars.map(c => c.name).join('、') || '无'
})

const propNames = computed(() => {
  if (!props.shot?.propIds || props.shot.propIds.length === 0) return '无'
  const props_list = props.storyProps.filter(p => props.shot?.propIds?.includes(p.id))
  return props_list.map(p => p.name).join('、') || '无'
})

const handleConfirm = () => {
  emit('confirm', {
    prompt: editablePrompt.value,
    sceneReferenceImage: sceneReferenceImage.value,
    characterReferenceImages: characterReferenceImages.value,
    propReferenceImages: propReferenceImages.value,
    otherShotImages: selectedOtherShotImages.value.length > 0 ? selectedOtherShotImages.value : undefined
  })
  emit('update:isOpen', false)
}

const handleSceneImageChange = (image: string | null) => {
  sceneReferenceImage.value = image
}

const handleCharacterImageChange = (charId: string, image: string | null) => {
  const index = characterReferenceImages.value.findIndex(c => c.id === charId)
  if (index >= 0) {
    characterReferenceImages.value[index].image = image
  }
}

const handlePropImageChange = (propId: string, image: string | null) => {
  const index = propReferenceImages.value.findIndex(p => p.id === propId)
  if (index >= 0) {
    propReferenceImages.value[index].image = image
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:isOpen', false)
}

// 获取可用的其他分镜（排除当前分镜，且必须有分镜图）
const availableOtherShots = computed(() => {
  return props.shots.filter(shot => 
    shot.id !== props.shot?.id && shot.sceneImage
  )
})

// 切换其他分镜图的选择
const toggleOtherShotImage = (shot: StoryboardShot) => {
  if (!shot.sceneImage) return
  
  const index = selectedOtherShotImages.value.findIndex(s => s.shotId === shot.id)
  if (index >= 0) {
    // 取消选择
    selectedOtherShotImages.value.splice(index, 1)
  } else {
    // 添加选择
    selectedOtherShotImages.value.push({
      shotId: shot.id,
      shotNumber: shot.shotNumber,
      image: shot.sceneImage
    })
  }
}

// 检查分镜是否已选中
const isShotSelected = (shotId: string) => {
  return selectedOtherShotImages.value.some(s => s.shotId === shotId)
}

// 移除选中的其他分镜图
const removeOtherShotImage = (shotId: string) => {
  const index = selectedOtherShotImages.value.findIndex(s => s.shotId === shotId)
  if (index >= 0) {
    selectedOtherShotImages.value.splice(index, 1)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="handleCancel"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-if="isOpen"
            class="bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            @click.stop
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-white/10">
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'p-2 rounded-xl',
                    type === 'image' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                  ]"
                >
                  <ImageIcon v-if="type === 'image'" :size="20" />
                  <Film v-else :size="20" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-white">
                    {{ type === 'image' ? '确认生成分镜图片' : '确认生成分镜视频' }}
                  </h3>
                  <p class="text-xs text-slate-400 mt-0.5">
                    {{ type === 'image' ? '将使用AI生成分镜图片' : '将使用AI生成分镜视频' }}
                  </p>
                </div>
              </div>
              <button
                @click="handleCancel"
                class="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X :size="18" />
              </button>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div class="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <AlertCircle :size="18" class="text-amber-400 mt-0.5 flex-shrink-0" />
                <div class="flex-1 text-sm text-slate-300">
                  <p class="font-medium text-white mb-1">分镜信息</p>
                  <div class="space-y-1.5 text-xs">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500 w-16">镜号:</span>
                      <span class="text-white">{{ shot?.shotNumber || '-' }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500 w-16">场景:</span>
                      <span class="text-white">{{ sceneName }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500 w-16">人物:</span>
                      <span class="text-white">{{ characterNames }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500 w-16">道具:</span>
                      <span class="text-white">{{ propNames }}</span>
                    </div>
                    <div v-if="type === 'video' && shot?.duration" class="flex items-center gap-2">
                      <span class="text-slate-500 w-16">时长:</span>
                      <span class="text-white">{{ shot.duration }}秒</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 分镜图（生成视频时显示） -->
              <div v-if="type === 'video' && shot?.sceneImage" class="space-y-2">
                <label class="text-sm font-medium text-white flex items-center gap-2">
                  <ImageIcon :size="16" class="text-cyan-400" />
                  分镜图（将作为视频生成的参考）
                </label>
                <div class="rounded-xl overflow-hidden border border-cyan-500/30 bg-white/5">
                  <img 
                    :src="shot.sceneImage" 
                    alt="分镜图"
                    class="w-full h-auto max-h-[200px] object-contain"
                  />
                </div>
              </div>

              <!-- 分镜图（生成视频时显示，作为参考） -->
              <div v-if="type === 'video' && shot?.sceneImage" class="space-y-2">
                <label class="text-sm font-medium text-white flex items-center gap-2">
                  <ImageIcon :size="16" class="text-cyan-400" />
                  分镜图（将作为视频生成的参考）
                </label>
                <div class="rounded-xl overflow-hidden border border-cyan-500/30 bg-white/5 p-2">
                  <img 
                    :src="shot.sceneImage" 
                    alt="分镜图"
                    class="w-full h-auto max-h-[200px] object-contain rounded-lg"
                  />
                </div>
              </div>

              <!-- 可编辑的提示词 -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-white">提示词</label>
                <TextField
                  v-model="editablePrompt"
                  multiline
                  :rows="4"
                  placeholder="请输入分镜描述..."
                  custom-class="w-full"
                />
              </div>

              <!-- 场景参考图 -->
              <div v-if="shot?.sceneId" class="space-y-2">
                <label class="text-sm font-medium text-white">场景参考图</label>
                <ImageField
                  :image="sceneReferenceImage"
                  @change="handleSceneImageChange"
                  width="100%"
                  height="120px"
                  upload-text="上传场景参考图"
                  :disable-generate="true"
                  :disable-preview="false"
                  :disable-crop="false"
                />
              </div>

              <!-- 人物参考图 -->
              <div v-if="characterReferenceImages.length > 0" class="space-y-2">
                <label class="text-sm font-medium text-white">人物参考图</label>
                <div class="space-y-3">
                  <div
                    v-for="charRef in characterReferenceImages"
                    :key="charRef.id"
                    class="space-y-1.5"
                  >
                    <div class="text-xs text-slate-400">
                      {{ characters.find(c => c.id === charRef.id)?.name || '未知人物' }}
                    </div>
                    <ImageField
                      :image="charRef.image"
                      @change="(img) => handleCharacterImageChange(charRef.id, img)"
                      width="100%"
                      height="120px"
                      upload-text="上传人物参考图"
                      :disable-generate="true"
                      :disable-preview="false"
                      :disable-crop="false"
                    />
                  </div>
                </div>
              </div>

              <!-- 道具参考图 -->
              <div v-if="propReferenceImages.length > 0" class="space-y-2">
                <label class="text-sm font-medium text-white">道具参考图</label>
                <div class="space-y-3">
                  <div
                    v-for="propRef in propReferenceImages"
                    :key="propRef.id"
                    class="space-y-1.5"
                  >
                    <div class="text-xs text-slate-400">
                      {{ storyProps.find(p => p.id === propRef.id)?.name || '未知道具' }}
                    </div>
                    <ImageField
                      :image="propRef.image"
                      @change="(img) => handlePropImageChange(propRef.id, img)"
                      width="100%"
                      height="120px"
                      upload-text="上传道具参考图"
                      :disable-generate="true"
                      :disable-preview="false"
                      :disable-crop="false"
                    />
                  </div>
                </div>
              </div>

              <!-- 其他分镜的分镜图 -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium text-white">其他分镜的分镜图</label>
                  <button
                    v-if="availableOtherShots.length > 0"
                    @click="isOtherShotsSelectorOpen = !isOtherShotsSelectorOpen"
                    class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {{ isOtherShotsSelectorOpen ? '收起' : '选择分镜图' }}
                  </button>
                </div>
                
                <!-- 已选中的其他分镜图 -->
                <div v-if="selectedOtherShotImages.length > 0" class="grid grid-cols-2 gap-2">
                  <div
                    v-for="selectedShot in selectedOtherShotImages"
                    :key="selectedShot.shotId"
                    class="relative group"
                  >
                    <div class="rounded-lg overflow-hidden border border-cyan-500/30 bg-white/5">
                      <img 
                        :src="selectedShot.image" 
                        :alt="`分镜${selectedShot.shotNumber}`"
                        class="w-full h-20 object-cover"
                      />
                    </div>
                    <div class="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                      镜{{ selectedShot.shotNumber }}
                    </div>
                    <button
                      @click="removeOtherShotImage(selectedShot.shotId)"
                      class="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/80 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="移除"
                    >
                      <X :size="12" />
                    </button>
                  </div>
                </div>

                <!-- 其他分镜选择器 -->
                <Transition
                  enter-active-class="transition-all duration-200"
                  enter-from-class="opacity-0 max-h-0"
                  enter-to-class="opacity-100 max-h-[400px]"
                  leave-active-class="transition-all duration-200"
                  leave-from-class="opacity-100 max-h-[400px]"
                  leave-to-class="opacity-0 max-h-0"
                >
                  <div
                    v-if="isOtherShotsSelectorOpen && availableOtherShots.length > 0"
                    class="overflow-hidden"
                  >
                    <div class="grid grid-cols-3 gap-2 p-2 bg-white/5 rounded-lg border border-white/10 max-h-[400px] overflow-y-auto custom-scrollbar">
                      <button
                        v-for="shot in availableOtherShots"
                        :key="shot.id"
                        @click="toggleOtherShotImage(shot)"
                        :class="[
                          'relative rounded-lg overflow-hidden border-2 transition-all',
                          isShotSelected(shot.id)
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-white/10 hover:border-white/20 bg-white/5'
                        ]"
                      >
                        <img 
                          :src="shot.sceneImage" 
                          :alt="`分镜${shot.shotNumber}`"
                          class="w-full h-20 object-cover"
                        />
                        <div class="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                          镜{{ shot.shotNumber }}
                        </div>
                        <div
                          v-if="isShotSelected(shot.id)"
                          class="absolute top-1 right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center"
                        >
                          <Check :size="10" class="text-white" />
                        </div>
                      </button>
                    </div>
                  </div>
                </Transition>

                <p v-if="availableOtherShots.length === 0" class="text-xs text-slate-500">
                  暂无其他分镜的分镜图可用
                </p>
              </div>

              <div class="text-xs text-slate-400 leading-relaxed pt-2">
                <p v-if="type === 'image'">
                  确认后将开始生成分镜图片，生成过程可能需要一些时间，请耐心等待。
                </p>
                <p v-else>
                  确认后将开始生成分镜视频，视频生成可能需要较长时间，生成过程中请不要关闭页面。
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-3 p-6 border-t border-white/10 bg-white/[0.02]">
              <button
                @click="handleCancel"
                class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                @click="handleConfirm"
                :class="[
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors',
                  type === 'image'
                    ? 'bg-purple-500 hover:bg-purple-600'
                    : 'bg-cyan-500 hover:bg-cyan-600'
                ]"
              >
                确认生成
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
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

