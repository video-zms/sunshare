<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Plus, RotateCcw, History, MessageSquare, FolderHeart, X,
  Image as ImageIcon, Video as VideoIcon, Film, Save,
  Edit, Trash2, ScanFace, Brush, Type, Workflow as WorkflowIcon,
  Clapperboard, Mic2, Settings, LayoutPanelTop, BookOpen
} from 'lucide-vue-next'
import { NodeType, type Workflow, type AssetHistoryItem } from '../types'

interface Props {
  isChatOpen: boolean
  isMultiFrameOpen: boolean
  isSonicStudioOpen?: boolean
  isStoryboardOpen?: boolean
  assetHistory: AssetHistoryItem[]
  workflows: Workflow[]
  selectedWorkflowId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  addNode: [type: NodeType]
  undo: []
  toggleChat: []
  toggleMultiFrame: []
  toggleSonicStudio: []
  toggleStoryboard: []
  historyItemClick: [item: AssetHistoryItem]
  deleteAsset: [id: string]
  selectWorkflow: [id: string | null]
  saveWorkflow: []
  deleteWorkflow: [id: string]
  renameWorkflow: [id: string, title: string]
  openSettings: []
}>()

const activePanel = ref<'history' | 'workflow' | 'add' | null>(null)
const activeHistoryTab = ref<'image' | 'video'>('image')
const editingWorkflowId = ref<string | null>(null)
const contextMenu = ref<{ visible: boolean; x: number; y: number; id: string; type: 'workflow' | 'history' } | null>(null)
let closeTimeoutId: ReturnType<typeof setTimeout> | null = null

const getNodeNameCN = (t: string) => {
  switch (t) {
    case NodeType.PROMPT_INPUT: return '创意描述'
    case NodeType.IMAGE_GENERATOR: return '文字生图'
    case NodeType.VIDEO_GENERATOR: return '文生视频'
    case NodeType.AUDIO_GENERATOR: return '灵感音乐'
    case NodeType.VIDEO_ANALYZER: return '视频分析'
    case NodeType.IMAGE_EDITOR: return '图像编辑'
    case NodeType.STORY_GENERATOR: return '短故事'
    default: return t
  }
}

const getNodeIcon = (t: string) => {
  switch (t) {
    case NodeType.PROMPT_INPUT: return Type
    case NodeType.IMAGE_GENERATOR: return ImageIcon
    case NodeType.VIDEO_GENERATOR: return Film
    case NodeType.AUDIO_GENERATOR: return Mic2
    case NodeType.VIDEO_ANALYZER: return ScanFace
    case NodeType.IMAGE_EDITOR: return Brush
    case NodeType.STORY_GENERATOR: return BookOpen
    default: return Plus
  }
}

const nodeTypes = [
  NodeType.PROMPT_INPUT,
  NodeType.IMAGE_GENERATOR,
  NodeType.VIDEO_GENERATOR,
  NodeType.AUDIO_GENERATOR,
  NodeType.VIDEO_ANALYZER,
  NodeType.IMAGE_EDITOR,
  NodeType.STORY_GENERATOR
]

const sidebarItems = [
  { id: 'add', icon: Plus },
  { id: 'workflow', icon: FolderHeart },
  { id: 'storyboard', icon: LayoutPanelTop, action: () => emit('toggleStoryboard'), tooltip: '分镜板' },
  { id: 'smart_sequence', icon: Clapperboard, action: () => emit('toggleMultiFrame'), tooltip: '智能多帧' },
  { id: 'sonic_studio', icon: Mic2, action: () => emit('toggleSonicStudio'), tooltip: '音频中心 (Audio Hub)' },
  { id: 'history', icon: History },
  { id: 'chat', icon: MessageSquare, action: () => emit('toggleChat') },
  { id: 'undo', icon: RotateCcw, action: () => emit('undo') }
]

const handleSidebarHover = (id: string) => {
  if (['add', 'history', 'workflow'].includes(id)) {
    if (closeTimeoutId) clearTimeout(closeTimeoutId)
    activePanel.value = id as any
  } else {
    closeTimeoutId = setTimeout(() => { activePanel.value = null }, 100)
  }
}

const handleSidebarLeave = () => {
  closeTimeoutId = setTimeout(() => { activePanel.value = null }, 500)
}

const handlePanelEnter = () => {
  if (closeTimeoutId) clearTimeout(closeTimeoutId)
}

const handlePanelLeave = () => {
  closeTimeoutId = setTimeout(() => { activePanel.value = null }, 500)
}

const handleGlobalClick = () => {
  contextMenu.value = null
}

const handleAddNode = (type: NodeType) => {
  emit('addNode', type)
  activePanel.value = null
}

