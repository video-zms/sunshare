<script setup lang="ts">
import { Upload } from 'lucide-vue-next'
import type { Component } from 'vue'

interface Props {
  // 接受的文件类型
  accept?: string
  // 是否支持多选
  multiple?: boolean
  // 显示模式：'empty' 空状态模式，'hover-button' 悬停按钮模式，'button' 按钮模式
  mode?: 'empty' | 'hover-button' | 'button'
  // 空状态模式的配置
  emptyConfig?: {
    width?: string
    height?: string
    icon?: Component | string
    iconSize?: number
    text?: string
    borderColor?: string
    hoverBorderColor?: string
    backgroundColor?: string
  }
  // 按钮模式的配置
  buttonConfig?: {
    size?: 'sm' | 'md' | 'lg'
    variant?: 'default' | 'ghost' | 'outline'
    icon?: Component | string
    iconSize?: number
    text?: string
    showText?: boolean // 是否显示文本，默认根据 text 是否存在决定
  }
  // 悬停按钮模式的配置
  hoverButtonConfig?: {
    icon?: Component | string
    iconSize?: number
    overlayBg?: string
  }
  // 自定义类名
  customClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  accept: 'image/*',
  multiple: false,
  mode: 'empty',
  emptyConfig: () => ({
    width: '160px',
    height: '90px',
    icon: Upload,
    iconSize: 20,
    text: '上传图片',
    borderColor: 'border-white/10',
    hoverBorderColor: 'hover:border-cyan-500/50',
    backgroundColor: 'bg-white/[0.02]'
  }),
  buttonConfig: () => ({
    size: 'md',
    variant: 'default',
    icon: Upload,
    iconSize: 14,
    text: '上传',
    showText: undefined // undefined 表示根据 text 是否存在决定
  }),
  hoverButtonConfig: () => ({
    icon: Upload,
    iconSize: 20,
    overlayBg: 'bg-black/60'
  }),
  customClass: ''
})

const emit = defineEmits<{
  change: [event: Event]
}>()

const handleChange = (event: Event) => {
  emit('change', event)
}

// 默认空状态配置
const defaultEmptyConfig = {
  width: '160px',
  height: '90px',
  icon: Upload,
  iconSize: 20,
  text: '上传图片',
  borderColor: 'border-white/10',
  hoverBorderColor: 'hover:border-cyan-500/50',
  backgroundColor: 'bg-white/[0.02]',
  ...props.emptyConfig
}

// 默认按钮配置
const defaultButtonConfig = {
  size: 'md',
  variant: 'default',
  icon: Upload,
  iconSize: 14,
  text: '上传',
  ...props.buttonConfig
}

// 默认悬停按钮配置
const defaultHoverButtonConfig = {
  icon: Upload,
  iconSize: 20,
  overlayBg: 'bg-black/60',
  ...props.hoverButtonConfig
}

// 按钮尺寸样式
const buttonSizeClasses = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3'
}

// 按钮变体样式
const buttonVariantClasses = {
  default: 'bg-white/20 hover:bg-white/30',
  ghost: 'hover:bg-white/10',
  outline: 'border border-white/20 hover:border-white/40'
}
</script>

<template>
  <!-- 空状态模式 -->
  <div
    v-if="mode === 'empty'"
    :class="[
      'flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
      defaultEmptyConfig.borderColor,
      defaultEmptyConfig.hoverBorderColor,
      defaultEmptyConfig.backgroundColor,
      customClass
    ]"
    :style="{
      width: defaultEmptyConfig.width,
      height: defaultEmptyConfig.height
    }"
  >
    <label class="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
      <component
        :is="defaultEmptyConfig.icon"
        :size="defaultEmptyConfig.iconSize"
        class="text-slate-600 mb-1"
      />
      <span class="text-[10px] text-slate-600">{{ defaultEmptyConfig.text }}</span>
      <input
        type="file"
        :accept="accept"
        :multiple="multiple"
        class="hidden"
        @change="handleChange"
      />
    </label>
  </div>

  <!-- 悬停按钮模式 -->
  <label
    v-else-if="mode === 'hover-button'"
    :class="[
      'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
      defaultHoverButtonConfig.overlayBg,
      customClass
    ]"
    @click.stop
  >
    <component
      :is="defaultHoverButtonConfig.icon"
      :size="defaultHoverButtonConfig.iconSize"
      class="text-white"
    />
    <input
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="hidden"
      @change="handleChange"
    />
  </label>

  <!-- 按钮模式 -->
  <label
    v-else-if="mode === 'button'"
    :class="[
      'inline-flex items-center justify-center rounded-lg text-white transition-all cursor-pointer',
      customClass || `${buttonSizeClasses[defaultButtonConfig.size]} ${buttonVariantClasses[defaultButtonConfig.variant]}`
    ]"
    @click.stop
  >
    <component
      :is="defaultButtonConfig.icon"
      :size="defaultButtonConfig.iconSize"
      class="text-white"
    />
    <span 
      v-if="defaultButtonConfig.showText !== false && (defaultButtonConfig.showText === true || defaultButtonConfig.text)" 
      class="ml-1 text-sm"
    >
      {{ defaultButtonConfig.text }}
    </span>
    <input
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="hidden"
      @change="handleChange"
    />
  </label>
</template>

