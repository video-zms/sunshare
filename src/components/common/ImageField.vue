<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Sparkles, Loader2, Crop, AlertCircle, Trash2, Download } from 'lucide-vue-next'
import UploadButton from './UploadButton.vue'
import ExpandedView from '../ExpandedView.vue'
import ImageCropper from '../ImageCropper.vue'

interface Props {
  // 图片 URL（base64 或普通 URL）
  image?: string | null
  // 是否正在生成
  isGenerating?: boolean
  // 图片尺寸配置
  width?: string
  height?: string
  // 上传按钮文本
  uploadText?: string
  // 是否禁用上传
  disabled?: boolean
  // 是否禁用生成
  disableGenerate?: boolean
  // 是否禁用预览
  disablePreview?: boolean
  // 是否禁用裁剪
  disableCrop?: boolean
  // 上传后是否自动打开裁剪器（默认 false）
  autoCrop?: boolean
  // 是否禁用删除
  disableDelete?: boolean
  // 是否禁用下载
  disableDownload?: boolean
  // 是否启用拖拽上传
  enableDragDrop?: boolean
  // 接受的文件类型
  accept?: string
  // 自定义类名
  customClass?: string
  // 参考图数组（用于生成时作为参考）
  referenceImages?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  image: null,
  isGenerating: false,
  width: '160px',
  height: '90px',
  uploadText: '上传图片',
  disabled: false,
  disableGenerate: false,
  disablePreview: false,
  disableCrop: false,
  autoCrop: false,
  disableDelete: false,
  disableDownload: false,
  enableDragDrop: true,
  accept: 'image/*',
  customClass: '',
  referenceImages: () => []
})

const emit = defineEmits<{
  // 上传事件
  upload: [event: Event]
  // 生成事件（可传递参考图）
  generate: [referenceImages?: string[]]
  // 删除事件
  delete: []
  // 图片变化事件（上传或生成后）
  change: [image: string | null]
}>()

const expandedMedia = ref<{ src: string, type: 'image' } | null>(null)
const showCropper = ref(false)
const cropImageSrc = ref<string>('')
const isDragging = ref(false)
const imageError = ref(false)
const containerRef = ref<HTMLDivElement | null>(null)

const handleImageClick = () => {
  if (props.disablePreview || !props.image || imageError.value) return
  expandedMedia.value = {
    src: props.image,
    type: 'image'
  }
}

const processFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    console.warn('文件不是图片类型')
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    // 只有在启用自动裁剪且未禁用裁剪功能时才自动打开裁剪器
    if (props.autoCrop && !props.disableCrop) {
      cropImageSrc.value = result
      showCropper.value = true
    } else {
      // 否则直接使用图片
      emit('change', result)
    }
  }
  reader.onerror = () => {
    console.error('读取文件失败')
    imageError.value = true
  }
  reader.readAsDataURL(file)
}

const handleUpload = (event: Event) => {
  if (props.disabled) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  processFile(file)
  input.value = ''
  emit('upload', event)
}

const handleGenerate = () => {
  if (props.disableGenerate || props.isGenerating) return
  // 传递参考图（如果有）
  emit('generate', props.referenceImages && props.referenceImages.length > 0 ? props.referenceImages : undefined)
}

const handleDelete = () => {
  if (props.disableDelete) return
  emit('delete')
  emit('change', null)
}

