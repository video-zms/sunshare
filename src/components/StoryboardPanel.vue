<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X, Plus, Trash2, Upload, ChevronUp, ChevronDown, Copy, Sparkles,
  Image as ImageIcon, Film, LayoutGrid, List, Download, Share2,
  GripVertical, Clock, Camera, Type, MessageSquare, FileText, Users
} from 'lucide-vue-next'
import type { StoryboardShot, SceneType, CameraMovement, Storyboard } from '../types'

interface Props {
  isOpen: boolean
  storyboard?: Storyboard | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [storyboard: Storyboard]
  generateFromAI: [shotId: string]
}>()

// Local state
const title = ref('未命名分镜板')
const shots = ref<StoryboardShot[]>([])
const viewMode = ref<'list' | 'grid'>('list')
const selectedShotIds = ref<Set<string>>(new Set())
const draggedShotId = ref<string | null>(null)
const isConfigOpen = ref(false)

// Scene types and camera movements
const sceneTypes: SceneType[] = ['远景', '全景', '中景', '近景', '特写', '大特写']
const cameraMovements: CameraMovement[] = ['固定', '横摇', '俯仰', '横移', '升降', '跟随', '推', '拉', '摇', '移', '环绕']

// Visible columns configuration
const visibleColumns = ref({
  shotNumber: true,
  duration: true,
  sceneType: true,
  cameraMovement: true,
  description: true,
  dialogue: true,
  notes: true
})

// Initialize from props
watch(() => props.storyboard, (newStoryboard) => {
  if (newStoryboard) {
    title.value = newStoryboard.title
    shots.value = [...newStoryboard.shots]
  } else {
    title.value = '未命名分镜板'
    shots.value = []
  }
}, { immediate: true })

// Computed
const totalDuration = computed(() => {
  return shots.value.reduce((sum, shot) => sum + (shot.duration || 0), 0)
})

const allSelected = computed(() => {
  return shots.value.length > 0 && selectedShotIds.value.size === shots.value.length
})

// Methods
const createNewShot = (): StoryboardShot => ({
  id: `shot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  shotNumber: shots.value.length + 1,
  duration: 0,
  sceneType: '全景',
  cameraMovement: '固定',
  description: '',
  dialogue: '',
  notes: '',
  timestamp: Date.now()
})

const addShot = (index?: number) => {
  const newShot = createNewShot()
  if (index !== undefined) {
    shots.value.splice(index + 1, 0, newShot)
  } else {
    shots.value.push(newShot)
  }
  renumberShots()
}

const addMultipleShots = (count: number) => {
  for (let i = 0; i < count; i++) {
    shots.value.push(createNewShot())
  }
  renumberShots()
}

const deleteShot = (id: string) => {
  shots.value = shots.value.filter(s => s.id !== id)
  selectedShotIds.value.delete(id)
  renumberShots()
}

const deleteSelectedShots = () => {
  shots.value = shots.value.filter(s => !selectedShotIds.value.has(s.id))
  selectedShotIds.value.clear()
  renumberShots()
}

const duplicateShot = (shot: StoryboardShot) => {
  const index = shots.value.findIndex(s => s.id === shot.id)
  const newShot: StoryboardShot = {
    ...shot,
    id: `shot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now()
  }
  shots.value.splice(index + 1, 0, newShot)
  renumberShots()
}

const moveShot = (id: string, direction: 'up' | 'down') => {
  const index = shots.value.findIndex(s => s.id === id)
  if (direction === 'up' && index > 0) {
    [shots.value[index], shots.value[index - 1]] = [shots.value[index - 1], shots.value[index]]
  } else if (direction === 'down' && index < shots.value.length - 1) {
    [shots.value[index], shots.value[index + 1]] = [shots.value[index + 1], shots.value[index]]
  }
  renumberShots()
}

const renumberShots = () => {
  shots.value.forEach((shot, index) => {
    shot.shotNumber = index + 1
  })
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedShotIds.value.clear()
  } else {
    selectedShotIds.value = new Set(shots.value.map(s => s.id))
  }
}

const toggleSelectShot = (id: string) => {
  if (selectedShotIds.value.has(id)) {
    selectedShotIds.value.delete(id)
  } else {
    selectedShotIds.value.add(id)
  }
  selectedShotIds.value = new Set(selectedShotIds.value)
}

