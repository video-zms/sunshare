<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X, Plus, Trash2, Upload, ChevronUp, ChevronDown, Copy, Sparkles,
  Image as ImageIcon, Film, LayoutGrid, List, Download, Share2,
  GripVertical, Clock, Camera, Type, MessageSquare, FileText, Users,
  MapPin, User, Edit2, Check, Palette, Wand2, Loader2, Images, Brush, Package
} from 'lucide-vue-next'
import type { StoryboardShot, SceneType, CameraMovement, Storyboard, StoryScene, StoryCharacter, StoryProp, ArtStyle } from '../types'
import { ART_STYLES } from '../types'
import { generateBatchImages, generateSingleImage, generateShotImage, generateVideoWithMultipart, createSoraCharacter, type BatchImageGenerationItem } from '../services/geminiService'
import { saveToStorage, loadFromStorage } from '../services/storage'
import StoryboardShotsList from './storyboard/StoryboardShotsList.vue'
import StoryboardScenesView from './storyboard/StoryboardScenesView.vue'
import StoryboardCharactersView from './storyboard/StoryboardCharactersView.vue'
import StoryboardPropsView from './storyboard/StoryboardPropsView.vue'
import BatchSceneDialog from './storyboard/BatchSceneDialog.vue'
import BatchCharactersDialog from './storyboard/BatchCharactersDialog.vue'
import BatchPropsDialog from './storyboard/BatchPropsDialog.vue'
import BatchGenerateDialog from './storyboard/BatchGenerateDialog.vue'
import SelectDropdown from './storyboard/SelectDropdown.vue'

interface Props {
  isOpen: boolean
  storyboard?: Storyboard | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [storyboard: Storyboard]
  generateFromAI: [shotId: string]
}>()

// Local state
const title = ref('未命名分镜板')
const shots = ref<StoryboardShot[]>([])
const scenes = ref<StoryScene[]>([])
const characters = ref<StoryCharacter[]>([])
const storyProps = ref<StoryProp[]>([])
const viewMode = ref<'list' | 'grid'>('list')
const selectedShotIds = ref<Set<string>>(new Set())
const draggedShotId = ref<string | null>(null)
const isConfigOpen = ref(false)

// 分镜板 ID，用于持久化存储
const storyboardId = ref<string | null>(null)
const isDataLoaded = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

// 场景、人物和道具管理状态
const activeTab = ref<'shots' | 'scenes' | 'characters' | 'props'>('shots')
const editingSceneId = ref<string | null>(null)
const editingCharacterId = ref<string | null>(null)
const editingPropId = ref<string | null>(null)

// 批量操作状态
const isBatchSceneOpen = ref(false)
const isBatchCharactersOpen = ref(false)
const isBatchPropsOpen = ref(false)
const batchSelectedScene = ref<string | null>(null)
const batchSelectedCharacters = ref<Set<string>>(new Set())
const batchSelectedProps = ref<Set<string>>(new Set())

// 智能关联状态
const isSmartMatching = ref(false)
const smartMatchProgress = ref('')

// 批量生成图片状态
const isBatchGenerateOpen = ref(false)
const batchGenerateType = ref<'scenes' | 'characters' | 'props' | 'all'>('all')
const batchSelectedArtStyle = ref<ArtStyle>(ART_STYLES[0])
const batchGenerateSelectedScenes = ref<Set<string>>(new Set())
const batchGenerateSelectedCharacters = ref<Set<string>>(new Set())
const batchGenerateSelectedProps = ref<Set<string>>(new Set())
const isBatchGenerating = ref(false)
const batchGenerateProgress = ref({ completed: 0, total: 0, currentItem: '' })
const batchSelectedModel = ref('gemini-2.5-flash-image')

// 单独生成状态
const generatingSceneIds = ref<Set<string>>(new Set())
const generatingCharacterIds = ref<Set<string>>(new Set())
const generatingPropIds = ref<Set<string>>(new Set())
const generatingShotIds = ref<Set<string>>(new Set())
const showModelDropdown = ref(false)

// 可用的图片生成模型
const imageGenModels = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-image' },
  { label: 'Gemini 3 Pro', value: 'gemini-3-pro-image-preview' },
  { label: 'Imagen 3.0', value: 'imagen-3.0-generate-002' }
]

// 预定义颜色选项
const colorOptions = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
]

// Scene types and camera movements
const sceneTypes: SceneType[] = ['远景', '全景', '中景', '近景', '特写', '大特写']
const cameraMovements: CameraMovement[] = ['固定', '横摇', '俯仰', '横移', '升降', '跟随', '推', '拉', '摇', '移', '环绕']

// Visible columns configuration
const visibleColumns = ref({
  shotNumber: true,
  duration: true,
  sceneType: true,
  cameraMovement: true,
  scene: true,
  characters: true,
  props: true,
  description: true,
  dialogue: true,
  notes: true,
  video: true
})