// 处理下载
const handleDownload = async () => {
  if (props.disableDownload || !props.image) return

  try {
    const imageUrl = props.image
    let fileName = `image-${Date.now()}.png`

    // 如果是 base64 格式，直接下载
    if (imageUrl.startsWith('data:image/')) {
      const a = document.createElement('a')
      a.href = imageUrl
      // 从 base64 中提取文件扩展名
      const match = imageUrl.match(/data:image\/(\w+);base64/)
      if (match && match[1]) {
        fileName = `image-${Date.now()}.${match[1]}`
      }
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    // 如果是 blob URL，直接下载
    if (imageUrl.startsWith('blob:')) {
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    // 如果是普通 URL，通过 fetch 获取（处理跨域问题）
    try {
      const response = await fetch(imageUrl, { mode: 'cors' })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      // 从响应头或 URL 中获取文件扩展名
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.startsWith('image/')) {
        const ext = contentType.split('/')[1].split(';')[0] // 处理 content-type 中的参数
        fileName = `image-${Date.now()}.${ext}`
      } else {
        // 从 URL 中提取扩展名
        try {
          const urlObj = new URL(imageUrl)
          const pathname = urlObj.pathname
          const urlExt = pathname.split('.').pop()?.toLowerCase()
          if (urlExt && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(urlExt)) {
            fileName = `image-${Date.now()}.${urlExt}`
          }
        } catch {
          // URL 解析失败，使用默认扩展名
        }
      }

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      // 清理 blob URL
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (fetchError) {
      // fetch 失败（可能是跨域或网络问题），尝试直接打开
      console.warn('通过 fetch 下载失败，尝试直接打开:', fetchError)
      const a = document.createElement('a')
      a.href = imageUrl
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } catch (error) {
    console.error('下载图片失败:', error)
  }
}

const handleClosePreview = () => {
  expandedMedia.value = null
}

const handleCropConfirm = (croppedBase64: string) => {
  emit('change', croppedBase64)
  showCropper.value = false
  cropImageSrc.value = ''
}

const handleCropCancel = () => {
  showCropper.value = false
  cropImageSrc.value = ''
}

// 拖拽上传处理
const handleDragEnter = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

const handleDragOver = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
}

const handleDragLeave = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
  // 只有当离开容器时才取消拖拽状态
  if (e.target === containerRef.value) {
    isDragging.value = false
  }
}

const handleDrop = (e: DragEvent) => {
  if (props.disabled || !props.enableDragDrop) return
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('image/')) {
      processFile(file)
    }
  }
}

// 图片加载错误处理
const handleImageError = () => {
  imageError.value = true
}

const handleImageLoad = () => {
  imageError.value = false
}

// 监听容器拖拽事件
onMounted(() => {
  if (containerRef.value && props.enableDragDrop) {
    containerRef.value.addEventListener('dragenter', handleDragEnter)
    containerRef.value.addEventListener('dragover', handleDragOver)
    containerRef.value.addEventListener('dragleave', handleDragLeave)
    containerRef.value.addEventListener('drop', handleDrop)
  }
})

onUnmounted(() => {
  if (containerRef.value && props.enableDragDrop) {
    containerRef.value.removeEventListener('dragenter', handleDragEnter)
    containerRef.value.removeEventListener('dragover', handleDragOver)
    containerRef.value.removeEventListener('dragleave', handleDragLeave)
    containerRef.value.removeEventListener('drop', handleDrop)
  }
})

