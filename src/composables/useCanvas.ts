import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { AppNode, Connection, Group, NodeType, NodeStatus, Workflow, AssetHistoryItem } from '../types'
import { saveToStorage, loadFromStorage } from '../services/storage'

export function useCanvas() {
  // --- Global App State ---
  const workflows = ref<Workflow[]>([])
  const assetHistory = ref<AssetHistoryItem[]>([])
  const selectedWorkflowId = ref<string | null>(null)
  const isLoaded = ref(false)

  // --- Canvas State ---
  const nodes = ref<AppNode[]>([])
  const connections = ref<Connection[]>([])
  const groups = ref<Group[]>([])
  const clipboard = ref<AppNode | null>(null)

  // History
  const history = ref<any[]>([])
  const historyIndex = ref(-1)

  // Viewport
  const scale = ref(1)
  const pan = ref({ x: 0, y: 0 })
  const isDraggingCanvas = ref(false)
  const lastMousePos = ref({ x: 0, y: 0 })
  const mousePos = ref({ x: 0, y: 0 })

  // Interaction / Selection
  const selectedNodeIds = ref<string[]>([])
  const selectedGroupId = ref<string | null>(null)
  const draggingNodeId = ref<string | null>(null)
  const draggingNodeParentGroupId = ref<string | null>(null)
  const draggingGroup = ref<any>(null)
  const resizingGroupId = ref<string | null>(null)
  const activeGroupNodeIds = ref<string[]>([])
  const connectionStart = ref<{ id: string, x: number, y: number } | null>(null)
  const selectionRect = ref<any>(null)

  // Node Resizing
  const resizingNodeId = ref<string | null>(null)
  const initialSize = ref<{ width: number, height: number } | null>(null)
  const resizeStartPos = ref<{ x: number, y: number } | null>(null)

  // Constants
  const SNAP_THRESHOLD = 8
  const COLLISION_PADDING = 24

  // --- Persistence ---
  const loadData = async () => {
    try {
      const sAssets = await loadFromStorage<AssetHistoryItem[]>('assets')
      if (sAssets) assetHistory.value = sAssets
      const sWfs = await loadFromStorage<Workflow[]>('workflows')
      if (sWfs) workflows.value = sWfs
      const sNodes = await loadFromStorage<AppNode[]>('nodes')
      if (sNodes) nodes.value = sNodes
      const sConns = await loadFromStorage<Connection[]>('connections')
      if (sConns) connections.value = sConns
      const sGroups = await loadFromStorage<Group[]>('groups')
      if (sGroups) groups.value = sGroups
    } catch (e) {
      console.error("Failed to load storage", e)
    } finally {
      isLoaded.value = true
    }
  }

  const saveData = () => {
    if (!isLoaded.value) return
    saveToStorage('assets', assetHistory.value)
    saveToStorage('workflows', workflows.value)
    saveToStorage('nodes', nodes.value)
    saveToStorage('connections', connections.value)
    saveToStorage('groups', groups.value)
  }

  // Watch for changes and save
  watch([assetHistory, workflows, nodes, connections, groups], saveData, { deep: true })

  // --- Helper Functions ---
  const getApproxNodeHeight = (node: AppNode) => {
    if (node.height) return node.height
    const width = node.width || 420
    if (['PROMPT_INPUT', 'VIDEO_ANALYZER', 'IMAGE_EDITOR'].includes(node.type)) return 360
    if (node.type === 'AUDIO_GENERATOR') return 200
    const [w, h] = (node.data.aspectRatio || '16:9').split(':').map(Number)
    const extra = (node.type === 'VIDEO_GENERATOR' && node.data.generationMode === 'CUT') ? 36 : 0
    return ((width * h / w) + extra)
  }

  const getNodeBounds = (node: AppNode) => {
    const h = node.height || getApproxNodeHeight(node)
    const w = node.width || 420
    return { x: node.x, y: node.y, width: w, height: h, r: node.x + w, b: node.y + h }
  }

  // --- History ---
  const saveHistory = () => {
    try {
      const currentStep = {
        nodes: JSON.parse(JSON.stringify(nodes.value)),
        connections: JSON.parse(JSON.stringify(connections.value)),
        groups: JSON.parse(JSON.stringify(groups.value))
      }
      const newHistory = history.value.slice(0, historyIndex.value + 1)
      newHistory.push(currentStep)
      if (newHistory.length > 50) newHistory.shift()
      history.value = newHistory
      historyIndex.value = newHistory.length - 1
    } catch (e) {
      console.warn("History save failed:", e)
    }
  }

  const undo = () => {
    const idx = historyIndex.value
    if (idx > 0) {
      const prev = history.value[idx - 1]
      nodes.value = prev.nodes
      connections.value = prev.connections
      groups.value = prev.groups
      historyIndex.value = idx - 1
    }
  }

  // --- Node Operations ---
  const deleteNodes = (ids: string[]) => {
    if (ids.length === 0) return
    saveHistory()
    nodes.value = nodes.value
      .filter(n => !ids.includes(n.id))
      .map(n => ({ ...n, inputs: n.inputs.filter(i => !ids.includes(i)) }))
    connections.value = connections.value.filter(c => !ids.includes(c.from) && !ids.includes(c.to))
    selectedNodeIds.value = []
  }

  const addNode = (type: NodeType, x?: number, y?: number, initialData?: any) => {
    try { saveHistory() } catch (e) { }

    const defaults: any = {
      model: type === 'VIDEO_GENERATOR' ? 'veo-3.1-fast-generate-preview' :
        type === 'VIDEO_ANALYZER' ? 'gemini-3-pro-preview' :
          type === 'AUDIO_GENERATOR' ? 'gemini-2.5-flash-preview-tts' :
            type.includes('IMAGE') ? 'gemini-2.5-flash-image' :
              'gemini-3-pro-preview',
      generationMode: type === 'VIDEO_GENERATOR' ? 'DEFAULT' : undefined,
      ...initialData
    }

    const typeMap: Record<string, string> = {
      PROMPT_INPUT: '创意描述',
      IMAGE_GENERATOR: '文字生图',
      VIDEO_GENERATOR: '文生视频',
      AUDIO_GENERATOR: '灵感音乐',
      VIDEO_ANALYZER: '视频分析',
      IMAGE_EDITOR: '图像编辑'
    }

    const safeX = x !== undefined ? x : (-pan.value.x + window.innerWidth / 2) / scale.value - 210
    const safeY = y !== undefined ? y : (-pan.value.y + window.innerHeight / 2) / scale.value - 180

    const newNode: AppNode = {
      id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: type as any,
      x: isNaN(safeX) ? 100 : safeX,
      y: isNaN(safeY) ? 100 : safeY,
      width: 420,
      title: typeMap[type] || '未命名节点',
      status: 'IDLE' as any,
      data: defaults,
      inputs: []
    }

    nodes.value.push(newNode)
    return newNode
  }

  const updateNode = (id: string, data: Partial<AppNode['data']>, size?: { width?: number, height?: number }, title?: string) => {
    const index = nodes.value.findIndex(n => n.id === id)
    if (index !== -1) {
      const node = nodes.value[index]
      const updated = {
        ...node,
        data: { ...node.data, ...data },
        title: title || node.title
      }
      if (size) {
        if (size.width) updated.width = size.width
        if (size.height) updated.height = size.height
      }
      nodes.value[index] = updated

      // Track assets
      if (data.image) {
        handleAssetGenerated('image', data.image, updated.title)
      }
      if (data.videoUri) {
        handleAssetGenerated('video', data.videoUri, updated.title)
      }
      if (data.audioUri) {
        handleAssetGenerated('audio', data.audioUri, updated.title)
      }
    }
  }

  const handleAssetGenerated = (type: 'image' | 'video' | 'audio', src: string, title: string) => {
    const exists = assetHistory.value.find(a => a.src === src)
    if (exists) return
    assetHistory.value.unshift({
      id: `a-${Date.now()}`,
      type,
      src,
      title,
      timestamp: Date.now()
    })
  }

  // --- Viewport ---
  const handleFitView = () => {
    if (nodes.value.length === 0) {
      pan.value = { x: 0, y: 0 }
      scale.value = 1
      return
    }

    const padding = 100
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    nodes.value.forEach(n => {
      const h = n.height || getApproxNodeHeight(n)
      const w = n.width || 420
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x + w > maxX) maxX = n.x + w
      if (n.y + h > maxY) maxY = n.y + h
    })

    const contentW = maxX - minX
    const contentH = maxY - minY

    const scaleX = (window.innerWidth - padding * 2) / contentW
    const scaleY = (window.innerHeight - padding * 2) / contentH
    let newScale = Math.min(scaleX, scaleY, 1)
    newScale = Math.max(0.2, newScale)

    const contentCenterX = minX + contentW / 2
    const contentCenterY = minY + contentH / 2

    const newPanX = (window.innerWidth / 2) - (contentCenterX * newScale)
    const newPanY = (window.innerHeight / 2) - (contentCenterY * newScale)

    pan.value = { x: newPanX, y: newPanY }
    scale.value = newScale
  }

  // --- Workflow Operations ---
  const saveCurrentAsWorkflow = () => {
    const thumbnailNode = nodes.value.find(n => n.data.image)
    const thumbnail = thumbnailNode?.data.image || ''
    const newWf: Workflow = {
      id: `wf-${Date.now()}`,
      title: `工作流 ${new Date().toLocaleDateString()}`,
      thumbnail,
      nodes: JSON.parse(JSON.stringify(nodes.value)),
      connections: JSON.parse(JSON.stringify(connections.value)),
      groups: JSON.parse(JSON.stringify(groups.value))
    }
    workflows.value.unshift(newWf)
  }

  const loadWorkflow = (id: string) => {
    const wf = workflows.value.find(w => w.id === id)
    if (wf) {
      saveHistory()
      nodes.value = JSON.parse(JSON.stringify(wf.nodes))
      connections.value = JSON.parse(JSON.stringify(wf.connections))
      groups.value = JSON.parse(JSON.stringify(wf.groups))
      selectedWorkflowId.value = id
    }
  }

  const deleteWorkflow = (id: string) => {
    workflows.value = workflows.value.filter(w => w.id !== id)
    if (selectedWorkflowId.value === id) selectedWorkflowId.value = null
  }

  const renameWorkflow = (id: string, newTitle: string) => {
    const index = workflows.value.findIndex(w => w.id === id)
    if (index !== -1) {
      workflows.value[index].title = newTitle
    }
  }

  const deleteAsset = (id: string) => {
    assetHistory.value = assetHistory.value.filter(a => a.id !== id)
  }

  return {
    // State
    workflows,
    assetHistory,
    selectedWorkflowId,
    isLoaded,
    nodes,
    connections,
    groups,
    clipboard,
    history,
    historyIndex,
    scale,
    pan,
    isDraggingCanvas,
    lastMousePos,
    mousePos,
    selectedNodeIds,
    selectedGroupId,
    draggingNodeId,
    draggingNodeParentGroupId,
    draggingGroup,
    resizingGroupId,
    activeGroupNodeIds,
    connectionStart,
    selectionRect,
    resizingNodeId,
    initialSize,
    resizeStartPos,

    // Constants
    SNAP_THRESHOLD,
    COLLISION_PADDING,

    // Methods
    loadData,
    saveHistory,
    undo,
    deleteNodes,
    addNode,
    updateNode,
    handleAssetGenerated,
    handleFitView,
    getApproxNodeHeight,
    getNodeBounds,
    saveCurrentAsWorkflow,
    loadWorkflow,
    deleteWorkflow,
    renameWorkflow,
    deleteAsset
  }
}