// 自动保存函数（带防抖）
const autoSave = async () => {
  if (!isDataLoaded.value || !storyboardId.value) return
  
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  
  saveTimer = setTimeout(async () => {
    try {
      const storyboard: Storyboard = {
        id: storyboardId.value!,
        title: title.value,
        shots: shots.value,
        scenes: scenes.value,
        characters: characters.value,
        storyProps: storyProps.value,
        createdAt: props.storyboard?.createdAt || Date.now(),
        updatedAt: Date.now()
      }
      
      await saveToStorage(`storyboard_${storyboardId.value}`, storyboard)
      console.log('分镜数据已自动保存')
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }, 1000) // 1秒防抖
}

// 加载保存的数据
const loadSavedData = async (id: string) => {
  try {
    const saved = await loadFromStorage<Storyboard>(`storyboard_${id}`)
    if (saved) {
      title.value = saved.title || '未命名分镜板'
      shots.value = saved.shots || []
      scenes.value = saved.scenes || []
      characters.value = saved.characters || []
      storyProps.value = saved.storyProps || []
      console.log('已恢复保存的分镜数据', saved)
      return true
    }
  } catch (error) {
    console.error('加载保存的数据失败:', error)
  }
  return false
}

// Initialize from props
watch(() => props.storyboard, async (newStoryboard) => {
  if (newStoryboard) {
    storyboardId.value = newStoryboard.id
    // 先尝试加载保存的数据，如果没有则使用 props 中的数据
    const hasSavedData = await loadSavedData(newStoryboard.id)
    if (!hasSavedData) {
      title.value = newStoryboard.title
      shots.value = [...newStoryboard.shots]
      scenes.value = [...(newStoryboard.scenes || [])]
      characters.value = [...(newStoryboard.characters || [])]
      storyProps.value = [...(newStoryboard.storyProps || [])]
    }
  } else {
    // 创建新的分镜板 ID
    storyboardId.value = `sb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    title.value = '未命名分镜板'
    shots.value = []
    scenes.value = []
    characters.value = []
    storyProps.value = []
  }
  isDataLoaded.value = true
}, { immediate: true })

// 当面板打开时，尝试加载保存的数据（确保使用最新的保存数据）
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && storyboardId.value) {
    // 如果已有保存的数据，优先使用保存的数据
    await loadSavedData(storyboardId.value)
  }
})

// 监听数据变化，自动保存
watch([title, shots, scenes, characters, storyProps], () => {
  if (isDataLoaded.value) {
    autoSave()
  }
}, { deep: true })

// 组件卸载时清理定时器
onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
})

// Computed
const totalDuration = computed(() => {
  return shots.value.reduce((sum, shot) => sum + (shot.duration || 0), 0)
})

const allSelected = computed(() => {
  return shots.value.length > 0 && selectedShotIds.value.size === shots.value.length
})

// Methods
const createNewShot = (): StoryboardShot => ({
  id: `shot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  shotNumber: shots.value.length + 1,
  duration: 0,
  sceneType: '全景',
  cameraMovement: '固定',
  description: '',
  dialogue: '',
  notes: '',
  timestamp: Date.now()
})

const addShot = (index?: number) => {
  const newShot = createNewShot()
  if (index !== undefined) {
    shots.value.splice(index + 1, 0, newShot)
  } else {
    shots.value.push(newShot)
  }
  renumberShots()
}

const addMultipleShots = (count: number) => {
  for (let i = 0; i < count; i++) {
    shots.value.push(createNewShot())
  }
  renumberShots()
}

const deleteShot = (id: string) => {
  shots.value = shots.value.filter(s => s.id !== id)
  selectedShotIds.value.delete(id)
  renumberShots()
}

const deleteSelectedShots = () => {
  shots.value = shots.value.filter(s => !selectedShotIds.value.has(s.id))
  selectedShotIds.value.clear()
  renumberShots()
}

const duplicateShot = (shot: StoryboardShot) => {
  const index = shots.value.findIndex(s => s.id === shot.id)
  const newShot: StoryboardShot = {
    ...shot,
    id: `shot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now()
  }
  shots.value.splice(index + 1, 0, newShot)
  renumberShots()
}

const moveShot = (id: string, direction: 'up' | 'down') => {
  const index = shots.value.findIndex(s => s.id === id)
  if (direction === 'up' && index > 0) {
    [shots.value[index], shots.value[index - 1]] = [shots.value[index - 1], shots.value[index]]
  } else if (direction === 'down' && index < shots.value.length - 1) {
    [shots.value[index], shots.value[index + 1]] = [shots.value[index + 1], shots.value[index]]
  }
  renumberShots()
}

const renumberShots = () => {
  shots.value.forEach((shot, index) => {
    shot.shotNumber = index + 1
  })
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedShotIds.value.clear()
  } else {
    selectedShotIds.value = new Set(shots.value.map(s => s.id))
  }
}

const toggleSelectShot = (id: string) => {
  if (selectedShotIds.value.has(id)) {
    selectedShotIds.value.delete(id)
  } else {
    selectedShotIds.value.add(id)
  }
  selectedShotIds.value = new Set(selectedShotIds.value)
}

// Image upload handlers
const handleImageUpload = (e: Event, shotId: string, type: 'scene' | 'character') => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    const shot = shots.value.find(s => s.id === shotId)
    if (shot) {
      if (type === 'scene') {
        shot.sceneImage = result
      } else {
        shot.characterImage = result
      }
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

// Drag and drop
const handleDragStart = (e: DragEvent, id: string) => {
  draggedShotId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const handleDrop = (e: DragEvent, targetId: string) => {
  e.preventDefault()
  if (!draggedShotId.value || draggedShotId.value === targetId) return

  const draggedIndex = shots.value.findIndex(s => s.id === draggedShotId.value)
  const targetIndex = shots.value.findIndex(s => s.id === targetId)

  const [draggedShot] = shots.value.splice(draggedIndex, 1)
  shots.value.splice(targetIndex, 0, draggedShot)

  renumberShots()
  draggedShotId.value = null
}

const handleDragEnd = () => {
  draggedShotId.value = null
}

// Save
const handleSave = async () => {
  const finalId = storyboardId.value || props.storyboard?.id || `sb-${Date.now()}`
  if (!storyboardId.value) {
    storyboardId.value = finalId
  }
  
  const storyboard: Storyboard = {
    id: finalId,
    title: title.value,
    shots: shots.value,
    scenes: scenes.value,
    characters: characters.value,
    storyProps: storyProps.value,
    createdAt: props.storyboard?.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  
  // 立即保存到存储
  try {
    await saveToStorage(`storyboard_${finalId}`, storyboard)
    console.log('分镜数据已保存')
  } catch (error) {
    console.error('保存失败:', error)
  }
  
  emit('save', storyboard)
}

// Export
const exportStoryboard = () => {
  const data = {
    title: title.value,
    shots: shots.value,
    exportedAt: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Format duration
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`
}

// ========== 场景管理 ==========
const createNewScene = (): StoryScene => ({
  id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: `场景 ${scenes.value.length + 1}`,
  description: '',
  color: colorOptions[scenes.value.length % colorOptions.length]
})

const addScene = () => {
  const newScene = createNewScene()
  scenes.value.push(newScene)
  editingSceneId.value = newScene.id
}

const deleteScene = (id: string) => {
  scenes.value = scenes.value.filter(s => s.id !== id)
  // 清除分镜中对该场景的引用
  shots.value.forEach(shot => {
    if (shot.sceneId === id) {
      shot.sceneId = undefined
    }
  })
}

const handleSceneImageUpload = (e: Event, sceneId: string) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    const scene = scenes.value.find(s => s.id === sceneId)
    if (scene) {
      scene.image = result
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const getSceneById = (id?: string) => {
  if (!id) return null
  return scenes.value.find(s => s.id === id) || null
}

const updateScene = (scene: StoryScene) => {
  const index = scenes.value.findIndex(s => s.id === scene.id)
  if (index !== -1) {
    scenes.value[index] = scene
  }
}

// ========== 人物管理 ==========
const createNewCharacter = (): StoryCharacter => ({
  id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: `角色 ${characters.value.length + 1}`,
  description: '',
  color: colorOptions[(characters.value.length + 7) % colorOptions.length],
  type: 'custom' // 默认为自定义图片角色
})

const addCharacter = () => {
  const newChar = createNewCharacter()
  characters.value.push(newChar)
  editingCharacterId.value = newChar.id
}

const deleteCharacter = (id: string) => {
  characters.value = characters.value.filter(c => c.id !== id)
  // 清除分镜中对该人物的引用
  shots.value.forEach(shot => {
    if (shot.characterIds?.includes(id)) {
      shot.characterIds = shot.characterIds.filter(cid => cid !== id)
    }
  })
}

const handleCharacterImageUpload = (e: Event, characterId: string) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    const char = characters.value.find(c => c.id === characterId)
    if (char) {
      char.image = result
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const getCharacterById = (id: string) => {
  return characters.value.find(c => c.id === id) || null
}

const updateCharacter = (character: StoryCharacter) => {
  const index = characters.value.findIndex(c => c.id === character.id)
  if (index !== -1) {
    characters.value[index] = character
  }
}

const getCharactersByIds = (ids?: string[]) => {
  if (!ids || ids.length === 0) return []
  return ids.map(id => getCharacterById(id)).filter(Boolean) as StoryCharacter[]
}

// 创建 Sora 角色
const handleCreateSoraCharacter = async (characterId: string) => {
  const char = characters.value.find(c => c.id === characterId)
  if (!char) return

  // 防止重复创建
  if (generatingCharacterIds.value.has(characterId)) {
    return
  }

  // 检查是否已有 Sora 角色 ID
  if (char.soraCharacterId) {
    console.log('角色已有 Sora ID:', char.soraCharacterId)
    return
  }

  // 检查角色类型
  if (char.type !== 'sora') {
    console.warn('角色类型不是 sora，无法创建 Sora 角色')
    return
  }

  generatingCharacterIds.value.add(characterId)

  try {
    const result = await createSoraCharacter(
      char.name,
      char.description,
      char.image || null
    )

    // 更新角色的 Sora ID
    const index = characters.value.findIndex(c => c.id === characterId)
    if (index !== -1) {
      characters.value[index] = {
        ...characters.value[index],
        soraCharacterId: result.characterId
      }
    }
  } catch (error: any) {
    console.error('创建 Sora 角色失败:', error)
    alert(`创建 Sora 角色失败: ${error.message || '未知错误'}`)
  } finally {
    generatingCharacterIds.value.delete(characterId)
  }
}

// 切换分镜的场景选择（已移到上面）
// 切换分镜的人物选择
const toggleShotCharacter = (shotId: string, characterId: string) => {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return

  if (!shot.characterIds) {
    shot.characterIds = []
  }

  const index = shot.characterIds.indexOf(characterId)
  if (index === -1) {
    shot.characterIds.push(characterId)
  } else {
    shot.characterIds.splice(index, 1)
  }
}

// ========== 道具管理 ==========
const createNewProp = (): StoryProp => ({
  id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: `道具 ${storyProps.value.length + 1}`,
  description: '',
  color: colorOptions[(storyProps.value.length + 14) % colorOptions.length]
})

const addProp = () => {
  const newProp = createNewProp()
  storyProps.value.push(newProp)
  editingPropId.value = newProp.id
}

const deleteProp = (id: string) => {
  storyProps.value = storyProps.value.filter(p => p.id !== id)
  // 清除分镜中对该道具的引用
  shots.value.forEach(shot => {
    if (shot.propIds?.includes(id)) {
      shot.propIds = shot.propIds.filter(pid => pid !== id)
    }
  })
}

const handlePropImageUpload = (e: Event, propId: string) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const result = ev.target?.result as string
    const prop = storyProps.value.find(p => p.id === propId)
    if (prop) {
      prop.image = result
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const getPropById = (id: string) => {
  return storyProps.value.find(p => p.id === id) || null
}

const updateProp = (prop: StoryProp) => {
  const index = storyProps.value.findIndex(p => p.id === prop.id)
  if (index !== -1) {
    storyProps.value[index] = prop
  }
}

const toggleShotScene = (shotId: string, sceneId: string) => {
  const shot = shots.value.find(s => s.id === shotId)
  if (shot) {
    shot.sceneId = sceneId || undefined
  }
}

const getPropsByIds = (ids?: string[]) => {
  if (!ids || ids.length === 0) return []
  return ids.map(id => getPropById(id)).filter(Boolean) as StoryProp[]
}

// 切换分镜的道具选择
const toggleShotProp = (shotId: string, propId: string) => {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return

  if (!shot.propIds) {
    shot.propIds = []
  }

  const index = shot.propIds.indexOf(propId)
  if (index === -1) {
    shot.propIds.push(propId)
  } else {
    shot.propIds.splice(index, 1)
  }
}

// ========== 批量操作 ==========

// 批量设置场景
const openBatchSceneDialog = () => {
  if (selectedShotIds.value.size === 0) return
  batchSelectedScene.value = null
  isBatchSceneOpen.value = true
}

const applyBatchScene = () => {
  selectedShotIds.value.forEach(shotId => {
    const shot = shots.value.find(s => s.id === shotId)
    if (shot) {
      shot.sceneId = batchSelectedScene.value || undefined
    }
  })
  isBatchSceneOpen.value = false
  batchSelectedScene.value = null
}

// 批量设置人物
const openBatchCharactersDialog = () => {
  if (selectedShotIds.value.size === 0) return
  batchSelectedCharacters.value = new Set()
  isBatchCharactersOpen.value = true
}

const toggleBatchCharacter = (characterId: string) => {
  if (batchSelectedCharacters.value.has(characterId)) {
    batchSelectedCharacters.value.delete(characterId)
  } else {
    batchSelectedCharacters.value.add(characterId)
  }
  batchSelectedCharacters.value = new Set(batchSelectedCharacters.value)
}

const applyBatchCharacters = (mode: 'replace' | 'add') => {
  selectedShotIds.value.forEach(shotId => {
    const shot = shots.value.find(s => s.id === shotId)
    if (shot) {
      if (mode === 'replace') {
        shot.characterIds = Array.from(batchSelectedCharacters.value)
      } else {
        // 添加模式：合并现有和新选择的人物
        const existingIds = new Set(shot.characterIds || [])
        batchSelectedCharacters.value.forEach(id => existingIds.add(id))
        shot.characterIds = Array.from(existingIds)
      }
    }
  })
  isBatchCharactersOpen.value = false
  batchSelectedCharacters.value = new Set()
}

// 批量设置道具
const openBatchPropsDialog = () => {
  if (selectedShotIds.value.size === 0) return
  batchSelectedProps.value = new Set()
  isBatchPropsOpen.value = true
}

const toggleBatchProp = (propId: string) => {
  if (batchSelectedProps.value.has(propId)) {
    batchSelectedProps.value.delete(propId)
  } else {
    batchSelectedProps.value.add(propId)
  }
  batchSelectedProps.value = new Set(batchSelectedProps.value)
}

const applyBatchProps = (mode: 'replace' | 'add') => {
  selectedShotIds.value.forEach(shotId => {
    const shot = shots.value.find(s => s.id === shotId)
    if (shot) {
      if (mode === 'replace') {
        shot.propIds = Array.from(batchSelectedProps.value)
      } else {
        // 添加模式：合并现有和新选择的道具
        const existingIds = new Set(shot.propIds || [])
        batchSelectedProps.value.forEach(id => existingIds.add(id))
        shot.propIds = Array.from(existingIds)
      }
    }
  })
  isBatchPropsOpen.value = false
  batchSelectedProps.value = new Set()
}

// ========== 智能关联 ==========

// 简单的文本匹配函数
const textContainsKeywords = (text: string, keywords: string[]): boolean => {
  const lowerText = text.toLowerCase()
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
}

// 从名称和描述中提取关键词
const extractKeywords = (name: string, description: string): string[] => {
  const combined = `${name} ${description}`
  // 移除标点符号，分割成词
  const words = combined
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2) // 只保留2个字符以上的词
  return [...new Set(words)] // 去重
}

// 智能关联单个分镜
const smartMatchShot = (shot: StoryboardShot) => {
  const shotText = `${shot.description} ${shot.dialogue} ${shot.notes}`
  
  // 匹配场景
  let bestSceneMatch: { id: string; score: number } | null = null
  for (const scene of scenes.value) {
    const keywords = extractKeywords(scene.name, scene.description)
    const matchCount = keywords.filter(kw => textContainsKeywords(shotText, [kw])).length
    if (matchCount > 0 && (!bestSceneMatch || matchCount > bestSceneMatch.score)) {
      bestSceneMatch = { id: scene.id, score: matchCount }
    }
  }
  if (bestSceneMatch) {
    shot.sceneId = bestSceneMatch.id
  }
  
  // 匹配人物
  const matchedCharacterIds: string[] = []
  for (const char of characters.value) {
    const keywords = extractKeywords(char.name, char.description)
    // 人物名称直接匹配
    if (textContainsKeywords(shotText, [char.name]) || 
        keywords.some(kw => textContainsKeywords(shotText, [kw]))) {
      matchedCharacterIds.push(char.id)
    }
  }
  if (matchedCharacterIds.length > 0) {
    shot.characterIds = matchedCharacterIds
  }
  
  // 匹配道具
  const matchedPropIds: string[] = []
  for (const prop of storyProps.value) {
    const keywords = extractKeywords(prop.name, prop.description)
    // 道具名称直接匹配
    if (textContainsKeywords(shotText, [prop.name]) || 
        keywords.some(kw => textContainsKeywords(shotText, [kw]))) {
      matchedPropIds.push(prop.id)
    }
  }
  if (matchedPropIds.length > 0) {
    shot.propIds = matchedPropIds
  }
}

// 智能关联选中的分镜
const smartMatchSelectedShots = async () => {
  if (selectedShotIds.value.size === 0) return
  if (scenes.value.length === 0 && characters.value.length === 0) return
  
  isSmartMatching.value = true
  smartMatchProgress.value = '正在分析分镜内容...'
  
  try {
    // 使用 setTimeout 让 UI 有机会更新
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const selectedShots = shots.value.filter(s => selectedShotIds.value.has(s.id))
    let processed = 0
    
    for (const shot of selectedShots) {
      smartMatchShot(shot)
      processed++
      smartMatchProgress.value = `已处理 ${processed}/${selectedShots.length} 个分镜`
      // 给 UI 更新的机会
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    smartMatchProgress.value = '智能关联完成！'
    await new Promise(resolve => setTimeout(resolve, 500))
  } finally {
    isSmartMatching.value = false
    smartMatchProgress.value = ''
  }
}

// 智能关联所有分镜
const smartMatchAllShots = async () => {
  if (scenes.value.length === 0 && characters.value.length === 0 && storyProps.value.length === 0) return
  
  isSmartMatching.value = true
  smartMatchProgress.value = '正在分析所有分镜...'
  
  try {
    await new Promise(resolve => setTimeout(resolve, 100))
    
    let processed = 0
    for (const shot of shots.value) {
      smartMatchShot(shot)
      processed++
      smartMatchProgress.value = `已处理 ${processed}/${shots.value.length} 个分镜`
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    smartMatchProgress.value = '智能关联完成！'
    await new Promise(resolve => setTimeout(resolve, 500))
  } finally {
    isSmartMatching.value = false
    smartMatchProgress.value = ''
  }
}

// ========== 批量生成图片 ==========

// 打开批量生成对话框
const openBatchGenerateDialog = (type: 'scenes' | 'characters' | 'props' | 'all' = 'all') => {
  batchGenerateType.value = type
  batchGenerateSelectedScenes.value = new Set(scenes.value.map(s => s.id))
  batchGenerateSelectedCharacters.value = new Set(characters.value.map(c => c.id))
  batchGenerateSelectedProps.value = new Set(storyProps.value.map(p => p.id))
  showModelDropdown.value = false
  isBatchGenerateOpen.value = true
}


// 计算待生成项目数量
const batchGenerateItemCount = computed(() => {
  let count = 0
  if (batchGenerateType.value === 'scenes' || batchGenerateType.value === 'all') {
    count += batchGenerateSelectedScenes.value.size
  }
  if (batchGenerateType.value === 'characters' || batchGenerateType.value === 'all') {
    count += batchGenerateSelectedCharacters.value.size
  }
  if (batchGenerateType.value === 'props' || batchGenerateType.value === 'all') {
    count += batchGenerateSelectedProps.value.size
  }
  return count
})

// 单独生成场景图片
const generateSceneImage = async (sceneId: string) => {
  const scene = scenes.value.find(s => s.id === sceneId)
  if (!scene) return
  
  generatingSceneIds.value.add(sceneId)
  try {
    const image = await generateSingleImage(
      {
        id: scene.id,
        type: 'scene',
        name: scene.name,
        description: scene.description
      },
      batchSelectedArtStyle.value,
      batchSelectedModel.value
    )
    scene.image = image
  } catch (error: any) {
    console.error('生成场景图片失败:', error)
    alert(`生成失败: ${error.message || '未知错误'}`)
  } finally {
    generatingSceneIds.value.delete(sceneId)
  }
}

// 单独生成人物图片
const generateCharacterImage = async (characterId: string) => {
  const char = characters.value.find(c => c.id === characterId)
  if (!char) return
  
  generatingCharacterIds.value.add(characterId)
  try {
    const image = await generateSingleImage(
      {
        id: char.id,
        type: 'character',
        name: char.name,
        description: char.description
      },
      batchSelectedArtStyle.value,
      batchSelectedModel.value
    )
    char.image = image
  } catch (error: any) {
    console.error('生成人物图片失败:', error)
    alert(`生成失败: ${error.message || '未知错误'}`)
  } finally {
    generatingCharacterIds.value.delete(characterId)
  }
}

// 单独生成道具图片
const generatePropImage = async (propId: string) => {
  const prop = storyProps.value.find(p => p.id === propId)
  if (!prop) return
  
  generatingPropIds.value.add(propId)
  try {
    // 道具图片生成：白色背景，展示道具细节
    const image = await generateSingleImage(
      {
        id: prop.id,
        type: 'character', // 使用character类型，因为道具也需要白色背景和细节展示
        name: prop.name,
        description: `Prop object: ${prop.description || prop.name}. Product photography style, white background, detailed prop reference, isolated object, professional product shot`
      },
      batchSelectedArtStyle.value,
      batchSelectedModel.value
    )
    prop.image = image
  } catch (error: any) {
    console.error('生成道具图片失败:', error)
    alert(`生成失败: ${error.message || '未知错误'}`)
  } finally {
    generatingPropIds.value.delete(propId)
  }
}

// 生成分镜图片
const generateShotImageForShot = async (shotId: string) => {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return
  
  generatingShotIds.value.add(shotId)
  try {
    // 获取关联的场景信息（包含参考图）
    const scene = shot.sceneId ? getSceneById(shot.sceneId) : null
    const sceneInfo = scene ? {
      name: scene.name,
      description: scene.description,
      image: scene.image // 传递场景参考图
    } : undefined
    
    // 获取关联的人物信息（包含参考图）
    const shotCharacters = shot.characterIds && shot.characterIds.length > 0
      ? getCharactersByIds(shot.characterIds).map(char => ({
          name: char.name,
          description: char.description,
          image: char.image // 传递角色参考图
        }))
      : undefined
    
    // 获取关联的道具信息（包含参考图）
    const shotProps = shot.propIds && shot.propIds.length > 0
      ? getPropsByIds(shot.propIds).map(prop => ({
          name: prop.name,
          description: prop.description,
          image: prop.image // 传递道具参考图
        }))
      : undefined
    
    // 生成分镜图片（现在会传递参考图）
    const image = await generateShotImage(
      shot.description || '',
      sceneInfo,
      shotCharacters,
      shot.sceneType,
      shot.cameraMovement,
      batchSelectedArtStyle.value,
      batchSelectedModel.value,
      shotProps
    )
    
    shot.sceneImage = image
  } catch (error: any) {
    console.error('生成分镜图片失败:', error)
    alert(`生成失败: ${error.message || '未知错误'}`)
  } finally {
    generatingShotIds.value.delete(shotId)
  }
}

// 生成分镜视频
const generateShotVideoForShot = async (shotId: string) => {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot) return
  
  // 防止重复生成
  if (generatingShotIds.value.has(shotId)) {
    return
  }
  
  // 如果已经有正在进行的任务，提示用户
  if (shot.videoTaskId && shot.videoGeneratingStatus && 
      (shot.videoGeneratingStatus === 'queued' || shot.videoGeneratingStatus === 'processing')) {
    console.log('视频生成任务正在进行中，任务ID:', shot.videoTaskId)
    return
  }
  
  generatingShotIds.value.add(shotId)
  
  try {
    // 初始化生成状态
    shot.videoGeneratingStatus = 'queued'
    shot.videoGeneratingProgress = 0
    
    // 构建视频生成提示词
    // 结合分镜描述、场景、人物、道具等信息
    let promptParts: string[] = []
    
    // 添加场景信息
    if (shot.sceneId) {
      const scene = getSceneById(shot.sceneId)
      if (scene) {
        promptParts.push(`场景: ${scene.name}. ${scene.description || ''}`)
      }
    }
    
    // 添加人物信息并区分角色类型
    let soraCharacterIds: string[] = []
    let customCharacterImages: string[] = []
    
    if (shot.characterIds && shot.characterIds.length > 0) {
      const characters = getCharactersByIds(shot.characterIds)
      const characterNames: string[] = []
      
      characters.forEach(char => {
        characterNames.push(char.name)
        
        if (char.type === 'sora' && char.soraCharacterId) {
          // Sora 角色：收集角色 ID
          soraCharacterIds.push(char.soraCharacterId)
          promptParts.push(`Sora角色[${char.soraCharacterId}]: ${char.name}. ${char.description || ''}`)
        } else {
          // 自定义图片角色：收集图片作为参考
          if (char.image) {
            customCharacterImages.push(char.image)
          }
          promptParts.push(`人物: ${char.name}. ${char.description || ''}`)
        }
      })
    }
    
    // 添加道具信息
    if (shot.propIds && shot.propIds.length > 0) {
      const props = getPropsByIds(shot.propIds)
      const propNames = props.map(p => p.name).join(', ')
      promptParts.push(`道具: ${propNames}`)
    }
    
    // 添加分镜描述
    if (shot.description) {
      promptParts.push(`画面描述: ${shot.description}`)
    }
    
    // 添加景别和运镜信息
    if (shot.sceneType) {
      promptParts.push(`景别: ${shot.sceneType}`)
    }
    if (shot.cameraMovement) {
      promptParts.push(`运镜: ${shot.cameraMovement}`)
    }
    
    // 添加台词（如果有）
    if (shot.dialogue) {
      promptParts.push(`台词: ${shot.dialogue}`)
    }
    
    // 组合提示词
    const prompt = promptParts.join('. ')
    
    // 获取分镜图（如果有）
    const referenceImage = shot.sceneImage || null
    
    // 优先使用自定义角色的图片作为参考图（如果有多个，使用第一个）
    // 如果没有自定义角色图片，则使用分镜图
    const inputImage = customCharacterImages.length > 0 ? customCharacterImages[0] : referenceImage
    
    // 调用视频生成 API（不等待完成，返回任务ID后轮询）
    const result = await generateVideoWithMultipart(prompt, {
      model: 'sora-2',
      size: '720x1280',
      seconds: shot.duration || 15,
      pollUntilComplete: false, // 不在这里等待，而是启动后台轮询
      inputImage: inputImage, // 传递参考图片（优先使用自定义角色图片）
      characterIds: soraCharacterIds.length > 0 ? soraCharacterIds : undefined // 传递 Sora 角色 ID
    })
    
    // 保存任务ID
    if (result.taskId) {
      shot.videoTaskId = result.taskId
      shot.videoGeneratingStatus = 'queued'
      shot.videoGeneratingProgress = 0
      
      // 启动后台轮询（不阻塞UI）
      pollVideoTaskForShot(shotId, result.taskId)
    } else if (result.videoUrl) {
      // 如果直接返回了视频URL（某些API可能直接返回）
      shot.videoUrl = result.videoUrl
      shot.videoGeneratingStatus = 'completed'
      shot.videoGeneratingProgress = 100
      shot.videoTaskId = undefined
    }
  } catch (error: any) {
    console.error('生成分镜视频失败:', error)
    shot.videoGeneratingStatus = 'failed'
    shot.videoGeneratingProgress = 0
    alert(`生成失败: ${error.message || '未知错误'}`)
  } finally {
    generatingShotIds.value.delete(shotId)
  }
}

// 轮询视频生成任务
const pollVideoTaskForShot = async (shotId: string, taskId: string) => {
  const shot = shots.value.find(s => s.id === shotId)
  if (!shot || shot.videoTaskId !== taskId) {
    // 任务已被取消或替换
    return
  }
  
  try {
    const { pollVideoTask } = await import('../services/geminiService')
    
    await pollVideoTask(taskId, {
      onProgress: (progress, status) => {
        // 更新进度和状态
        const currentShot = shots.value.find(s => s.id === shotId)
        if (currentShot && currentShot.videoTaskId === taskId) {
          currentShot.videoGeneratingStatus = status as 'queued' | 'processing' | 'completed' | 'failed'
          currentShot.videoGeneratingProgress = progress
        }
      },
      maxAttempts: 120, // 最多10分钟
      interval: 5000 // 每5秒查询一次
    }).then((result) => {
      // 任务完成，更新视频URL
      const currentShot = shots.value.find(s => s.id === shotId)
      if (currentShot && currentShot.videoTaskId === taskId) {
        currentShot.videoUrl = result.videoUrl
        currentShot.videoGeneratingStatus = 'completed'
        currentShot.videoGeneratingProgress = 100
      }
    })
  } catch (error: any) {
    console.error('轮询视频任务失败:', error)
    const currentShot = shots.value.find(s => s.id === shotId)
    if (currentShot && currentShot.videoTaskId === taskId) {
      currentShot.videoGeneratingStatus = 'failed'
      currentShot.videoGeneratingProgress = 0
    }
  }
}

// 处理批量生成（从对话框组件调用）
const handleBatchGenerate = async (config: {
  type: 'scenes' | 'characters' | 'props' | 'all'
  artStyle: ArtStyle
  model: string
  selectedScenes: Set<string>
  selectedCharacters: Set<string>
  selectedProps: Set<string>
}) => {
  batchGenerateType.value = config.type
  batchSelectedArtStyle.value = config.artStyle
  batchSelectedModel.value = config.model
  batchGenerateSelectedScenes.value = config.selectedScenes
  batchGenerateSelectedCharacters.value = config.selectedCharacters
  batchGenerateSelectedProps.value = config.selectedProps
  await executeBatchGenerate()
}

// 执行批量生成
const executeBatchGenerate = async () => {
  if (batchGenerateItemCount.value === 0) return
  
  isBatchGenerating.value = true
  batchGenerateProgress.value = { completed: 0, total: batchGenerateItemCount.value, currentItem: '准备中...' }
  
  try {
    // 构建生成项目列表
    const items: BatchImageGenerationItem[] = []
    
    // 添加场景
    if (batchGenerateType.value === 'scenes' || batchGenerateType.value === 'all') {
      for (const sceneId of batchGenerateSelectedScenes.value) {
        const scene = scenes.value.find(s => s.id === sceneId)
        if (scene) {
          items.push({
            id: scene.id,
            type: 'scene',
            name: scene.name,
            description: scene.description
          })
        }
      }
    }
    
    // 添加人物
    if (batchGenerateType.value === 'characters' || batchGenerateType.value === 'all') {
      for (const charId of batchGenerateSelectedCharacters.value) {
        const char = characters.value.find(c => c.id === charId)
        if (char) {
          items.push({
            id: char.id,
            type: 'character',
            name: char.name,
            description: char.description
          })
        }
      }
    }
    
    // 添加道具
    if (batchGenerateType.value === 'props' || batchGenerateType.value === 'all') {
      for (const propId of batchGenerateSelectedProps.value) {
        const prop = storyProps.value.find(p => p.id === propId)
        if (prop) {
          items.push({
            id: prop.id,
            type: 'character', // 使用character类型，因为道具也需要白色背景
            name: prop.name,
            description: `Prop object: ${prop.description || prop.name}. Product photography style, white background, detailed prop reference, isolated object`
          })
        }
      }
    }
    
    // 执行批量生成
    const results = await generateBatchImages(
      items,
      batchSelectedArtStyle.value,
      (completed, total, currentItem) => {
        batchGenerateProgress.value = { completed, total, currentItem }
      },
      batchSelectedModel.value
    )
    
    // 应用生成结果
    for (const result of results) {
      if (result.success && result.image) {
        // 查找是场景、人物还是道具
        const scene = scenes.value.find(s => s.id === result.id)
        if (scene) {
          scene.image = result.image
        } else {
          const char = characters.value.find(c => c.id === result.id)
          if (char) {
            char.image = result.image
          } else {
            const prop = storyProps.value.find(p => p.id === result.id)
            if (prop) {
              prop.image = result.image
            }
          }
        }
      }
    }
    
    // 统计结果
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    if (failCount > 0) {
      batchGenerateProgress.value.currentItem = `完成！成功 ${successCount} 个，失败 ${failCount} 个`
    } else {
      batchGenerateProgress.value.currentItem = `全部完成！共生成 ${successCount} 张图片`
    }
    
    // 延迟关闭
    await new Promise(resolve => setTimeout(resolve, 1500))
    isBatchGenerateOpen.value = false
    
  } catch (error: any) {
    batchGenerateProgress.value.currentItem = `生成失败: ${error.message || '未知错误'}`
  } finally {
    isBatchGenerating.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div
          class="w-[95vw] max-w-[1600px] h-[90vh] bg-[#0f0f11] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#18181b]/50">
            <div class="flex items-center gap-4">
              <button
                @click="emit('close')"
                class="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X :size="20" class="text-slate-400" />
              </button>
              <div class="flex items-center gap-3">
                <Film :size="24" class="text-cyan-400" />
                <input
                  v-model="title"
                  class="text-xl font-bold text-white bg-transparent border-none outline-none focus:ring-0 min-w-[200px]"
                  placeholder="分镜板标题"
                />
              </div>
            </div>

            <div class="flex items-center gap-3">
              <!-- Stats -->
              <div class="flex items-center gap-4 px-4 py-2 bg-white/5 rounded-xl text-xs text-slate-400">
                <span>分镜 <strong class="text-white">{{ shots.length }}</strong></span>
                <span class="text-white/20">|</span>
                <span>场景 <strong class="text-white">{{ scenes.length }}</strong></span>
                <span class="text-white/20">|</span>
                <span>人物 <strong class="text-white">{{ characters.length }}</strong></span>
                <span class="text-white/20">|</span>
                <span>道具 <strong class="text-white">{{ storyProps.length }}</strong></span>
                <span class="text-white/20">|</span>
                <span>时长 <strong class="text-white">{{ formatDuration(totalDuration) }}</strong></span>
              </div>

              <!-- View Mode Toggle 已移到 StoryboardShotsList 组件内部 -->

              <!-- Column Config (only for shots tab) -->
              <button
                v-if="activeTab === 'shots'"
                @click="isConfigOpen = !isConfigOpen"
                class="px-4 py-2 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-xl text-sm font-medium transition-colors"
              >
                自定义配置字段
              </button>

              <!-- Actions -->
              <button
                @click="exportStoryboard"
                class="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                title="导出"
              >
                <Download :size="18" />
              </button>
              <button
                class="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                title="分享"
              >
                <Share2 :size="18" />
              </button>
              <button
                @click="handleSave"
                class="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20"
              >
                保存
              </button>
            </div>
          </div>

          <!-- Column Config Dropdown -->
          <Transition name="dropdown">
            <div
              v-if="isConfigOpen"
              class="absolute right-6 top-20 z-50 p-4 bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl min-w-[200px]"
            >
              <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">显示字段</div>
              <label
                v-for="(value, key) in visibleColumns"
                :key="key"
                class="flex items-center gap-3 py-2 cursor-pointer hover:bg-white/5 rounded-lg px-2 -mx-2"
              >
                <input
                  type="checkbox"
                  v-model="visibleColumns[key]"
                  class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                />
                <span class="text-sm text-slate-300">
                  {{ key === 'shotNumber' ? '镜号' :
                     key === 'duration' ? '时长' :
                     key === 'sceneType' ? '景别' :
                     key === 'cameraMovement' ? '运镜' :
                     key === 'scene' ? '场景' :
                     key === 'characters' ? '人物' :
                     key === 'props' ? '道具' :
                     key === 'description' ? '描述' :
                     key === 'dialogue' ? '台词' :
                     key === 'notes' ? '备注' :
                     key === 'video' ? '视频' : key }}
                </span>
              </label>
            </div>
          </Transition>

          <!-- Tab Navigation -->
          <div class="flex items-center gap-1 px-6 py-3 border-b border-white/5 bg-[#18181b]/30">
            <button
              @click="activeTab = 'shots'"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                activeTab === 'shots' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              ]"
            >
              <Film :size="16" />
              <span>分镜</span>
              <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{{ shots.length }}</span>
            </button>
            <button
              @click="activeTab = 'scenes'"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                activeTab === 'scenes' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              ]"
            >
              <MapPin :size="16" />
              <span>场景</span>
              <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{{ scenes.length }}</span>
            </button>
            <button
              @click="activeTab = 'characters'"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                activeTab === 'characters' 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              ]"
            >
              <Users :size="16" />
              <span>人物</span>
              <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{{ characters.length }}</span>
            </button>
            <!-- 道具 -->
            <button
              @click="activeTab = 'props'"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                activeTab === 'props' 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              ]"
            >
              <Package :size="16" />
              <span>道具</span>
              <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">{{ storyProps.length }}</span>
          </button>

            <div class="flex-1" />

            <!-- Toolbar actions based on active tab -->
            <template v-if="activeTab === 'shots'">
              <button
                @click="addShot()"
                class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-slate-300 hover:text-white transition-colors border border-white/5"
              >
                <Plus :size="16" />
                <span>新增分镜</span>
              </button>

              <button
                @click="addMultipleShots(5)"
                class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-slate-300 hover:text-white transition-colors border border-white/5"
              >
                <Upload :size="16" />
                <span>批量上传</span>
              </button>

              <!-- 智能关联全部 -->
              <button
                v-if="shots.length > 0 && (scenes.length > 0 || characters.length > 0 || storyProps.length > 0) && selectedShotIds.size === 0"
                @click="smartMatchAllShots"
                :disabled="isSmartMatching"
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 rounded-xl text-sm text-amber-400 transition-colors border border-amber-500/20 disabled:opacity-50"
              >
                <Loader2 v-if="isSmartMatching" :size="16" class="animate-spin" />
                <Wand2 v-else :size="16" />
                <span>{{ isSmartMatching ? smartMatchProgress : '智能关联全部' }}</span>
              </button>

              <!-- 智能关联（选中分镜） -->
              <button
                v-if="selectedShotIds.size > 0 && (scenes.length > 0 || characters.length > 0 || storyProps.length > 0)"
                @click="smartMatchSelectedShots"
                :disabled="isSmartMatching"
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 rounded-xl text-sm text-amber-400 transition-colors border border-amber-500/20 disabled:opacity-50"
              >
                <Loader2 v-if="isSmartMatching" :size="16" class="animate-spin" />
                <Wand2 v-else :size="16" />
                <span>智能关联</span>
              </button>

              <!-- 批量设置场景 -->
              <button
                v-if="selectedShotIds.size > 0 && scenes.length > 0"
                @click="openBatchSceneDialog"
                class="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-sm text-emerald-400 transition-colors border border-emerald-500/20"
              >
                <MapPin :size="16" />
                <span>设置场景</span>
              </button>

              <!-- 批量设置人物 -->
              <button
                v-if="selectedShotIds.size > 0 && characters.length > 0"
                @click="openBatchCharactersDialog"
                class="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl text-sm text-purple-400 transition-colors border border-purple-500/20"
              >
                <Users :size="16" />
                <span>设置人物</span>
              </button>

              <!-- 批量设置道具 -->
              <button
                v-if="selectedShotIds.size > 0 && storyProps.length > 0"
                @click="openBatchPropsDialog"
                class="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl text-sm text-orange-400 transition-colors border border-orange-500/20"
              >
                <Package :size="16" />
                <span>设置道具</span>
              </button>

              <button
                v-if="selectedShotIds.size > 0"
                @click="deleteSelectedShots"
                class="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm text-red-400 transition-colors border border-red-500/20"
              >
                <Trash2 :size="16" />
                <span>批量删除</span>
              </button>
            </template>

            <template v-else-if="activeTab === 'scenes'">
              <button
                v-if="scenes.length > 0"
                @click="openBatchGenerateDialog('scenes')"
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 rounded-xl text-sm text-purple-400 transition-colors border border-purple-500/20"
              >
                <Images :size="16" />
                <span>AI批量生成图片</span>
              </button>
              <button
                @click="addScene()"
                class="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-sm text-emerald-400 transition-colors border border-emerald-500/30"
              >
                <Plus :size="16" />
                <span>新增场景</span>
              </button>
            </template>

            <template v-else-if="activeTab === 'characters'">
              <button
                v-if="characters.length > 0"
                @click="openBatchGenerateDialog('characters')"
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 rounded-xl text-sm text-purple-400 transition-colors border border-purple-500/20"
              >
                <Images :size="16" />
                <span>AI批量生成图片</span>
              </button>
              <button
                @click="addCharacter()"
                class="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-sm text-purple-400 transition-colors border border-purple-500/30"
              >
                <Plus :size="16" />
                <span>新增人物</span>
              </button>
            </template>

            <template v-else-if="activeTab === 'props'">
              <button
                v-if="storyProps.length > 0"
                @click="openBatchGenerateDialog('props')"
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 rounded-xl text-sm text-orange-400 transition-colors border border-orange-500/20"
              >
                <Images :size="16" />
                <span>AI批量生成图片</span>
              </button>
              <button
                @click="addProp()"
                class="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-xl text-sm text-orange-400 transition-colors border border-orange-500/30"
              >
                <Plus :size="16" />
                <span>新增道具</span>
              </button>
            </template>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto custom-scrollbar">
            <!-- ========== 分镜列表视图 ========== -->
            <StoryboardShotsList
              v-if="activeTab === 'shots'"
              :shots="shots"
              :scenes="scenes"
              :characters="characters"
              :story-props="storyProps"
              :scene-types="sceneTypes"
              :camera-movements="cameraMovements"
              :visible-columns="visibleColumns"
              :selected-shot-ids="selectedShotIds"
              :dragged-shot-id="draggedShotId"
              :generating-shot-ids="generatingShotIds"
              :view-mode="viewMode"
              @update:shots="shots = $event"
              @update:viewMode="viewMode = $event"
              @toggle-select-all="toggleSelectAll"
              @toggle-select="toggleSelectShot"
              @drag-start="handleDragStart"
              @drag-over="handleDragOver"
              @drop="handleDrop"
              @drag-end="handleDragEnd"
              @image-upload="handleImageUpload"
              @generate-image="generateShotImageForShot"
              @generate-video="generateShotVideoForShot"
              @generate-from-ai="emit('generateFromAI', $event)"
              @duplicate="duplicateShot"
              @move-up="moveShot($event, 'up')"
              @move-down="moveShot($event, 'down')"
              @delete="deleteShot"
              @toggle-scene="toggleShotScene"
              @toggle-character="toggleShotCharacter"
              @toggle-prop="toggleShotProp"
              @add-shot="addShot()"
            />

            <!-- ========== 场景管理视图 ========== -->
            <StoryboardScenesView
              v-else-if="activeTab === 'scenes'"
              :scenes="scenes"
              :color-options="colorOptions"
              :generating-scene-ids="generatingSceneIds"
              @add-scene="addScene"
              @delete-scene="deleteScene"
              @update-scene="updateScene"
              @image-upload="handleSceneImageUpload"
              @generate-image="generateSceneImage"
            />

            <!-- ========== 人物管理视图 ========== -->
            <StoryboardCharactersView
              v-else-if="activeTab === 'characters'"
              :characters="characters"
              :color-options="colorOptions"
              :generating-character-ids="generatingCharacterIds"
              @add-character="addCharacter"
              @delete-character="deleteCharacter"
              @update-character="updateCharacter"
              @image-upload="handleCharacterImageUpload"
              @generate-image="generateCharacterImage"
              @create-sora-character="handleCreateSoraCharacter"
            />

            <!-- ========== 道具管理视图 ========== -->
            <StoryboardPropsView
              v-else-if="activeTab === 'props'"
              :story-props="storyProps"
              :color-options="colorOptions"
              :generating-prop-ids="generatingPropIds"
              @add-prop="addProp"
              @delete-prop="deleteProp"
              @update-prop="updateProp"
              @image-upload="handlePropImageUpload"
              @generate-image="generatePropImage"
            />

            <!-- ========== 分镜列表视图 ========== -->
            <!-- List View -->
            <template v-else-if="viewMode === 'list'">
              <table class="w-full border-collapse">
                <thead class="sticky top-0 z-10 bg-[#18181b]">
                  <tr class="text-xs text-slate-500 uppercase tracking-wider">
                    <th class="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        :checked="allSelected"
                        @change="toggleSelectAll"
                        class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                    </th>
                    <th class="px-4 py-3 text-left w-12"></th>
                    <th class="px-4 py-3 text-left w-[200px]">分镜图</th>
                    <th v-if="visibleColumns.video" class="px-4 py-3 text-left w-[200px]">视频</th>
                    <th v-if="visibleColumns.shotNumber" class="px-4 py-3 text-center w-16">镜号</th>
                    <th v-if="visibleColumns.duration" class="px-4 py-3 text-center w-20">时长(秒)</th>
                    <th v-if="visibleColumns.sceneType" class="px-4 py-3 text-left w-24">景别</th>
                    <th v-if="visibleColumns.cameraMovement" class="px-4 py-3 text-left w-32">运镜</th>
                    <th v-if="visibleColumns.scene" class="px-4 py-3 text-left w-32">场景</th>
                    <th v-if="visibleColumns.characters" class="px-4 py-3 text-left w-40">人物</th>
                    <th v-if="visibleColumns.props" class="px-4 py-3 text-left w-40">道具</th>
                    <th v-if="visibleColumns.description" class="px-4 py-3 text-left min-w-[150px]">描述</th>
                    <th v-if="visibleColumns.dialogue" class="px-4 py-3 text-left min-w-[120px]">台词</th>
                    <th v-if="visibleColumns.notes" class="px-4 py-3 text-left min-w-[120px]">备注</th>
                    <th class="px-4 py-3 text-center w-[180px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="shot in shots"
                    :key="shot.id"
                    :class="[
                      'group border-b border-white/5 hover:bg-white/[0.02] transition-colors',
                      selectedShotIds.has(shot.id) ? 'bg-cyan-500/5' : '',
                      draggedShotId === shot.id ? 'opacity-50' : ''
                    ]"
                    draggable="true"
                    @dragstart="handleDragStart($event, shot.id)"
                    @dragover="handleDragOver"
                    @drop="handleDrop($event, shot.id)"
                    @dragend="handleDragEnd"
                  >
                    <!-- Checkbox -->
                    <td class="px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="selectedShotIds.has(shot.id)"
                        @change="toggleSelectShot(shot.id)"
                        class="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                      />
                    </td>

                    <!-- Drag Handle -->
                    <td class="px-2 py-3 cursor-grab active:cursor-grabbing">
                      <GripVertical :size="16" class="text-slate-600 hover:text-slate-400" />
                    </td>

                    <!-- Scene Image -->
                    <td class="px-4 py-3">
                      <div class="relative group/img">
                        <div
                          v-if="shot.sceneImage"
                          class="w-[160px] h-[90px] rounded-xl overflow-hidden border border-white/10"
                        >
                          <img :src="shot.sceneImage" class="w-full h-full object-cover" />
                        </div>
                        <div
                          v-else
                          class="flex flex-col items-center justify-center w-[160px] h-[90px] rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 transition-colors bg-white/[0.02]"
                        >
                          <label class="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                            <Upload :size="20" class="text-slate-600 mb-1" />
                            <span class="text-[10px] text-slate-600">上传分镜图</span>
                            <input
                              type="file"
                              accept="image/*"
                              class="hidden"
                              @change="handleImageUpload($event, shot.id, 'scene')"
                            />
                          </label>
                        </div>
                        <!-- Action buttons on hover -->
                        <div class="absolute inset-0 w-[160px] h-[90px] flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl">
                          <button
                            @click.stop="generateShotImageForShot(shot.id)"
                            :disabled="generatingShotIds.has(shot.id)"
                            class="p-2 bg-purple-500/80 hover:bg-purple-500 rounded-lg text-white transition-all disabled:opacity-50"
                            :title="shot.sceneImage ? '重新生成' : 'AI生成'"
                          >
                            <Loader2 v-if="generatingShotIds.has(shot.id)" :size="14" class="animate-spin" />
                            <Sparkles v-else :size="14" />
                          </button>
                          <label class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all cursor-pointer">
                            <Upload :size="14" />
                            <input
                              type="file"
                              accept="image/*"
                              class="hidden"
                              @change="handleImageUpload($event, shot.id, 'scene')"
                            />
                          </label>
                        </div>
                      </div>
                    </td>

                    <!-- Shot Number -->
                    <td v-if="visibleColumns.shotNumber" class="px-4 py-3 text-center">
                      <div class="w-8 h-8 mx-auto rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">
                        {{ shot.shotNumber }}
                      </div>
                    </td>

                    <!-- Duration -->
                    <td v-if="visibleColumns.duration" class="px-4 py-3 text-center">
                      <input
                        type="number"
                        v-model.number="shot.duration"
                        min="0"
                        class="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="0"
                      />
                    </td>

                    <!-- Scene Type -->
                    <td v-if="visibleColumns.sceneType" class="px-4 py-3">
                      <SelectDropdown
                        :options="sceneTypes"
                        v-model="shot.sceneType"
                        placeholder="选择景别"
                        dropdown-width="100%"
                        hover-border-color="cyan-500"
                        active-color="emerald"
                      />
                    </td>

                    <!-- Camera Movement -->
                    <td v-if="visibleColumns.cameraMovement" class="px-4 py-3">
                      <SelectDropdown
                        :options="cameraMovements"
                        v-model="shot.cameraMovement"
                        placeholder="选择运镜"
                        dropdown-width="100%"
                        hover-border-color="cyan-500"
                        active-color="emerald"
                      />
                    </td>

                    <!-- Scene -->
                    <td v-if="visibleColumns.scene" class="px-4 py-3">
                      <div class="relative group/scene">
                        <button
                          class="flex items-center gap-2 w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:border-emerald-500/50 transition-colors"
                        >
                          <div
                            v-if="shot.sceneId && getSceneById(shot.sceneId)"
                            class="w-3 h-3 rounded-full flex-shrink-0"
                            :style="{ backgroundColor: getSceneById(shot.sceneId)?.color }"
                          />
                          <span class="truncate text-left flex-1">
                            {{ shot.sceneId && getSceneById(shot.sceneId) ? getSceneById(shot.sceneId)?.name : '选择场景' }}
                          </span>
                          <ChevronDown :size="12" class="text-slate-500 flex-shrink-0" />
                        </button>
                        <!-- Scene dropdown -->
                        <div class="absolute top-full left-0 mt-1 w-48 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/scene:opacity-100 group-hover/scene:pointer-events-auto transition-all z-50 max-h-48 overflow-y-auto custom-scrollbar">
                          <div
                            class="px-3 py-2 text-xs text-slate-500 hover:bg-white/5 cursor-pointer border-b border-white/5"
                            @click="shot.sceneId = undefined"
                          >
                            无场景
                          </div>
                          <div
                            v-for="scene in scenes"
                            :key="scene.id"
                            :class="[
                              'flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-white/10',
                              shot.sceneId === scene.id ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'
                            ]"
                            @click="shot.sceneId = scene.id"
                          >
                            <div
                              class="w-3 h-3 rounded-full flex-shrink-0"
                              :style="{ backgroundColor: scene.color }"
                            />
                            <span class="truncate">{{ scene.name }}</span>
                            <Check v-if="shot.sceneId === scene.id" :size="12" class="ml-auto text-emerald-400" />
                          </div>
                          <div
                            v-if="scenes.length === 0"
                            class="px-3 py-4 text-xs text-slate-600 text-center"
                          >
                            暂无场景，请先添加
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Characters -->
                    <td v-if="visibleColumns.characters" class="px-4 py-3">
                      <div class="relative group/chars">
                        <button
                          class="flex items-center gap-1 w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:border-purple-500/50 transition-colors min-h-[34px]"
                        >
                          <div v-if="shot.characterIds && shot.characterIds.length > 0" class="flex items-center gap-1 flex-wrap">
                            <div
                              v-for="charId in shot.characterIds.slice(0, 3)"
                              :key="charId"
                              class="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]"
                            >
                              <div
                                class="w-2 h-2 rounded-full"
                                :style="{ backgroundColor: getCharacterById(charId)?.color }"
                              />
                              <span class="truncate max-w-[40px]">{{ getCharacterById(charId)?.name }}</span>
                            </div>
                            <span v-if="shot.characterIds.length > 3" class="text-[10px] text-slate-500">
                              +{{ shot.characterIds.length - 3 }}
                            </span>
                          </div>
                          <span v-else class="text-slate-500 text-xs">选择人物</span>
                          <ChevronDown :size="12" class="text-slate-500 ml-auto flex-shrink-0" />
                        </button>
                        <!-- Characters dropdown -->
                        <div class="absolute top-full left-0 mt-1 w-52 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/chars:opacity-100 group-hover/chars:pointer-events-auto transition-all z-50 max-h-56 overflow-y-auto custom-scrollbar">
                          <div
                            v-for="char in characters"
                            :key="char.id"
                            :class="[
                              'flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-white/10',
                              shot.characterIds?.includes(char.id) ? 'text-purple-400 bg-purple-500/10' : 'text-slate-300'
                            ]"
                            @click="toggleShotCharacter(shot.id, char.id)"
                          >
                            <div
                              class="w-3 h-3 rounded-full flex-shrink-0"
                              :style="{ backgroundColor: char.color }"
                            />
                            <span class="truncate flex-1">{{ char.name }}</span>
                            <div
                              :class="[
                                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                shot.characterIds?.includes(char.id) 
                                  ? 'bg-purple-500 border-purple-500' 
                                  : 'border-white/20'
                              ]"
                            >
                              <Check v-if="shot.characterIds?.includes(char.id)" :size="10" class="text-white" />
                            </div>
                          </div>
                          <div
                            v-if="characters.length === 0"
                            class="px-3 py-4 text-xs text-slate-600 text-center"
                          >
                            暂无人物，请先添加
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Props -->
                    <td v-if="visibleColumns.props" class="px-4 py-3">
                      <div class="relative group/props">
                        <button
                          class="flex items-center gap-1 w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:border-orange-500/50 transition-colors min-h-[34px]"
                        >
                          <div v-if="shot.propIds && shot.propIds.length > 0" class="flex items-center gap-1 flex-wrap">
                            <div
                              v-for="propId in shot.propIds.slice(0, 3)"
                              :key="propId"
                              class="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]"
                            >
                              <div
                                class="w-2 h-2 rounded-full"
                                :style="{ backgroundColor: getPropById(propId)?.color }"
                              />
                              <span class="truncate max-w-[40px]">{{ getPropById(propId)?.name }}</span>
                            </div>
                            <span v-if="shot.propIds.length > 3" class="text-[10px] text-slate-500">
                              +{{ shot.propIds.length - 3 }}
                            </span>
                          </div>
                          <span v-else class="text-slate-500 text-xs">选择道具</span>
                          <ChevronDown :size="12" class="text-slate-500 ml-auto flex-shrink-0" />
                        </button>
                        <!-- Props dropdown -->
                        <div class="absolute top-full left-0 mt-1 w-52 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/props:opacity-100 group-hover/props:pointer-events-auto transition-all z-50 max-h-56 overflow-y-auto custom-scrollbar">
                          <div
                            v-for="prop in storyProps"
                            :key="prop.id"
                            :class="[
                              'flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-white/10',
                              shot.propIds?.includes(prop.id) ? 'text-orange-400 bg-orange-500/10' : 'text-slate-300'
                            ]"
                            @click="toggleShotProp(shot.id, prop.id)"
                          >
                            <div
                              class="w-3 h-3 rounded-full flex-shrink-0"
                              :style="{ backgroundColor: prop.color }"
                            />
                            <span class="truncate flex-1">{{ prop.name }}</span>
                            <div
                              :class="[
                                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                shot.propIds?.includes(prop.id) 
                                  ? 'bg-orange-500 border-orange-500' 
                                  : 'border-white/20'
                              ]"
                            >
                              <Check v-if="shot.propIds?.includes(prop.id)" :size="10" class="text-white" />
                            </div>
                          </div>
                          <div
                            v-if="storyProps.length === 0"
                            class="px-3 py-4 text-xs text-slate-600 text-center"
                          >
                            暂无道具，请先添加
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Description -->
                    <td v-if="visibleColumns.description" class="px-4 py-3">
                      <input
                        type="text"
                        v-model="shot.description"
                        class="w-full h-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="请输入"
                      />
                    </td>

                    <!-- Dialogue -->
                    <td v-if="visibleColumns.dialogue" class="px-4 py-3">
                      <input
                        type="text"
                        v-model="shot.dialogue"
                        class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="请输入"
                      />
                    </td>

                    <!-- Notes -->
                    <td v-if="visibleColumns.notes" class="px-4 py-3">
                      <input
                        type="text"
                        v-model="shot.notes"
                        class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="请输入"
                      />
                    </td>

                    <!-- Actions -->
                    <td class="px-4 py-3">
                      <div class="flex items-center justify-center gap-1">
                        <button
                          @click="emit('generateFromAI', shot.id)"
                          class="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          <Sparkles :size="12" />
                          AI分析镜头
                        </button>
                        <button
                          @click="duplicateShot(shot)"
                          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
                          title="复制"
                        >
                          <Copy :size="14" />
                        </button>
                        <button
                          @click="moveShot(shot.id, 'up')"
                          :disabled="shot.shotNumber === 1"
                          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上移"
                        >
                          <ChevronUp :size="14" />
                        </button>
                        <button
                          @click="moveShot(shot.id, 'down')"
                          :disabled="shot.shotNumber === shots.length"
                          class="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          title="下移"
                        >
                          <ChevronDown :size="14" />
                        </button>
                        <button
                          @click="deleteShot(shot.id)"
                          class="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-slate-500 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 :size="14" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Empty State -->
                  <tr v-if="shots.length === 0">
                    <td :colspan="Object.values(visibleColumns).filter(v => v).length + 4" class="py-20 text-center">
                      <div class="flex flex-col items-center gap-4 text-slate-500">
                        <Film :size="48" :stroke-width="1" class="opacity-30" />
                        <div>
                          <p class="text-sm font-medium">暂无分镜</p>
                          <p class="text-xs mt-1 opacity-60">点击"新增"按钮添加第一个分镜</p>
                        </div>
                        <button
                          @click="addShot()"
                          class="mt-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                        >
                          <Plus :size="14" class="inline mr-1" />
                          添加分镜
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>

            <!-- Grid View -->
            <template v-else>
              <div class="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <div
                  v-for="shot in shots"
                  :key="shot.id"
                  :class="[
                    'group relative rounded-2xl border overflow-hidden transition-all cursor-pointer hover:scale-[1.02]',
                    selectedShotIds.has(shot.id) ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-white/10 hover:border-white/20'
                  ]"
                  @click="toggleSelectShot(shot.id)"
                >
                  <!-- Image -->
                  <div class="aspect-video bg-[#1c1c1e] relative">
                    <img
                      v-if="shot.sceneImage"
                      :src="shot.sceneImage"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <label class="flex flex-col items-center cursor-pointer">
                        <Upload :size="24" class="text-slate-600 mb-1" />
                        <span class="text-[10px] text-slate-600">上传分镜图</span>
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleImageUpload($event, shot.id, 'scene')"
                          @click.stop
                        />
                      </label>
                    </div>
                    

                    <!-- Shot Number Badge -->
                    <div class="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center text-xs font-bold">
                      {{ shot.shotNumber }}
                    </div>

                    <!-- Duration Badge -->
                    <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium flex items-center gap-1">
                      <Clock :size="10" />
                      {{ shot.duration }}s
                    </div>
                  </div>

                  <!-- Info -->
                  <div class="p-3 bg-[#18181b]">
                    <div class="flex items-center gap-2 text-[10px] text-slate-500 mb-2 flex-wrap">
                      <span class="px-1.5 py-0.5 bg-white/5 rounded">{{ shot.sceneType }}</span>
                      <span class="px-1.5 py-0.5 bg-white/5 rounded">{{ shot.cameraMovement }}</span>
                      <!-- Scene badge -->
                      <span
                        v-if="shot.sceneId && getSceneById(shot.sceneId)"
                        class="flex items-center gap-1 px-1.5 py-0.5 rounded"
                        :style="{ backgroundColor: getSceneById(shot.sceneId)?.color + '30' }"
                      >
                        <div
                          class="w-2 h-2 rounded-full"
                          :style="{ backgroundColor: getSceneById(shot.sceneId)?.color }"
                        />
                        <span :style="{ color: getSceneById(shot.sceneId)?.color }">{{ getSceneById(shot.sceneId)?.name }}</span>
                      </span>
                    </div>
                    <!-- Characters -->
                    <div v-if="shot.characterIds && shot.characterIds.length > 0" class="flex items-center gap-1 mb-2 flex-wrap">
                      <div
                        v-for="charId in shot.characterIds.slice(0, 2)"
                        :key="charId"
                        class="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-slate-400"
                      >
                        <div
                          class="w-2 h-2 rounded-full"
                          :style="{ backgroundColor: getCharacterById(charId)?.color }"
                        />
                        <span>{{ getCharacterById(charId)?.name }}</span>
                      </div>
                      <span v-if="shot.characterIds.length > 2" class="text-[10px] text-slate-600">
                        +{{ shot.characterIds.length - 2 }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-300 line-clamp-2">
                      {{ shot.description || '暂无描述' }}
                    </p>
                  </div>

                  <!-- Hover Actions -->
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      @click.stop="generateShotImageForShot(shot.id)"
                      :disabled="generatingShotIds.has(shot.id)"
                      class="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl text-cyan-300 transition-colors disabled:opacity-50"
                      :title="shot.sceneImage ? '重新生成分镜图' : '生成分镜图'"
                    >
                      <Loader2 v-if="generatingShotIds.has(shot.id)" :size="16" class="animate-spin" />
                      <ImageIcon v-else :size="16" />
                    </button>
                    <button
                      @click.stop="emit('generateFromAI', shot.id)"
                      class="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-300 transition-colors"
                      title="AI分析"
                    >
                      <Sparkles :size="16" />
                    </button>
                    <button
                      @click.stop="duplicateShot(shot)"
                      class="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                      title="复制"
                    >
                      <Copy :size="16" />
                    </button>
                    <button
                      @click.stop="deleteShot(shot.id)"
                      class="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </div>

                <!-- Add New Card -->
                <button
                  @click="addShot()"
                  class="aspect-video rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 flex flex-col items-center justify-center gap-2 transition-colors bg-white/[0.02] hover:bg-cyan-500/5"
                >
                  <Plus :size="24" class="text-slate-500" />
                  <span class="text-xs text-slate-500">添加分镜</span>
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 批量设置场景对话框 -->
    <BatchSceneDialog
      :is-open="isBatchSceneOpen"
      :scenes="scenes"
      :selected-count="selectedShotIds.size"
      :selected-scene-id="batchSelectedScene"
      @update:isOpen="isBatchSceneOpen = $event"
      @update:selectedSceneId="batchSelectedScene = $event"
      @apply="applyBatchScene"
    />


    <!-- 批量设置人物对话框 -->
    <BatchCharactersDialog
      :is-open="isBatchCharactersOpen"
      :characters="characters"
      :selected-count="selectedShotIds.size"
      :selected-character-ids="batchSelectedCharacters"
      @update:isOpen="isBatchCharactersOpen = $event"
      @toggle-character="toggleBatchCharacter"
      @apply="applyBatchCharacters"
    />

 

    <!-- 批量设置道具对话框 -->
    <BatchPropsDialog
      :is-open="isBatchPropsOpen"
      :story-props="storyProps"
      :selected-count="selectedShotIds.size"
      :selected-prop-ids="batchSelectedProps"
      @update:isOpen="isBatchPropsOpen = $event"
      @toggle-prop="toggleBatchProp"
      @apply="applyBatchProps"
    />



    <!-- 批量生成图片对话框 -->
    <BatchGenerateDialog
      :is-open="isBatchGenerateOpen"
      :scenes="scenes"
      :characters="characters"
      :story-props="storyProps"
      :is-generating="isBatchGenerating"
      :progress="batchGenerateProgress"
      @update:isOpen="isBatchGenerateOpen = $event"
      @generate="handleBatchGenerate"
    />

  </Teleport>
</template>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Custom scrollbar */
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

/* Custom select arrow */
select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

select option {
  background: #1c1c1e;
  color: white;
}
</style>

