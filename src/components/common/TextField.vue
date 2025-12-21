<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'

interface Props {
  // 输入框值
  modelValue?: string | number
  // 输入框类型
  type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url' | 'search'
  // 占位符
  placeholder?: string
  // 是否禁用
  disabled?: boolean
  // 是否只读
  readonly?: boolean
  // 是否必填
  required?: boolean
  // 最小长度（文本）或最小值（数字）
  min?: number | string
  // 最大长度（文本）或最大值（数字）
  max?: number | string
  // 步长（数字类型）
  step?: number | string
  // 宽度（CSS 值，如 '100%', '200px', 'auto'，不传则自适应）
  width?: string
  // 高度（CSS 值，如 '40px', '200px'，不传则自适应）
  height?: string
  // 最小宽度
  minWidth?: string
  // 最大宽度
  maxWidth?: string
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
  // 输入模式（移动端）
  inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
  // 是否多行输入（使用 textarea）
  multiline?: boolean
  // textarea 行数（仅在 multiline 为 true 时有效）
  rows?: number
  // 是否自动调整 textarea 高度
  autoResize?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
  width: undefined,
  height: undefined,
  minWidth: undefined,
  maxWidth: undefined,
  minHeight: undefined,
  maxHeight: undefined,
  customClass: '',
  autofocus: false,
  autocomplete: undefined,
  inputmode: undefined,
  multiline: false,
  rows: 3,
  autoResize: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'input': [event: Event]
  'change': [event: Event]
  'focus': [event: FocusEvent]
  'blur': [event: FocusEvent]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 自动调整 textarea 高度
const adjustTextareaHeight = () => {
  if (!props.autoResize || !props.multiline || !textareaRef.value) return
  
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
const inputStyle = computed(() => {
  const style: Record<string, string> = {}
  
  if (props.width !== undefined) {
    style.width = props.width
  }
  if (props.height !== undefined) {
    style.height = props.height
  }
  if (props.minWidth !== undefined) {
    style.minWidth = props.minWidth
  }
  if (props.maxWidth !== undefined) {
    style.maxWidth = props.maxWidth
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
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const value = props.type === 'number' ? Number(target.value) : target.value
  emit('update:modelValue', value)
  emit('input', event)
  
  // 如果是 textarea 且启用了自动调整高度，则调整高度
  if (props.multiline && props.autoResize) {
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

// 监听 modelValue 变化，调整 textarea 高度
watch(() => props.modelValue, () => {
  if (props.multiline && props.autoResize) {
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
})

// 组件挂载后调整高度
onMounted(() => {
  if (props.multiline && props.autoResize) {
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
})
</script>

<template>
  <!-- 单行输入框 -->
  <input
    v-if="!multiline"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :min="min"
    :max="max"
    :step="step"
    :autofocus="autofocus"
    :autocomplete="autocomplete"
    :inputmode="inputmode"
    :style="inputStyle"
    :class="[
      ' px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      readonly ? 'cursor-default' : '',
      customClass
    ]"
    @input="handleInput"
    @change="handleChange"
    @focus="handleFocus"
    @blur="handleBlur"
  />
  
  <!-- 多行输入框 -->
  <textarea
    v-else
    ref="textareaRef"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :rows="rows"
    :minlength="min !== undefined ? (typeof min === 'string' ? parseInt(min) || undefined : typeof min === 'number' ? min : undefined) : undefined"
    :maxlength="max !== undefined ? (typeof max === 'string' ? parseInt(max) || undefined : typeof max === 'number' ? max : undefined) : undefined"
    :autofocus="autofocus"
    :autocomplete="autocomplete"
    :style="inputStyle"
    :class="[
      'px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors resize-none',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      readonly ? 'cursor-default' : '',
      customClass
    ]"
    @input="handleInput"
    @change="handleChange"
    @focus="handleFocus"
    @blur="handleBlur"
  />
</template>

