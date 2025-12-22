<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import ImageField from '../common/ImageField.vue'
import type { StoryProp } from '../../types'

interface Props {
  storyProps: StoryProp[]
  colorOptions: string[]
  generatingPropIds: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'add-prop': []
  'delete-prop': [id: string]
  'update-prop': [prop: StoryProp]
  'image-upload': [e: Event, propId: string]
  'generate-image': [propId: string, referenceImages?: string[]]
}>()

const handleImageChange = (propId: string, image: string | null) => {
  const prop = props.storyProps.find(p => p.id === propId)
  if (prop) {
    emit('update-prop', { ...prop, image: image || undefined })
  }
}

const handleImageUpload = (e: Event, propId: string) => {
  emit('image-upload', e, propId)
}

const handlePropUpdate = (prop: StoryProp, field: keyof StoryProp, value: any) => {
  emit('update-prop', { ...prop, [field]: value })
}
</script>

<template>
  <div class="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    <div
      v-for="prop in storyProps"
      :key="prop.id"
      class="group relative rounded-2xl border border-white/10 overflow-hidden bg-[#1c1c1e] hover:border-white/20 transition-all"
    >
      <!-- Prop Image -->
      <div class="aspect-square relative bg-black/20">
        <ImageField
          :image="prop.image"
          :is-generating="generatingPropIds.has(prop.id)"
          width="100%"
          height="100%"
          upload-text="上传道具图"
          accept="image/*"
          custom-class="w-full h-full"
          @upload="(e) => handleImageUpload(e, prop.id)"
          @generate="(refImages) => emit('generate-image', prop.id, refImages)"
          @change="(img) => handleImageChange(prop.id, img)"
          :reference-images="prop.image ? [prop.image] : []"
        />
        <!-- Color indicator -->
        <div
          class="absolute top-2 left-2 w-4 h-4 rounded-full border-2 border-white/30 z-10 pointer-events-none"
          :style="{ backgroundColor: prop.color }"
        />
      </div>

      <!-- Prop Info -->
      <div class="p-3">
        <div class="flex items-center gap-2 mb-2">
          <input
            :value="prop.name"
            @input="handlePropUpdate(prop, 'name', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-transparent border-none outline-none text-sm font-bold text-white placeholder-slate-500"
            placeholder="道具名称"
            @mousedown.stop
          />
          <!-- Color picker -->
          <div class="relative group/color">
            <button
              class="w-5 h-5 rounded-full border border-white/20 hover:border-white/40 transition-colors"
              :style="{ backgroundColor: prop.color }"
            />
            <div class="absolute bottom-full right-0 mb-2 p-2 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover/color:opacity-100 group-hover/color:pointer-events-auto transition-all z-50">
              <div class="grid grid-cols-7 gap-1">
                <button
                  v-for="color in colorOptions"
                  :key="color"
                  class="w-4 h-4 rounded-full border border-white/10 hover:scale-110 transition-transform"
                  :style="{ backgroundColor: color }"
                  @click="handlePropUpdate(prop, 'color', color)"
                />
              </div>
            </div>
          </div>
        </div>
        <textarea
          :value="prop.description"
          @input="handlePropUpdate(prop, 'description', ($event.target as HTMLTextAreaElement).value)"
          class="w-full bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/50"
          placeholder="道具描述..."
          rows="2"
          @mousedown.stop
        />
      </div>

      <!-- Action buttons -->
      <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          @click.stop="emit('delete-prop', prop.id)"
          class="p-1.5 bg-black/60 hover:bg-red-500/80 rounded-lg text-slate-400 hover:text-white transition-all"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Add Prop Card -->
    <button
      @click="emit('add-prop')"
      class="aspect-square rounded-2xl border-2 border-dashed border-white/10 hover:border-orange-500/50 flex flex-col items-center justify-center gap-2 transition-colors bg-white/[0.02] hover:bg-orange-500/5"
    >
      <Plus :size="24" class="text-slate-500" />
      <span class="text-xs text-slate-500">添加道具</span>
    </button>
  </div>
</template>

