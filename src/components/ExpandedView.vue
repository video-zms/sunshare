<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next'

interface Props {
  media: {
    src?: string
    type?: 'image' | 'video'
    images?: string[]
    initialIndex?: number
  } | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const visible = ref(false)
const currentIndex = ref(0)

const hasMultiple = computed(() => props.media?.images && props.media.images.length > 1)

const currentSrc = computed(() => {
  if (hasMultiple.value && props.media?.images) {
    return props.media.images[currentIndex.value]
  }
  return props.media?.src || ''
})

const isVideo = computed(() => {
  return props.media?.type === 'video' && !currentSrc.value.startsWith('data:image')
})

watch(() => props.media, (newMedia) => {
  if (newMedia) {
    requestAnimationFrame(() => {
      visible.value = true
    })
    currentIndex.value = newMedia.initialIndex || 0
  } else {
    visible.value = false
  }
}, { immediate: true })

const handleClose = () => {
  visible.value = false
  setTimeout(() => {
    emit('close')
  }, 400)
}

const handleNext = (e?: Event) => {
  e?.stopPropagation()
  if (hasMultiple.value && props.media?.images) {
    currentIndex.value = (currentIndex.value + 1) % props.media.images.length
  }
}

const handlePrev = (e?: Event) => {
  e?.stopPropagation()
  if (hasMultiple.value && props.media?.images) {
    currentIndex.value = (currentIndex.value - 1 + props.media.images.length) % props.media.images.length
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!visible.value) return
  if (e.key === 'Escape') handleClose()
  if (e.key === 'ArrowRight') handleNext()
  if (e.key === 'ArrowLeft') handlePrev()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    v-if="media"
    :class="[
      'fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500',
      visible ? 'bg-black/90 backdrop-blur-xl' : 'bg-transparent pointer-events-none opacity-0'
    ]"
    @click="handleClose"
  >
    <div
      :class="[
        'relative w-full h-full flex items-center justify-center p-8 transition-all duration-500',
        visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
      ]"
      @click.stop
    >
      <!-- Previous Button -->
      <button
        v-if="hasMultiple"
        class="absolute left-4 md:left-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110 z-[110]"
        @click="handlePrev"
      >
        <ChevronLeft :size="32" />
      </button>

      <!-- Media Content -->
      <div class="relative max-w-full max-h-full flex flex-col items-center">
        <img
          v-if="!isVideo"
          :key="`img-${currentSrc}`"
          :src="currentSrc"
          class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-[#0a0a0c]"
          draggable="false"
        />
        <video
          v-else
          :key="`video-${currentSrc}`"
          :src="currentSrc"
          class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-[#0a0a0c]"
          controls
          autoplay
          loop
          playsinline
          preload="auto"
        />

        <!-- Dots Indicator -->
        <div
          v-if="hasMultiple && media?.images"
          class="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2"
        >
          <div
            v-for="(_, i) in media.images"
            :key="i"
            :class="[
              'w-2.5 h-2.5 rounded-full cursor-pointer transition-all',
              i === currentIndex ? 'bg-cyan-500 scale-125' : 'bg-white/30 hover:bg-white/50'
            ]"
            @click.stop="currentIndex = i"
          />
        </div>
      </div>

      <!-- Next Button -->
      <button
        v-if="hasMultiple"
        class="absolute right-4 md:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110 z-[110]"
        @click="handleNext"
      >
        <ChevronRight :size="32" />
      </button>
    </div>

    <!-- Close Button -->
    <button
      class="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-[110]"
      @click="handleClose"
    >
      <X :size="24" />
    </button>
  </div>
</template>