const dragOverlayClass = computed(() => {
  return isDragging.value
    ? 'opacity-100 border-cyan-500 bg-cyan-500/10'
    : 'opacity-0'
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative group/img"
    :class="[customClass, enableDragDrop ? 'cursor-pointer' : '']"
  >
    <!-- 有图片时显示图片 -->
    <div
      v-if="image && !imageError"
      :class="[
        'rounded-xl overflow-hidden border border-white/10 cursor-pointer transition-all hover:border-white/20',
        disablePreview ? '' : 'hover:shadow-lg hover:shadow-cyan-500/20'
      ]"
      :style="{
        width: width,
        height: height
      }"
      @click="handleImageClick"
    >
      <img
        :src="image"
        class="w-full h-full object-cover"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </div>

    <!-- 图片加载失败 -->
    <div
      v-else-if="image && imageError"
      :class="[
        'rounded-xl overflow-hidden border border-red-500/30 bg-red-500/5 flex flex-col items-center justify-center',
        disablePreview ? '' : 'cursor-pointer'
      ]"
      :style="{
        width: width,
        height: height
      }"
      @click="handleImageClick"
    >
      <AlertCircle :size="20" class="text-red-400 mb-1" />
      <span class="text-[10px] text-red-400">图片加载失败</span>
    </div>

    <!-- 没有图片时显示上传区域 -->
    <div v-else class="relative" :style="{ width: width, height: height }">
      <UploadButton
        mode="empty"
        :accept="accept"
        :empty-config="{
          width: width,
          height: height,
          text: uploadText
        }"
        :disabled="disabled"
        @change="handleUpload"
      />
      
      <!-- 没有图片时也显示操作按钮 -->
      <div
        class="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl"
        @click.stop
      >
        <!-- 生成按钮 -->
        <button
          v-if="!disableGenerate"
          @click.stop="handleGenerate"
          :disabled="isGenerating"
          class="p-2 bg-purple-500/80 hover:bg-purple-500 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="AI生成图片"
        >
          <Loader2 v-if="isGenerating" :size="14" class="animate-spin" />
          <Sparkles v-else :size="14" />
        </button>

        <!-- 上传按钮 -->
        <UploadButton
          mode="button"
          :accept="accept"
          :disabled="disabled"
          :button-config="{
            size: 'md',
            variant: 'default',
            iconSize: 14,
            showText: false
          }"
          custom-class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"
          @change="handleUpload"
        />
      </div>
    </div>

    <!-- 拖拽上传提示层 -->
    <div
      v-if="enableDragDrop && !image"
      :class="[
        'absolute inset-0 rounded-xl border-2 border-dashed transition-all pointer-events-none flex items-center justify-center',
        dragOverlayClass
      ]"
      :style="{
        width: width,
        height: height
      }"
    >
      <div class="text-center">
        <div class="text-cyan-400 text-sm font-medium mb-1">松开以上传</div>
        <div class="text-[10px] text-cyan-400/70">支持拖拽图片文件</div>
      </div>
    </div>

    <!-- 删除按钮 - 固定在右上角 -->
    <button
      v-if="image && !imageError && !disableDelete"
      @click.stop="handleDelete"
      class="absolute top-1 right-1 p-1 hover:text-red-500 rounded-md text-white transition-all opacity-0 group-hover/img:opacity-100 z-20 shadow-lg"
      title="删除图片"
    >
      <Trash2 :size="12" />
    </button>

    <!-- 悬停时显示操作按钮 -->
    <div
      v-if="image && !imageError"
      class="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl"
      :style="{
        width: width,
        height: height
      }"
      @click.stop
    >
      <!-- 生成按钮 -->
      <button
        v-if="!disableGenerate"
        @click="handleGenerate"
        :disabled="isGenerating"
        class="p-2 bg-purple-500/80 hover:bg-purple-500 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :title="image ? '重新生成' : 'AI生成'"
      >
        <Loader2 v-if="isGenerating" :size="14" class="animate-spin" />
        <Sparkles v-else :size="14" />
      </button>

      <!-- 裁剪按钮 -->
      <button
        v-if="!disableCrop"
        @click.stop="() => { cropImageSrc = image || ''; showCropper = true }"
        class="p-2 bg-blue-500/80 hover:bg-blue-500 rounded-lg text-white transition-all"
        title="裁剪图片"
      >
        <Crop :size="14" />
      </button>

      <!-- 下载按钮 -->
      <button
        v-if="!disableDownload"
        @click.stop="handleDownload"
        class="p-2 bg-green-500/80 hover:bg-green-500 rounded-lg text-white transition-all"
        title="下载图片"
      >
        <Download :size="14" />
      </button>

      <!-- 上传按钮 -->
      <UploadButton
        mode="button"
        :accept="accept"
        :disabled="disabled"
        :button-config="{
          size: 'md',
          variant: 'default',
          iconSize: 14,
          showText: false
        }"
        custom-class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"
        @change="handleUpload"
      />
    </div>

    <!-- 预览大图 -->
    <ExpandedView :media="expandedMedia" @close="handleClosePreview" />

    <!-- 图片裁剪器 -->
    <ImageCropper
      v-if="showCropper && cropImageSrc"
      :image-src="cropImageSrc"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>

