<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import ImageField from '../common/ImageField.vue'
import type { StoryCharacter } from '../../types'

interface Props {
  characters: StoryCharacter[]
  colorOptions: string[]
  generatingCharacterIds: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'add-character': []
  'delete-character': [id: string]
  'update-character': [character: StoryCharacter]
  'image-upload': [e: Event, characterId: string]
  'generate-image': [characterId: string]
}>()

const handleImageChange = (characterId: string, image: string | null) => {
  const char = props.characters.find(c => c.id === characterId)
  if (char) {
    emit('update-character', { ...char, image: image || undefined })
  }
}

const handleImageUpload = (e: Event, characterId: string) => {
  emit('image-upload', e, characterId)
}

const handleCharacterUpdate = (char: StoryCharacter, field: keyof StoryCharacter, value: any) => {
  emit('update-character', { ...char, [field]: value })
}
</script>

<template>
  <div class="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    <div
      v-for="char in characters"
      :key="char.id"
      class="group relative rounded-2xl border border-white/10 overflow-hidden bg-[#1c1c1e] hover:border-white/20 transition-all"
    >
      <!-- Character Avatar -->
      <div class="aspect-square relative bg-black/20">
        <ImageField
          :image="char.image"
          :is-generating="generatingCharacterIds.has(char.id)"
          width="100%"
          height="100%"
          upload-text="上传头像"
          accept="image/*"
          custom-class="w-full h-full"
          @upload="(e) => handleImageUpload(e, char.id)"
          @generate="emit('generate-image', char.id)"
          @change="(img) => handleImageChange(char.id, img)"
        />
        <!-- Color indicator -->
        <div
          class="absolute top-2 left-2 w-4 h-4 rounded-full border-2 border-white/30 z-10 pointer-events-none"
          :style="{ backgroundColor: char.color }"
        />
      </div>

      <!-- Character Info -->
      <div class="p-3">
        <div class="flex items-center gap-2 mb-2">
          <input
            :value="char.name"
            @input="handleCharacterUpdate(char, 'name', ($event.target as HTMLInputElement).value)"
            class="flex-1 bg-transparent border-none outline-none text-sm font-bold text-white placeholder-slate-500"
            placeholder="角色名称"
            @mousedown.stop
          />
          <!-- Color picker -->
          <div class="relative group/color">
            <button
              class="w-5 h-5 rounded-full border border-white/20 hover:border-white/40 transition-colors"
              :style="{ backgroundColor: char.color }"
            />
            <div class="absolute bottom-full right-0 mb-2 p-2 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover/color:opacity-100 group-hover/color:pointer-events-auto transition-all z-50">
              <div class="grid grid-cols-7 gap-1">
                <button
                  v-for="color in colorOptions"
                  :key="color"
                  class="w-4 h-4 rounded-full border border-white/10 hover:scale-110 transition-transform"
                  :style="{ backgroundColor: color }"
                  @click="handleCharacterUpdate(char, 'color', color)"
                />
              </div>
            </div>
          </div>
        </div>
        <textarea
          :value="char.description"
          @input="handleCharacterUpdate(char, 'description', ($event.target as HTMLTextAreaElement).value)"
          class="w-full bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-purple-500/50"
          placeholder="角色描述..."
          rows="2"
          @mousedown.stop
        />
      </div>

      <!-- Action buttons -->
      <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          @click.stop="emit('delete-character', char.id)"
          class="p-1.5 bg-black/60 hover:bg-red-500/80 rounded-lg text-slate-400 hover:text-white transition-all"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Add Character Card -->
    <button
      @click="emit('add-character')"
      class="aspect-square rounded-2xl border-2 border-dashed border-white/10 hover:border-purple-500/50 flex flex-col items-center justify-center gap-2 transition-colors bg-white/[0.02] hover:bg-purple-500/5"
    >
      <Plus :size="24" class="text-slate-500" />
      <span class="text-xs text-slate-500">添加人物</span>
    </button>
  </div>
</template>