const handleDragStart = (e: DragEvent, item: AssetHistoryItem) => {
  e.dataTransfer?.setData('application/json', JSON.stringify(item))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

const handleWorkflowDragStart = (e: DragEvent, wfId: string) => {
  e.dataTransfer?.setData('application/workflow-id', wfId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

const handleContextMenu = (e: MouseEvent, id: string, type: 'workflow' | 'history') => {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, id, type }
}

const handleRenameBlur = (e: FocusEvent, wfId: string) => {
  const target = e.target as HTMLInputElement
  emit('renameWorkflow', wfId, target.value)
  editingWorkflowId.value = null
}

const handleRenameKeydown = (e: KeyboardEvent, wfId: string) => {
  if (e.key === 'Enter') {
    const target = e.target as HTMLInputElement
    emit('renameWorkflow', wfId, target.value)
    editingWorkflowId.value = null
  }
}

const filteredAssets = () => {
  return props.assetHistory.filter(a => {
    if (activeHistoryTab.value === 'image') return a.type === 'image'
    if (activeHistoryTab.value === 'video') return a.type === 'video'
    return false
  })
}

const isItemActive = (item: typeof sidebarItems[0]) => {
  if (item.id === 'chat') return props.isChatOpen
  if (item.id === 'smart_sequence') return props.isMultiFrameOpen
  if (item.id === 'sonic_studio') return props.isSonicStudioOpen
  if (item.id === 'storyboard') return props.isStoryboardOpen
  return activePanel.value === item.id
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
  if (closeTimeoutId) clearTimeout(closeTimeoutId)
})
</script>

<template>
  <!-- Left Vertical Dock -->
  <div
    class="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 p-2 bg-[#2c2c2e]/70 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50"
    @mouseleave="handleSidebarLeave"
  >
    <div v-for="item in sidebarItems" :key="item.id" class="relative group">
      <button
        @mouseenter="handleSidebarHover(item.id)"
        @click="item.action ? item.action() : (activePanel = item.id as any)"
        :class="[
          'relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95',
          isItemActive(item)
            ? 'bg-white text-black shadow-lg'
            : 'hover:bg-white/10 text-slate-300 hover:text-white'
        ]"
      >
        <component :is="item.icon" :size="20" :stroke-width="2" />
      </button>
      <!-- Tooltip -->
      <div
        v-if="item.tooltip"
        class="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 backdrop-blur-md rounded border border-white/10 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
      >
        {{ item.tooltip }}
      </div>
    </div>

    <!-- Spacer & Settings -->
    <div class="w-8 h-px bg-white/10 my-1"></div>

    <button
      @click="emit('openSettings')"
      class="relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white/10 text-slate-300 hover:text-white"
    >
      <Settings :size="20" :stroke-width="2" />
    </button>
  </div>

  <!-- Slide-out Panels -->
  <div
    :class="[
      'fixed left-24 top-1/2 -translate-y-1/2 max-h-[75vh] h-auto w-72 bg-[#1c1c1e]/85 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-500 z-40 flex flex-col overflow-hidden',
      activePanel ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0 pointer-events-none scale-95'
    ]"
    @mouseenter="handlePanelEnter"
    @mouseleave="handlePanelLeave"
    @mousedown.stop
    @wheel.stop
  >
    <!-- History Panel -->
    <template v-if="activePanel === 'history'">
      <div class="p-4 border-b border-white/5 flex flex-col gap-3 bg-white/5">
        <div class="flex justify-between items-center">
          <button @click="activePanel = null">
            <X :size="14" class="text-slate-500 hover:text-white" />
          </button>
          <span class="text-xs font-bold uppercase tracking-widest text-white/50">历史记录</span>
        </div>
        <!-- Tabs -->
        <div class="flex bg-black/20 p-1 rounded-lg">
          <button
            @click="activeHistoryTab = 'image'"
            :class="[
              'flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-md transition-all',
              activeHistoryTab === 'image' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
            ]"
          >
            <ImageIcon :size="12" /> 图片
          </button>
          <button
            @click="activeHistoryTab = 'video'"
            :class="[
              'flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-md transition-all',
              activeHistoryTab === 'video' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
            ]"
          >
            <VideoIcon :size="12" /> 视频
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2 relative">
        <div v-if="filteredAssets().length === 0" class="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 select-none">
          <component :is="activeHistoryTab === 'image' ? ImageIcon : Film" :size="48" :stroke-width="1" class="mb-3 opacity-50" />
          <span class="text-[10px] font-medium tracking-widest uppercase">暂无{{ activeHistoryTab === 'image' ? '图片' : '视频' }}</span>
        </div>
        <div v-else class="grid grid-cols-2 gap-2 p-1">
          <div
            v-for="a in filteredAssets()"
            :key="a.id"
            class="aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-white/5 hover:border-cyan-500/50 transition-colors group relative shadow-md bg-black/20"
            draggable="true"
            @dragstart="handleDragStart($event, a)"
            @click="emit('historyItemClick', a)"
            @contextmenu="handleContextMenu($event, a.id, 'history')"
          >
            <img v-if="a.type === 'image'" :src="a.src" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable="false" />
            <video v-else :src="a.src" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable="false" />
            <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[8px] font-bold text-white/70">
              {{ a.type === 'image' ? 'IMG' : 'MOV' }}
            </div>
            <div class="absolute bottom-0 left-0 w-full p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-white/90 truncate font-medium">
              {{ a.title || 'Untitled' }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Workflow Panel -->
    <template v-else-if="activePanel === 'workflow'">
      <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <span class="text-xs font-bold uppercase tracking-widest text-white/50">我的工作流</span>
        <button @click="emit('saveWorkflow')" class="p-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white rounded-md transition-colors" title="保存当前工作流">
          <Save :size="14" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 relative">
        <div v-if="workflows.length === 0" class="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 select-none">
          <FolderHeart :size="48" :stroke-width="1" class="mb-3 opacity-50" />
          <span class="text-[10px] font-medium tracking-widest uppercase text-center">空空如也<br/>保存您的第一个工作流</span>
        </div>
        <div
          v-else
          v-for="wf in workflows"
          :key="wf.id"
          :class="[
            'relative p-2 rounded-xl border bg-black/20 group transition-all duration-300 cursor-grab active:cursor-grabbing hover:bg-white/5',
            selectedWorkflowId === wf.id ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-white/5 hover:border-white/20'
          ]"
          draggable="true"
          @dragstart="handleWorkflowDragStart($event, wf.id)"
          @click.stop="emit('selectWorkflow', wf.id)"
          @dblclick.stop="editingWorkflowId = wf.id"
          @contextmenu="handleContextMenu($event, wf.id, 'workflow')"
        >
          <div class="aspect-[2/1] bg-black/40 rounded-lg mb-2 overflow-hidden relative">
            <img v-if="wf.thumbnail" :src="wf.thumbnail" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" draggable="false" />
            <div v-else class="w-full h-full flex items-center justify-center text-slate-600">
              <WorkflowIcon :size="24" />
            </div>
          </div>
          <div class="flex items-center justify-between px-1">
            <input
              v-if="editingWorkflowId === wf.id"
              class="bg-black/50 border border-cyan-500/50 rounded px-1 text-xs text-white w-full outline-none"
              :value="wf.title"
              autofocus
              @blur="handleRenameBlur($event, wf.id)"
              @keydown="handleRenameKeydown($event, wf.id)"
            />
            <span v-else class="text-xs font-medium text-slate-300 truncate select-none group-hover:text-white transition-colors">{{ wf.title }}</span>
            <span class="text-[9px] text-slate-600 font-mono">{{ wf.nodes.length }} 节点</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Add Node Panel -->
    <template v-else-if="activePanel === 'add'">
      <div class="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <button @click="activePanel = null">
          <X :size="14" class="text-slate-500 hover:text-white" />
        </button>
        <span class="text-xs font-bold uppercase tracking-widest text-white/50">添加节点</span>
      </div>
      <div class="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
        <button
          v-for="t in nodeTypes"
          :key="t"
          @click.stop="handleAddNode(t)"
          class="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-3 text-sm text-slate-200 transition-colors border border-transparent hover:border-white/5 hover:shadow-lg"
        >
          <div :class="[
            'p-2 rounded-lg shadow-inner',
            t === NodeType.STORY_GENERATOR ? 'bg-orange-500/20 text-orange-300' : 'bg-white/10 text-cyan-200'
          ]">
            <component :is="getNodeIcon(t)" :size="16" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-xs">{{ getNodeNameCN(t) }}</span>
            <span v-if="t === NodeType.STORY_GENERATOR" class="text-[9px] text-slate-500">创作短视频故事并生成分镜</span>
          </div>
        </button>
      </div>
    </template>
  </div>

  <!-- Global Context Menu -->
  <div
    v-if="contextMenu"
    class="fixed z-[100] bg-[#2c2c2e] border border-white/10 rounded-lg shadow-2xl p-1 min-w-[120px]"
    :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    @mousedown.stop
    @mouseleave="contextMenu = null"
  >
    <template v-if="contextMenu.type === 'history'">
      <button
        class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 rounded-md flex items-center gap-2"
        @click="emit('deleteAsset', contextMenu.id); contextMenu = null"
      >
        <Trash2 :size="12" /> 删除
      </button>
    </template>
    <template v-if="contextMenu.type === 'workflow'">
      <button
        class="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-md flex items-center gap-2"
        @click="editingWorkflowId = contextMenu.id; contextMenu = null"
      >
        <Edit :size="12" /> 重命名
      </button>
      <button
        class="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 rounded-md flex items-center gap-2"
        @click="emit('deleteWorkflow', contextMenu.id); contextMenu = null"
      >
        <Trash2 :size="12" /> 删除
      </button>
    </template>
  </div>
</template>


