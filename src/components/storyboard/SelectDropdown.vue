<script setup lang="ts" generic="T extends { id: string; name: string; color?: string } | string">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

interface Props {
  // 选项列表（可以是对象数组或字符串数组）
  options: T[]
  // 当前选中的值（单选时为字符串，多选时为字符串数组）
  modelValue: string | string[] | undefined
  // 占位符文本
  placeholder?: string
  // 是否多选
  multiple?: boolean
  // 下拉框宽度
  dropdownWidth?: string
  // 按钮悬停时的边框颜色
  hoverBorderColor?: string
  // 选中项的主题色
  activeColor?: 'emerald' | 'purple' | 'orange'
  // 是否显示"无"选项（用于清空选择）
  showEmptyOption?: boolean
  emptyOptionText?: string
  // 空状态提示文本
  emptyText?: string
  // 按钮最小高度
  buttonMinHeight?: string
}

// 将选项标准化为对象格式
interface NormalizedOption {
  id: string
  name: string
  color?: string
}

const normalizedOptions = computed<NormalizedOption[]>(() => {
  return props.options.map(opt => {
    if (typeof opt === 'string') {
      return { id: opt, name: opt }
    }
    return opt as NormalizedOption
  })
})

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
  dropdownWidth: '12rem',
  hoverBorderColor: 'emerald-500',
  activeColor: 'emerald',
  showEmptyOption: false,
  emptyOptionText: '无',
  emptyText: '暂无选项，请先添加',
  buttonMinHeight: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | undefined]
  'change': [value: string | string[] | undefined]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
let timeoutId: ReturnType<typeof setTimeout> | null = null
let isMounted = true

// 点击外部关闭下拉框
const handleClickOutside = (event: MouseEvent) => {
  // 检查组件是否仍然挂载
  if (!isMounted || !isOpen.value) return
  
  const target = event.target as Node
  if (dropdownRef.value && !dropdownRef.value.contains(target)) {
    isOpen.value = false
  }
}

// 监听下拉框打开状态，动态添加/移除事件监听器
watch(isOpen, (open) => {
  if (open) {
    // 清除之前的定时器（如果存在）
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    
    // 使用 setTimeout 确保事件监听器在下一个事件循环中添加，避免立即触发
    timeoutId = setTimeout(() => {
      if (isMounted) {
        document.addEventListener('click', handleClickOutside, true)
      }
    }, 0)
  } else {
    // 清除定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    document.removeEventListener('click', handleClickOutside, true)
  }
})

onBeforeUnmount(() => {
  isMounted = false
  
  // 清除定时器
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  
  // 移除事件监听器
  document.removeEventListener('click', handleClickOutside, true)
  
  // 确保下拉框关闭
  isOpen.value = false
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const isSelected = (optionId: string): boolean => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.includes(optionId)
  }
  return props.modelValue === optionId
}

const handleSelect = (optionId: string) => {
  if (props.multiple) {
    const currentValue = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const index = currentValue.indexOf(optionId)
    
    if (index > -1) {
      // 取消选择
      currentValue.splice(index, 1)
    } else {
      // 添加选择
      currentValue.push(optionId)
    }
    
    const newValue = currentValue.length > 0 ? currentValue : undefined
    emit('update:modelValue', newValue)
    emit('change', newValue)
  } else {
    // 单选模式：选择后关闭下拉框
    emit('update:modelValue', optionId)
    emit('change', optionId)
    isOpen.value = false
  }
}

const handleEmptySelect = () => {
  const newValue = props.multiple ? undefined : ''
  emit('update:modelValue', newValue)
  emit('change', newValue)
  isOpen.value = false
}

// 获取选中的选项
const getSelectedOptions = (): NormalizedOption | NormalizedOption[] | null => {
  if (!props.modelValue) return null
  
  if (props.multiple) {
    if (!Array.isArray(props.modelValue)) return null
    return normalizedOptions.value.filter(opt => props.modelValue.includes(opt.id))
  } else {
    return normalizedOptions.value.find(opt => opt.id === props.modelValue) || null
  }
}

