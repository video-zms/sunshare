<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { Upload, X } from 'lucide-vue-next'

interface Props {
  // 输入框值
  modelValue?: string
  // 占位符
  placeholder?: string
  // 是否禁用
  disabled?: boolean
  // 是否只读
  readonly?: boolean
  // 是否必填
  required?: boolean
  // 最小长度
  minlength?: number
  // 最大长度
  maxlength?: number
  // 宽度（CSS 值）
  width?: string
  // 高度（CSS 值）
  height?: string
  // 最小高度
  minHeight?: string
  // 最大高度
  maxHeight?: string
  // 自定义类名
  customClass?: string
  // 是否自动聚焦
  autofocus?: boolean
  // 自动完成
  autocomplete?: string
  // textarea 行数
  rows?: number
  // 是否自动调整高度（类似 PromptInputTextarea 的 field-sizing-content）
  autoResize?: boolean
  // 名称（用于表单）
  name?: string
  // 参考图数组（base64 格式）
  referenceImages?: string[]
  // 是否启用参考图功能
  enableReferenceImages?: boolean
  // 最大参考图数量
  maxReferenceImages?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
  width: undefined,
  height: undefined,
  minHeight: undefined,
  maxHeight: undefined,
  customClass: '',
  autofocus: false,
  autocomplete: undefined,
  rows: 2,
  autoResize: true,
  name: undefined,
  referenceImages: () => [],
  enableReferenceImages: true,
  maxReferenceImages: 5
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'input': [event: Event]
  'change': [event: Event]
  'focus': [event: FocusEvent]
  'blur': [event: FocusEvent]
  'keydown': [event: KeyboardEvent]
  'paste': [event: ClipboardEvent]
  'update:referenceImages': [images: string[]]
  'referenceImageAdd': [image: string]
  'referenceImageRemove': [index: number]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isComposing = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 自动调整 textarea 高度（类似 PromptInputTextarea 的 field-sizing-content）
const adjustTextareaHeight = () => {
  if (!props.autoResize || !textareaRef.value) return
  
  const textarea = textareaRef.value
  textarea.style.height = 'auto'
  const scrollHeight = textarea.scrollHeight
  
  if (props.minHeight) {
    const minHeight = parseInt(props.minHeight)
    if (scrollHeight < minHeight) {
      textarea.style.height = props.minHeight
      return
    }
  }
  
  if (props.maxHeight) {
    const maxHeight = parseInt(props.maxHeight)
    if (scrollHeight > maxHeight) {
      textarea.style.height = props.maxHeight
      textarea.style.overflowY = 'auto'
      return
    }
  }
  
  textarea.style.height = `${scrollHeight}px`
  textarea.style.overflowY = 'hidden'
}

// 计算样式
const textareaStyle = computed(() => {
  const style: Record<string, string> = {}
  
  if (props.width !== undefined) {
    style.width = props.width
  }
  if (props.height !== undefined && !props.autoResize) {
    style.height = props.height
  }
  if (props.minHeight !== undefined) {
    style.minHeight = props.minHeight
  }
  if (props.maxHeight !== undefined) {
    style.maxHeight = props.maxHeight
  }
  
  return style
})

// 处理输入事件
const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  emit('input', event)
  
  // 自动调整高度
  if (props.autoResize) {
    adjustTextareaHeight()
  }
}

// 处理变化事件
const handleChange = (event: Event) => {
  emit('change', event)
}

// 处理聚焦事件
const handleFocus = (event: FocusEvent) => {
  emit('focus', event)
}

// 处理失焦事件
const handleBlur = (event: FocusEvent) => {
  emit('blur', event)
}

// 处理键盘事件（类似 PromptInputTextarea）
const handleKeyDown = (event: KeyboardEvent) => {
  // 处理 Enter 键（Shift+Enter 换行，Enter 提交）
  if (event.key === 'Enter') {
    if (isComposing.value || event.shiftKey) {
      return
    }
    // 可以在这里添加提交逻辑，但当前场景不需要
  }
  
  emit('keydown', event)
}

