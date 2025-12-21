<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, GripVertical, Copy, ChevronUp, ChevronDown as ChevronDownIcon, Trash2 } from 'lucide-vue-next'
import SelectDropdown from './SelectDropdown.vue'
import ImageField from '../common/ImageField.vue'
import VideoField from '../common/VideoField.vue'
import TextField from '../common/TextField.vue'
import type { StoryboardShot, SceneType, CameraMovement, StoryScene, StoryCharacter, StoryProp } from '../../types'

interface Props {
  shot: StoryboardShot
  scenes: StoryScene[]
  characters: StoryCharacter[]
  storyProps?: StoryProp[]
  sceneTypes: SceneType[]
  cameraMovements: CameraMovement[]
  visibleColumns: Record<string, boolean>
  isSelected: boolean
  isDragged: boolean
  isGenerating: boolean
}

const props = withDefaults(defineProps<Props>(), {
  storyProps: () => []
})

const emit = defineEmits<{
  'update:shot': [shot: StoryboardShot]
  'toggle-select': []
  'drag-start': [e: DragEvent]
  'drag-over': [e: DragEvent]
  'drop': [e: DragEvent]
  'drag-end': []
  'image-upload': [e: Event, type: 'scene' | 'character']
  'generate-image': []
  'generate-video': []
  'generate-from-ai': []
  'duplicate': []
  'move-up': []
  'move-down': []
  'delete': []
  'toggle-scene': [sceneId: string]
  'toggle-character': [characterId: string]
  'toggle-prop': [propId: string]
}>()

const handleSceneChange = (sceneId: string | string[] | undefined) => {
  emit('toggle-scene', Array.isArray(sceneId) ? sceneId[0] : (sceneId || ''))
}

const handleCharacterChange = (characterIds: string | string[] | undefined) => {
  const newIds = Array.isArray(characterIds) ? characterIds : (characterIds ? [characterIds] : [])
  const currentIds = props.shot.characterIds || []
  
  // 找出新增和移除的ID
  const addedIds = newIds.filter((id: string) => !currentIds.includes(id))
  const removedIds = currentIds.filter((id: string) => !newIds.includes(id))
  
  // 先移除，再添加（避免重复触发）
  removedIds.forEach((id: string) => emit('toggle-character', id))
  addedIds.forEach((id: string) => emit('toggle-character', id))
}

const handlePropChange = (propIds: string | string[] | undefined) => {
  const newIds = Array.isArray(propIds) ? propIds : (propIds ? [propIds] : [])
  const currentIds = props.shot.propIds || []
  
  // 找出新增和移除的ID
  const addedIds = newIds.filter((id: string) => !currentIds.includes(id))
  const removedIds = currentIds.filter((id: string) => !newIds.includes(id))
  
  // 先移除，再添加（避免重复触发）
  removedIds.forEach((id: string) => emit('toggle-prop', id))
  addedIds.forEach((id: string) => emit('toggle-prop', id))
}

const handleImageUpload = (e: Event) => {
  // ImageField 组件已经在 change 事件中处理了文件读取和更新
  // 这里触发事件以保持与父组件的兼容性
  emit('image-upload', e, 'scene')
}

const handleImageChange = (image: string | null) => {
  // ImageField 组件已经处理了文件读取，这里直接更新 shot 的 sceneImage
  emit('update:shot', { ...props.shot, sceneImage: image || undefined })
}

const handleVideoUpload = (e: Event) => {
  // VideoField 组件已经在 change 事件中处理了文件读取和更新
  // 这里触发事件以保持与父组件的兼容性
  emit('image-upload', e, 'scene')
}

const handleVideoChange = (video: string | null) => {
  // VideoField 组件已经处理了文件读取，这里直接更新 shot 的 videoUrl
  emit('update:shot', { ...props.shot, videoUrl: video || undefined })
}

// 转换视频生成状态：'processing' -> 'in_progress'
const videoGeneratingStatus = computed(() => {
  if (props.shot.videoGeneratingStatus === 'processing') {
    return 'in_progress' as const
  }
  return props.shot.videoGeneratingStatus
})
</script>