// Image upload handlers
const handleImageUpload = (e: Event, shotId: string, type: 'scene' | 'character') => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    const shot = shots.value.find(s => s.id === shotId)
    if (shot) {
      if (type === 'scene') {
        shot.sceneImage = result
      } else {
        shot.characterImage = result
      }
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

// Drag and drop
const handleDragStart = (e: DragEvent, id: string) => {
  draggedShotId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const handleDrop = (e: DragEvent, targetId: string) => {
  e.preventDefault()
  if (!draggedShotId.value || draggedShotId.value === targetId) return

  const draggedIndex = shots.value.findIndex(s => s.id === draggedShotId.value)
  const targetIndex = shots.value.findIndex(s => s.id === targetId)

  const [draggedShot] = shots.value.splice(draggedIndex, 1)
  shots.value.splice(targetIndex, 0, draggedShot)

  renumberShots()
  draggedShotId.value = null
}

const handleDragEnd = () => {
  draggedShotId.value = null
}

// Save
const handleSave = () => {
  const storyboard: Storyboard = {
    id: props.storyboard?.id || `sb-${Date.now()}`,
    title: title.value,
    shots: shots.value,
    createdAt: props.storyboard?.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  emit('save', storyboard)
}

// Export
const exportStoryboard = () => {
  const data = {
    title: title.value,
    shots: shots.value,
    exportedAt: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Format duration
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div
          class="w-[95vw] max-w-[1600px] h-[90vh] bg-[#0f0f11] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#18181b]/50">
            <div class="flex items-center gap-4">
              <button
                @click="emit('close')"
                class="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X :size="20" class="text-slate-400" />
              </button>
              <div class="flex items-center gap-3">
                <Film :size="24" class="text-cyan-400" />
                <input
                  v-model="title"
                  class="text-xl font-bold text-white bg-transparent border-none outline-none focus:ring-0 min-w-[200px]"
                  placeholder="分镜板标题"
                />
              </div>
            </div>

            <div class="flex items-center gap-3">
              <!-- Stats -->
              <div class="flex items-center gap-4 px-4 py-2 bg-white/5 rounded-xl text-xs text-slate-400">
                <span>共计 <strong class="text-white">{{ shots.length }}</strong> 个</span>
                <span class="text-white/20">|</span>
                <span>总时长 <strong class="text-white">{{ formatDuration(totalDuration) }}</strong></span>
              </div>

              <!-- View Mode Toggle -->
              <div class="flex items-center bg-white/5 rounded-xl p-1">
                <button
                  @click="viewMode = 'list'"
                  :class="[
                    'p-2 rounded-lg transition-all',
                    viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                  ]"
                >
                  <List :size="16" />
                </button>
                <button
                  @click="viewMode = 'grid'"
                  :class="[
                    'p-2 rounded-lg transition-all',
                    viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
                  ]"
                >
                  <LayoutGrid :size="16" />
                </button>
              </div>

              <!-- Column Config -->
              <button
                @click="isConfigOpen = !isConfigOpen"
                class="px-4 py-2 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-xl text-sm font-medium transition-colors"
              >
                自定义配置字段
              </button>

              <!-- Actions -->
              <button
                @click="exportStoryboard"
                class="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                title="导出"
              >
                <Download :size="18" />
              </button>
              <button
                class="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                title="分享"
              >
                <Share2 :size="18" />
              </button>
              <button
                @click="handleSave"
                class="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20"
              >
                保存
              </button>
            </div>
          </div>

          <!-- Column Config Dropdown -->
          <Transition name="dropdown">
            <div
              v-if="isConfigOpen"
              class="absolute right-6 top-20 z-50 p-4 bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl min-w-[200px]"
            >
              <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">显示字段</div>
              <label
                v-for="(value, key) in visibleColumns"
                :key="key"
                class="flex items-center gap-3 py-2 cursor-pointer hover:bg-white/5 rounded-lg px-2 -mx-2"
              >
                <input
                  type="checkbox"
                  v-model="visibleColumns[key]"
                  class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                />
                <span class="text-sm text-slate-300">
                  {{ key === 'shotNumber' ? '镜号' :
                     key === 'duration' ? '时长' :
                     key === 'sceneType' ? '景别' :
                     key === 'cameraMovement' ? '运镜' :
                     key === 'description' ? '描述' :
                     key === 'dialogue' ? '台词' :
                     key === 'notes' ? '备注' : key }}
                </span>
              </label>
            </div>
          </Transition>

          <!-- Toolbar -->
          <div class="flex items-center gap-3 px-6 py-3 border-b border-white/5 bg-[#18181b]/30">
            <button
              @click="addShot()"
              class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-slate-300 hover:text-white transition-colors border border-white/5"
            >
              <Plus :size="16" />
              <span>新增</span>
              <span class="text-xs text-slate-500 ml-1">1</span>
              <ChevronUp :size="12" class="text-slate-500" />
            </button>

            <button
              @click="addMultipleShots(5)"
              class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-slate-300 hover:text-white transition-colors border border-white/5"
            >
              <Upload :size="16" />
              <span>图片批量上传</span>
            </button>

            <button
              v-if="selectedShotIds.size > 0"
              @click="deleteSelectedShots"
              class="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm text-red-400 transition-colors border border-red-500/20"
            >
              <Trash2 :size="16" />
              <span>批量删除</span>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto custom-scrollbar">
            <!-- List View -->
            <template v-if="viewMode === 'list'">
              <table class="w-full border-collapse">
                <thead class="sticky top-0 z-10 bg-[#18181b]">
                  <tr class="text-xs text-slate-500 uppercase tracking-wider">
                    <th class="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        :checked="allSelected"
                        @change="toggleSelectAll"
                        class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                    </th>
                    <th class="px-4 py-3 text-left w-12"></th>
                    <th class="px-4 py-3 text-left w-[200px]">分镜图</th>
                    <th v-if="visibleColumns.shotNumber" class="px-4 py-3 text-center w-16">镜号</th>
                    <th v-if="visibleColumns.duration" class="px-4 py-3 text-center w-20">时长(秒)</th>
                    <th v-if="visibleColumns.sceneType" class="px-4 py-3 text-left w-24">景别</th>
                    <th v-if="visibleColumns.cameraMovement" class="px-4 py-3 text-left w-32">运镜</th>
                    <th v-if="visibleColumns.description" class="px-4 py-3 text-left min-w-[150px]">描述</th>
                    <th v-if="visibleColumns.dialogue" class="px-4 py-3 text-left min-w-[120px]">台词</th>
                    <th v-if="visibleColumns.notes" class="px-4 py-3 text-left min-w-[120px]">备注</th>
                    <th class="px-4 py-3 text-center w-[180px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="shot in shots"
                    :key="shot.id"
                    :class="[
                      'group border-b border-white/5 hover:bg-white/[0.02] transition-colors',
                      selectedShotIds.has(shot.id) ? 'bg-cyan-500/5' : '',
                      draggedShotId === shot.id ? 'opacity-50' : ''
                    ]"
                    draggable="true"
                    @dragstart="handleDragStart($event, shot.id)"
                    @dragover="handleDragOver"
                    @drop="handleDrop($event, shot.id)"
                    @dragend="handleDragEnd"
                  >
                    <!-- Checkbox -->
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="selectedShotIds.has(shot.id)"
                        @change="toggleSelectShot(shot.id)"
                        class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                    </td>

                    <!-- Drag Handle -->
                    <td class="px-2 py-3 cursor-grab active:cursor-grabbing">
                      <GripVertical :size="16" class="text-slate-600 hover:text-slate-400" />
                    </td>

                    <!-- Scene Image -->
                    <td class="px-4 py-3">
                      <div class="relative group/img">
                        <div
                          v-if="shot.sceneImage"
                          class="w-[160px] h-[90px] rounded-xl overflow-hidden border border-white/10"
                        >
                          <img :src="shot.sceneImage" class="w-full h-full object-cover" />
                        </div>
                        <label
                          v-else
                          class="flex flex-col items-center justify-center w-[160px] h-[90px] rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 cursor-pointer transition-colors bg-white/[0.02]"
                        >
                          <Upload :size="20" class="text-slate-600 mb-1" />
                          <span class="text-[10px] text-slate-600">上传分镜图</span>
                          <input
                            type="file"
                            accept="image/*"
                            class="hidden"
                            @change="handleImageUpload($event, shot.id, 'scene')"
                          />
                        </label>
                        <!-- Replace button on hover -->
                        <label
                          v-if="shot.sceneImage"
                          class="absolute inset-0 w-[160px] h-[90px] flex items-center justify-center bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer rounded-xl"
                        >
                          <Upload :size="16" class="text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            class="hidden"
                            @change="handleImageUpload($event, shot.id, 'scene')"
                          />
                        </label>
                      </div>
                    </td>

                    <!-- Shot Number -->
                    <td v-if="visibleColumns.shotNumber" class="px-4 py-3 text-center">
                      <div class="w-8 h-8 mx-auto rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">
                        {{ shot.shotNumber }}
                      </div>
                    </td>

                    <!-- Duration -->
                    <td v-if="visibleColumns.duration" class="px-4 py-3 text-center">
                      <input
                        type="number"
                        v-model.number="shot.duration"
                        min="0"
                        class="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="0"
                      />
                    </td>

                    <!-- Scene Type -->
                    <td v-if="visibleColumns.sceneType" class="px-4 py-3">
                      <select
                        v-model="shot.sceneType"
                        class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer"
                      >
                        <option v-for="type in sceneTypes" :key="type" :value="type">{{ type }}</option>
                      </select>
                    </td>

                    <!-- Camera Movement -->
                    <td v-if="visibleColumns.cameraMovement" class="px-4 py-3">
                      <div class="relative">
                        <select
                          v-model="shot.cameraMovement"
                          class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer"
                        >
                          <option v-for="move in cameraMovements" :key="move" :value="move">{{ move }}</option>
                        </select>
                      </div>
                    </td>

                    <!-- Description -->
                    <td v-if="visibleColumns.description" class="px-4 py-3">
                      <input
                        type="text"
                        v-model="shot.description"
                        class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="请输入"
                      />
                    </td>

                    <!-- Dialogue -->
                    <td v-if="visibleColumns.dialogue" class="px-4 py-3">
                      <input
                        type="text"
                        v-model="shot.dialogue"
                        class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="请输入"
                      />
                    </td>

                    <!-- Notes -->
                    <td v-if="visibleColumns.notes" class="px-4 py-3">
                      <input
                        type="text"
                        v-model="shot.notes"
                        class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="请输入"
                      />
                    </td>

                    <!-- Actions -->
                    <td class="px-4 py-3">
                      <div class="flex items-center justify-center gap-1">
                        <button
                          @click="emit('generateFromAI', shot.id)"
                          class="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          <Sparkles :size="12" />
                          AI分析镜头
                        </button>
                        <button
                          @click="duplicateShot(shot)"
                          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
                          title="复制"
                        >
                          <Copy :size="14" />
                        </button>
                        <button
                          @click="moveShot(shot.id, 'up')"
                          :disabled="shot.shotNumber === 1"
                          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上移"
                        >
                          <ChevronUp :size="14" />
                        </button>
                        <button
                          @click="moveShot(shot.id, 'down')"
                          :disabled="shot.shotNumber === shots.length"
                          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="下移"
                        >
                          <ChevronDown :size="14" />
                        </button>
                        <button
                          @click="deleteShot(shot.id)"
                          class="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-slate-500 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 :size="14" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Empty State -->
                  <tr v-if="shots.length === 0">
                    <td :colspan="Object.values(visibleColumns).filter(v => v).length + 4" class="py-20 text-center">
                      <div class="flex flex-col items-center gap-4 text-slate-500">
                        <Film :size="48" :stroke-width="1" class="opacity-30" />
                        <div>
                          <p class="text-sm font-medium">暂无分镜</p>
                          <p class="text-xs mt-1 opacity-60">点击"新增"按钮添加第一个分镜</p>
                        </div>
                        <button
                          @click="addShot()"
                          class="mt-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                        >
                          <Plus :size="14" class="inline mr-1" />
                          添加分镜
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>

            <!-- Grid View -->
            <template v-else>
              <div class="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <div
                  v-for="shot in shots"
                  :key="shot.id"
                  :class="[
                    'group relative rounded-2xl border overflow-hidden transition-all cursor-pointer hover:scale-[1.02]',
                    selectedShotIds.has(shot.id) ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-white/10 hover:border-white/20'
                  ]"
                  @click="toggleSelectShot(shot.id)"
                >
                  <!-- Image -->
                  <div class="aspect-video bg-[#1c1c1e] relative">
                    <img
                      v-if="shot.sceneImage"
                      :src="shot.sceneImage"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <label class="flex flex-col items-center cursor-pointer">
                        <Upload :size="24" class="text-slate-600 mb-1" />
                        <span class="text-[10px] text-slate-600">上传分镜图</span>
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleImageUpload($event, shot.id, 'scene')"
                          @click.stop
                        />
                      </label>
                    </div>

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
                    <div class="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                      <span class="px-1.5 py-0.5 bg-white/5 rounded">{{ shot.sceneType }}</span>
                      <span class="px-1.5 py-0.5 bg-white/5 rounded">{{ shot.cameraMovement }}</span>
                    </div>
                    <p class="text-xs text-slate-300 line-clamp-2">
                      {{ shot.description || '暂无描述' }}
                    </p>
                  </div>

                  <!-- Hover Actions -->
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      @click.stop="emit('generateFromAI', shot.id)"
                      class="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-300 transition-colors"
                      title="AI分析"
                    >
                      <Sparkles :size="16" />
                    </button>
                    <button
                      @click.stop="duplicateShot(shot)"
                      class="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                      title="复制"
                    >
                      <Copy :size="16" />
                    </button>
                    <button
                      @click.stop="deleteShot(shot.id)"
                      class="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </div>

                <!-- Add New Card -->
                <button
                  @click="addShot()"
                  class="aspect-video rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 flex flex-col items-center justify-center gap-2 transition-colors bg-white/[0.02] hover:bg-cyan-500/5"
                >
                  <Plus :size="24" class="text-slate-500" />
                  <span class="text-xs text-slate-500">添加分镜</span>
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: scale(0.95);
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

/* Custom scrollbar */
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

/* Custom select arrow */
select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

select option {
  background: #1c1c1e;
  color: white;
}
</style>