// 获取按钮显示的文本
const getButtonText = (): string => {
  const selected = getSelectedOptions()
  
  if (props.multiple) {
    const selectedArray = selected as NormalizedOption[] | null
    if (!selectedArray || selectedArray.length === 0) {
      return props.placeholder
    }
    if (selectedArray.length <= 3) {
      return selectedArray.map(s => s.name).join(', ')
    }
    return `${selectedArray.slice(0, 3).map(s => s.name).join(', ')} +${selectedArray.length - 3}`
  } else {
    const selectedSingle = selected as NormalizedOption | null
    return selectedSingle ? selectedSingle.name : props.placeholder
  }
}

// 颜色映射
const colorClasses = {
  emerald: {
    hover: 'hover:border-emerald-500/50',
    active: 'text-emerald-400 bg-emerald-500/10',
    check: 'text-emerald-400'
  },
  purple: {
    hover: 'hover:border-purple-500/50',
    active: 'text-purple-400 bg-purple-500/10',
    check: 'text-purple-400'
  },
  orange: {
    hover: 'hover:border-orange-500/50',
    active: 'text-orange-400 bg-orange-500/10',
    check: 'text-orange-400'
  }
}

const colorClass = colorClasses[props.activeColor]
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- 按钮 -->
    <button
      @click.stop="toggleDropdown"
      :class="[
        'flex items-center gap-2 w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white transition-colors',
        colorClass.hover
      ]"
      :style="buttonMinHeight ? { minHeight: buttonMinHeight } : undefined"
    >
      <!-- 自定义按钮内容 -->
      <template v-if="$slots.button">
        <slot name="button" :selected="getSelectedOptions()" />
      </template>
        <!-- 默认按钮内容 -->
        <template v-else>
          <div
            v-if="!multiple && getSelectedOptions() && (getSelectedOptions() as NormalizedOption)?.color"
            class="w-3 h-3 rounded-full flex-shrink-0"
            :style="{ backgroundColor: (getSelectedOptions() as NormalizedOption)?.color }"
          />
          <span class="truncate text-left flex-1">
            {{ getButtonText() }}
          </span>
          <ChevronDown :size="12" class="text-slate-500 flex-shrink-0" />
        </template>
    </button>

    <!-- 下拉框 -->
    <div
      v-if="isOpen"
      class="absolute top-full left-0 mt-1 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-y-auto custom-scrollbar"
      :style="{ width: dropdownWidth, maxHeight: '14rem' }"
    >
      <!-- 空选项 -->
      <div
        v-if="showEmptyOption"
        class="px-3 py-2 text-xs text-slate-500 hover:bg-white/5 cursor-pointer border-b border-white/5"
        @click.stop="handleEmptySelect"
      >
        {{ emptyOptionText }}
      </div>

      <!-- 选项列表 -->
      <div
        v-for="option in normalizedOptions"
        :key="option.id"
        :class="[
          'flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-white/10',
          isSelected(option.id) ? colorClass.active : 'text-slate-300'
        ]"
        @click.stop="handleSelect(option.id)"
      >
        <!-- 自定义选项内容 -->
        <template v-if="$slots.option">
          <slot name="option" :option="option" :isSelected="isSelected(option.id)" />
        </template>
        <!-- 默认选项内容 -->
        <template v-else>
          <div
            v-if="option.color"
            class="w-3 h-3 rounded-full flex-shrink-0"
            :style="{ backgroundColor: option.color }"
          />
          <span class="truncate flex-1">{{ option.name }}</span>
          <!-- 多选模式显示复选框 -->
          <div
            v-if="multiple"
            :class="[
              'w-4 h-4 rounded border flex items-center justify-center transition-colors',
              isSelected(option.id)
                ? activeColor === 'emerald' 
                  ? 'bg-emerald-500 border-emerald-500'
                  : activeColor === 'purple'
                  ? 'bg-purple-500 border-purple-500'
                  : 'bg-orange-500 border-orange-500'
                : 'border-white/20'
            ]"
          >
            <Check v-if="isSelected(option.id)" :size="10" class="text-white" />
          </div>
          <!-- 单选模式显示对勾 -->
          <Check v-else-if="isSelected(option.id)" :size="12" :class="colorClass.check + ' ml-auto'" />
        </template>
      </div>

      <!-- 空状态 -->
      <div
        v-if="normalizedOptions.length === 0"
        class="px-3 py-4 text-xs text-slate-600 text-center"
      >
        {{ emptyText }}
      </div>
    </div>
  </div>
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

