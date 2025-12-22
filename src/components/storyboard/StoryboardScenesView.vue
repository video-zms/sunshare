<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import ImageField from '../common/ImageField.vue'
import PromptTextarea from '../common/PromptTextarea.vue'
import type { StoryScene } from '../../types'

interface Props {
  scenes: StoryScene[]
  colorOptions: string[]
  generatingSceneIds: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'add-scene': []
  'delete-scene': [id: string]
  'update-scene': [scene: StoryScene]
  'image-upload': [e: Event, sceneId: string]
  'generate-image': [sceneId: string, referenceImages?: string[]]
}>()

const handleImageChange = (sceneId: string, image: string | null) => {
  const scene = props.scenes.find(s => s.id === sceneId)
  if (scene) {
    emit('update-scene', { ...scene, image: image || undefined })
  }
}

const handleImageUpload = (e: Event, sceneId: string) => {
  emit('image-upload', e, sceneId)
}

const handleSceneUpdate = (scene: StoryScene, field: keyof StoryScene, value: any) => {
  emit('update-scene', { ...scene, [field]: value })
}
</script>

<template>
  <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <div
      v-for="scene in scenes"
      :key="scene.id"
      class="group relative rounded-2xl border border-white/10 overflow-hidden bg-[#1c1c1e] hover:border-white/20 transition-all"
    >
      <!-- Scene Image -->
      <div class="aspect-video relative bg-black/20">
        <ImageField
          :image="scene.image"
          :is-generating="generatingSceneIds.has(scene.id)"
          width="100%"
          height="100%"
          upload-text="上传场景图"
          accept="image/*"
          custom-class="w-full h-full"
          @upload="(e) => handleImageUpload(e, scene.id)"
          @generate="(refImages) => emit('generate-image', scene.id, refImages)"
          @change="(img) => handleImageChange(scene.id, img)"
          :reference-images="scene.image ? [scene.image] : []"
        />
        <!-- Color indicator -->
        <div
          class="absolute top-2 left-2 w-4 h-4 rounded-full border-2 border-white/30 z-10 pointer-events-none"
          :style="{ backgroundColor: scene.color }"
        />
      </div>

      <!-- Scene Info -->
      <div class="p-4">
        <div class="flex items-center gap-2 mb-2">
          <input
            :value="scene.name"
            @input="handleSceneUpdate(scene, 'name', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-transparent border-none outline-none text-sm font-bold text-white placeholder-slate-500"
            placeholder="场景名称"
            @mousedown.stop
          />
          <!-- Color picker -->
          <div class="relative group/color">
            <button
              class="w-6 h-6 rounded-full border border-white/20 hover:border-white/40 transition-colors"
              :style="{ backgroundColor: scene.color }"
            />
            <div class="absolute bottom-full right-0 mb-2 p-2 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover/color:opacity-100 group-hover/color:pointer-events-auto transition-all z-50">
              <div class="grid grid-cols-7 gap-1">
                <button
                  v-for="color in colorOptions"
                  :key="color"
                  class="w-5 h-5 rounded-full border border-white/10 hover:scale-110 transition-transform"
                  :style="{ backgroundColor: color }"
                  @click="handleSceneUpdate(scene, 'color', color)"
                />
              </div>
            </div>
          </div>
        </div>
        <PromptTextarea
          :model-value="scene.description"
          @update:model-value="(value: string) => handleSceneUpdate(scene, 'description', value)"
          placeholder="场景描述..."
          :rows="2"
          :auto-resize="true"
          min-height="48px"
          max-height="120px"
          custom-class="w-full"
        />
      </div>

      <!-- Action buttons -->
      <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          @click.stop="emit('delete-scene', scene.id)"
          class="p-1.5 bg-black/60 hover:bg-red-500/80 rounded-lg text-slate-400 hover:text-white transition-all"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Add Scene Card -->
    <button
      @click="emit('add-scene')"
      class="aspect-video rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 flex flex-col items-center justify-center gap-2 transition-colors bg-white/[0.02] hover:bg-emerald-500/5"
    >
      <Plus :size="24" class="text-slate-500" />
      <span class="text-xs text-slate-500">添加场景</span>
    </button>
  </div>
</template>