// 处理粘贴事件（支持图片粘贴）
const handlePaste = (event: ClipboardEvent) => {
  if (!props.enableReferenceImages) {
    emit('paste', event)
    return
  }

  const items = event.clipboardData?.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) {
          processImageFile(file)
        }
        return
      }
    }
  }

  emit('paste', event)
}

// 处理图片文件（转换为 base64）
const processImageFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    console.warn('文件不是图片类型')
    return
  }

  // 检查是否超过最大数量
  const currentImages = props.referenceImages || []
  if (currentImages.length >= props.maxReferenceImages) {
    console.warn(`参考图数量已达到最大值 ${props.maxReferenceImages}`)
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    if (result) {
      const newImages = [...currentImages, result]
      emit('update:referenceImages', newImages)
      emit('referenceImageAdd', result)
    }
  }
  reader.onerror = () => {
    console.error('读取图片文件失败')
  }
  reader.readAsDataURL(file)
}

// 处理文件上传
const handleFileUpload = (event: Event) => {
  if (props.disabled) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    processImageFile(file)
    input.value = ''
  }
}

// 删除参考图
const handleRemoveReferenceImage = (index: number) => {
  if (props.disabled) return
  const currentImages = props.referenceImages || []
  const newImages = currentImages.filter((_, i) => i !== index)
  emit('update:referenceImages', newImages)
  emit('referenceImageRemove', index)
}

// 打开文件选择器
const openFilePicker = () => {
  if (props.disabled) return
  fileInputRef.value?.click()
}

// 监听 modelValue 变化，调整 textarea 高度
watch(() => props.modelValue, () => {
  if (props.autoResize) {
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
})

// 组件挂载后调整高度
onMounted(() => {
  if (props.autoResize) {
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
})
</script>

<template>
  <div class="w-full">
    <!-- Textarea 输入框 -->
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :rows="rows"
      :minlength="minlength"
      :maxlength="maxlength"
      :autofocus="autofocus"
      :autocomplete="autocomplete"
      :name="name"
      :style="textareaStyle"
      :class="[
        'w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors',
        autoResize ? 'field-sizing-content' : '',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        readonly ? 'cursor-default' : '',
        customClass
      ]"
      @input="handleInput"
      @change="handleChange"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeyDown"
      @paste="handlePaste"
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false"
      @mousedown.stop
    />

    <!-- 参考图区域 -->
    <div v-if="enableReferenceImages" class="mt-2 space-y-2">
      <!-- 参考图列表 -->
      <div v-if="referenceImages && referenceImages.length > 0" class="flex flex-wrap gap-2">
        <div
          v-for="(image, index) in referenceImages"
          :key="index"
          class="relative group/ref-img"
        >
          <div class="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-white/5">
            <img
              :src="image"
              class="w-full h-full object-cover"
              alt="参考图"
            />
          </div>
          <!-- 删除按钮 -->
          <button
            v-if="!disabled"
            @click="handleRemoveReferenceImage(index)"
            class="absolute -top-1 -right-1 p-0.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white opacity-0 group-hover/ref-img:opacity-100 transition-opacity z-10"
            title="删除参考图"
          >
            <X :size="12" />
          </button>
        </div>
      </div>

      <!-- 上传按钮 -->
      <div v-if="!disabled && (!referenceImages || referenceImages.length < maxReferenceImages)" class="flex items-center gap-2">
        <button
          @click="openFilePicker"
          class="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-colors"
          title="上传参考图"
        >
          <Upload :size="12" />
          <span>添加参考图</span>
        </button>
        <span v-if="referenceImages && referenceImages.length > 0" class="text-[10px] text-slate-500">
          {{ referenceImages.length }}/{{ maxReferenceImages }}
        </span>
      </div>

      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileUpload"
      />
    </div>
  </div>
</template>

<style scoped>
/* field-sizing-content 的 polyfill，如果浏览器不支持 */
.field-sizing-content {
  field-sizing: content;
}

/* 对于不支持 field-sizing 的浏览器，使用 JavaScript 自动调整 */
@supports not (field-sizing: content) {
  .field-sizing-content {
    overflow: hidden;
  }
}
</style>

