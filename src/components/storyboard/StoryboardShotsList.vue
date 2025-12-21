<script setup lang="ts">
import { computed, withDefaults } from 'vue'
import { Film, Plus, List, LayoutGrid } from 'lucide-vue-next'
import type { StoryboardShot, SceneType, CameraMovement, StoryScene, StoryCharacter, StoryProp } from '../../types'
import ShotTableRow from './ShotTableRow.vue'
import ShotGridCard from './ShotGridCard.vue'

interface Props {
  shots: StoryboardShot[]
  scenes: StoryScene[]
  characters: StoryCharacter[]
  storyProps?: StoryProp[]
  sceneTypes: SceneType[]
  cameraMovements: CameraMovement[]
  visibleColumns: Record<string, boolean>
  selectedShotIds: Set<string>
  draggedShotId: string | null
  generatingShotIds: Set<string>
  viewMode: 'list' | 'grid'
}

const props = withDefaults(defineProps<Props>(), {
  storyProps: () => []
})

const emit = defineEmits<{
  'update:shots': [shots: StoryboardShot[]]
  'update:viewMode': [mode: 'list' | 'grid']
  'toggle-select-all': []
  'toggle-select': [id: string]
  'drag-start': [e: DragEvent, id: string]
  'drag-over': [e: DragEvent]
  'drop': [e: DragEvent, id: string]
  'drag-end': []
  'image-upload': [e: Event, shotId: string, type: 'scene' | 'character']
  'generate-image': [shotId: string]
  'generate-video': [shotId: string]
  'generate-from-ai': [shotId: string]
  'duplicate': [shot: StoryboardShot]
  'move-up': [id: string]
  'move-down': [id: string]
  'delete': [id: string]
  'toggle-scene': [shotId: string, sceneId: string]
  'toggle-character': [shotId: string, characterId: string]
  'toggle-prop': [shotId: string, propId: string]
  'add-shot': []
}>()

const allSelected = computed(() => {
  return props.shots.length > 0 && props.selectedShotIds.size === props.shots.length
})

const handleShotUpdate = (shot: StoryboardShot) => {
  const index = props.shots.findIndex(s => s.id === shot.id)
  if (index !== -1) {
    const newShots = [...props.shots]
    newShots[index] = shot
    emit('update:shots', newShots)
  }
}
</script>

<template>
  <div>
    <!-- View Mode Toggle -->
    <div class="flex items-center gap-1 px-6 py-3 border-b border-white/5 bg-[#18181b]/30">
      <div class="flex-1" />
      <div class="flex items-center bg-white/5 rounded-xl p-1">
        <button
          @click="emit('update:viewMode', 'list')"
          :class="[
            'p-2 rounded-lg transition-all',
            viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
          ]"
        >
          <List :size="16" />
        </button>
        <button
          @click="emit('update:viewMode', 'grid')"
          :class="[
            'p-2 rounded-lg transition-all',
            viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'
          ]"
        >
          <LayoutGrid :size="16" />
        </button>
      </div>
    </div>

    <!-- List View -->
    <template v-if="viewMode === 'list'">
      <table class="w-full border-collapse">
        <thead class="sticky top-0 z-10 bg-[#18181b]">
          <tr class="text-xs text-slate-500 uppercase tracking-wider">
            <th class="px-4 py-3 text-left w-12">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="emit('toggle-select-all')"
                class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
              />
            </th>
            <th class="px-4 py-3 text-left w-12"></th>
            <th class="px-4 py-3 text-left w-[200px]">分镜图</th>
            <th v-if="visibleColumns.video" class="px-4 py-3 text-left w-[200px]">视频</th>
            <th v-if="visibleColumns.shotNumber" class="px-4 py-3 text-center w-16">镜号</th>
            <th v-if="visibleColumns.duration" class="px-4 py-3 text-center w-20">时长(秒)</th>
            <th v-if="visibleColumns.sceneType" class="px-4 py-3 text-left w-24">景别</th>
            <th v-if="visibleColumns.cameraMovement" class="px-4 py-3 text-left w-32">运镜</th>
            <th v-if="visibleColumns.scene" class="px-4 py-3 text-left w-32">场景</th>
            <th v-if="visibleColumns.characters" class="px-4 py-3 text-left w-40">人物</th>
            <th v-if="visibleColumns.props" class="px-4 py-3 text-left w-40">道具</th>
            <th v-if="visibleColumns.description" class="px-4 py-3 text-left min-w-[150px]">描述</th>
            <th v-if="visibleColumns.dialogue" class="px-4 py-3 text-left min-w-[120px]">台词</th>
            <th v-if="visibleColumns.notes" class="px-4 py-3 text-left min-w-[120px]">备注</th>
            <th class="px-4 py-3 text-center w-[180px]">操作</th>
          </tr>
        </thead>
        <tbody>
          <ShotTableRow
            v-for="shot in shots"
            :key="shot.id"
            :shot="shot"
            :scenes="scenes"
            :characters="characters"
            :story-props="storyProps"
            :scene-types="sceneTypes"
            :camera-movements="cameraMovements"
            :visible-columns="visibleColumns"
            :is-selected="selectedShotIds.has(shot.id)"
            :is-dragged="draggedShotId === shot.id"
            :is-generating="generatingShotIds.has(shot.id)"
            @update:shot="handleShotUpdate"
            @toggle-select="emit('toggle-select', shot.id)"
            @drag-start="emit('drag-start', $event, shot.id)"
            @drag-over="emit('drag-over', $event)"
            @drop="emit('drop', $event, shot.id)"
            @drag-end="emit('drag-end')"
            @image-upload="(e, type) => emit('image-upload', e, shot.id, type)"
            @generate-image="emit('generate-image', shot.id)"
            @generate-video="emit('generate-video', shot.id)"
            @generate-from-ai="emit('generate-from-ai', shot.id)"
            @duplicate="emit('duplicate', shot)"
            @move-up="emit('move-up', shot.id)"
            @move-down="emit('move-down', shot.id)"
            @delete="emit('delete', shot.id)"
            @toggle-scene="(sceneId) => emit('toggle-scene', shot.id, sceneId)"
            @toggle-character="(charId) => emit('toggle-character', shot.id, charId)"
            @toggle-prop="(propId) => emit('toggle-prop', shot.id, propId)"
          />

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
                  @click="emit('add-shot')"
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
        <ShotGridCard
          v-for="shot in shots"
          :key="shot.id"
          :shot="shot"
          :scenes="scenes"
          :characters="characters"
          :is-selected="selectedShotIds.has(shot.id)"
          :is-generating="generatingShotIds.has(shot.id)"
          @toggle-select="emit('toggle-select', shot.id)"
          @image-upload="emit('image-upload', $event, shot.id, 'scene')"
          @generate-image="emit('generate-image', shot.id)"
          @generate-from-ai="emit('generate-from-ai', shot.id)"
          @duplicate="emit('duplicate', shot)"
          @delete="emit('delete', shot.id)"
        />

        <!-- Add New Card -->
        <button
          @click="emit('add-shot')"
          class="aspect-video rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 flex flex-col items-center justify-center gap-2 transition-colors bg-white/[0.02] hover:bg-cyan-500/5"
        >
          <Plus :size="24" class="text-slate-500" />
          <span class="text-xs text-slate-500">添加分镜</span>
        </button>
      </div>
    </template>
  </div>
</template>