<template>
  <tr
    :class="[
      'group border-b border-white/5 hover:bg-white/[0.02] transition-colors',
      isSelected ? 'bg-cyan-500/5' : '',
      isDragged ? 'opacity-50' : ''
    ]"
    draggable="true"
    @dragstart="emit('drag-start', $event)"
    @dragover="emit('drag-over', $event)"
    @drop="emit('drop', $event)"
    @dragend="emit('drag-end')"
  >
    <!-- Checkbox -->
    <td class="px-4 py-3">
      <input
        type="checkbox"
        :checked="isSelected"
        @change="emit('toggle-select')"
        class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
      />
    </td>

    <!-- Drag Handle -->
    <td class="px-2 py-3 cursor-grab active:cursor-grabbing">
      <GripVertical :size="16" class="text-slate-600 hover:text-slate-400" />
    </td>

    <!-- Scene Image -->
    <td class="px-4 py-3">
      <ImageField
        :image="shot.sceneImage"
        :is-generating="isGenerating"
        width="160px"
        height="90px"
        upload-text="上传分镜图"
        accept="image/*"
        @upload="handleImageUpload"
        @generate="emit('generate-image')"
        @change="handleImageChange"
      />
    </td>

    <!-- Video -->
    <td v-if="visibleColumns.video" class="px-4 py-3">
      <VideoField
        :video="shot.videoUrl"
        :is-generating="isGenerating || (shot.videoGeneratingStatus === 'queued' || shot.videoGeneratingStatus === 'processing')"
        :generating-status="videoGeneratingStatus"
        :generating-progress="shot.videoGeneratingProgress"
        :reference-image="shot.sceneImage"
        width="160px"
        height="90px"
        upload-text="上传视频"
        accept="video/*"
        @upload="handleVideoUpload"
        @generate="emit('generate-video')"
        @change="handleVideoChange"
      />
    </td>

    <!-- Shot Number -->
    <td v-if="visibleColumns.shotNumber" class="px-4 py-3 text-center">
      <div class="w-8 h-8 mx-auto rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">
        {{ shot.shotNumber }}
      </div>
    </td>

    <!-- Duration -->
    <td v-if="visibleColumns.duration" class="px-4 py-3 text-center">
      <TextField
        type="number"
        :model-value="shot.duration"
        @update:model-value="(value) => emit('update:shot', { ...shot, duration: Number(value) })"
        width="64px"
        min="0"
        placeholder="0"
        custom-class="text-center"
      />
    </td>

    <!-- Scene Type -->
    <td v-if="visibleColumns.sceneType" class="px-4 py-3">
      <SelectDropdown
        :options="sceneTypes"
        :model-value="shot.sceneType || ''"
        placeholder="选择景别"
        dropdown-width="100%"
        hover-border-color="cyan-500"
        active-color="emerald"
        @update:model-value="(value) => emit('update:shot', { ...shot, sceneType: (Array.isArray(value) ? value[0] : (value || '')) as SceneType })"
      />
    </td>

    <!-- Camera Movement -->
    <td v-if="visibleColumns.cameraMovement" class="px-4 py-3">
      <SelectDropdown
        :options="cameraMovements"
        :model-value="shot.cameraMovement || ''"
        placeholder="选择运镜"
        dropdown-width="100%"
        hover-border-color="cyan-500"
        active-color="emerald"
        @update:model-value="(value) => emit('update:shot', { ...shot, cameraMovement: Array.isArray(value) ? value[0] : (value || '') })"
      />
    </td>

    <!-- Scene -->
    <td v-if="visibleColumns.scene" class="px-4 py-3">
      <SelectDropdown
        :options="scenes"
        :model-value="shot.sceneId"
        placeholder="选择场景"
        dropdown-width="12rem"
        hover-border-color="emerald-500"
        active-color="emerald"
        :show-empty-option="true"
        empty-option-text="无场景"
        empty-text="暂无场景，请先添加"
        @update:model-value="handleSceneChange"
      />
    </td>

    <!-- Characters -->
    <td v-if="visibleColumns.characters" class="px-4 py-3">
      <SelectDropdown
        :options="characters"
        :model-value="shot.characterIds"
        placeholder="选择人物"
        :multiple="true"
        dropdown-width="13rem"
        hover-border-color="purple-500"
        active-color="purple"
        empty-text="暂无人物，请先添加"
        button-min-height="34px"
        @update:model-value="handleCharacterChange"
      >
        <template #button="{ selected }">
          <div v-if="Array.isArray(selected) && selected.length > 0" class="flex items-center gap-1 flex-wrap flex-1">
            <div
              v-for="char in selected.slice(0, 3)"
              :key="char.id"
              class="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]"
            >
              <div
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: char.color }"
              />
              <span class="truncate max-w-[40px]">{{ char.name }}</span>
            </div>
            <span v-if="selected.length > 3" class="text-[10px] text-slate-500">
              +{{ selected.length - 3 }}
            </span>
          </div>
          <span v-else class="text-slate-500 text-xs flex-1">选择人物</span>
          <ChevronDown :size="12" class="text-slate-500 ml-auto flex-shrink-0" />
        </template>
      </SelectDropdown>
    </td>

    <!-- Props -->
    <td v-if="visibleColumns.props" class="px-4 py-3">
      <SelectDropdown
        :options="storyProps || []"
        :model-value="shot.propIds"
        placeholder="选择道具"
        :multiple="true"
        dropdown-width="13rem"
        hover-border-color="orange-500"
        active-color="orange"
        empty-text="暂无道具，请先添加"
        button-min-height="34px"
        @update:model-value="handlePropChange"
      >
        <template #button="{ selected }">
          <div v-if="Array.isArray(selected) && selected.length > 0" class="flex items-center gap-1 flex-wrap flex-1">
            <div
              v-for="prop in selected.slice(0, 3)"
              :key="prop.id"
              class="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]"
            >
              <div
                class="w-2 h-2 rounded-full"
                :style="{ backgroundColor: prop.color }"
              />
              <span class="truncate max-w-[40px]">{{ prop.name }}</span>
            </div>
            <span v-if="selected.length > 3" class="text-[10px] text-slate-500">
              +{{ selected.length - 3 }}
            </span>
          </div>
          <span v-else class="text-slate-500 text-xs flex-1">选择道具</span>
          <ChevronDown :size="12" class="text-slate-500 ml-auto flex-shrink-0" />
        </template>
      </SelectDropdown>
    </td>

    <!-- Description -->
    <td v-if="visibleColumns.description" class="px-4 py-3">
      <TextField
        type="text"
        :model-value="shot.description"
        @update:model-value="(value) => emit('update:shot', { ...shot, description: String(value) })"
        width="100%"
        placeholder="请输入"
        multiline
        :rows="5"
      />
    </td>

    <!-- Dialogue -->
    <td v-if="visibleColumns.dialogue" class="px-4 py-3">
      <TextField
        type="text"
        :model-value="shot.dialogue"
        @update:model-value="(value) => emit('update:shot', { ...shot, dialogue: String(value) })"
        width="100%"
        multiline
        :rows="5"
        
        placeholder="请输入"
      />
    </td>

    <!-- Notes -->
    <td v-if="visibleColumns.notes" class="px-4 py-3">
      <TextField
        type="text"
        :model-value="shot.notes"
        @update:model-value="(value) => emit('update:shot', { ...shot, notes: String(value) })"
        width="100%"
        multiline
        :rows="5"
        placeholder="请输入"
      />
    </td>

    <!-- Actions -->
    <td class="px-4 py-3">
      <div class="flex items-center justify-center gap-1">
        <!-- <button
          @click="emit('generate-from-ai')"
          class="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Sparkles :size="12" />
          AI分析镜头
        </button> -->
        <button
          @click="emit('duplicate')"
          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
          title="复制"
        >
          <Copy :size="14" />
        </button>
        <button
          @click="emit('move-up')"
          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="上移"
        >
          <ChevronUp :size="14" />
        </button>
        <button
          @click="emit('move-down')"
          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="下移"
        >
          <ChevronDownIcon :size="14" />
        </button>
        <button
          @click="emit('delete')"
          class="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-slate-500 hover:text-red-400"
          title="删除"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </td>
  </tr>
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

