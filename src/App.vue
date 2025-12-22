<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide, nextTick } from 'vue'
import {
  Plus, Copy, Trash2, Minus, X, Link, Unplug, RefreshCw, Upload, Scan,
  Image as ImageIcon, Film, MousePointerClick, Type, ScanFace, Brush, Mic2, FolderHeart
} from 'lucide-vue-next'
import { useCanvas, useKeyboard } from './composables'
import { NodeType, NodeStatus, type AppNode, type Connection, type Group, type ContextMenuState, type SmartSequenceItem, type AssetHistoryItem, type InputAsset, type Storyboard } from './types'
import { generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, compileMultiFramePrompt, urlToBase64, generateAudio, generateStory, generateStoryShots } from './services/geminiService'
import { getGenerationStrategy } from './services/videoStrategies'
import { saveToStorage, loadFromStorage } from './services/storage'

import SidebarDock from './components/SidebarDock.vue'
import ExpandedView from './components/ExpandedView.vue'
import SonicStudio from './components/SonicStudio.vue'
import SmartSequenceDock from './components/SmartSequenceDock.vue'
import NodeComponent from './components/Node.vue'
import ImageCropper from './components/ImageCropper.vue'
import SketchEditor from './components/SketchEditor.vue'
import SettingsModal from './components/SettingsModal.vue'
import AssistantPanel from './components/AssistantPanel.vue'
import StoryboardPanel from './components/StoryboardPanel.vue'

// Constants
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)"
const SNAP_THRESHOLD = 8
const COLLISION_PADDING = 24

// --- Canvas State from Composable ---
const canvas = useCanvas()
const {
  workflows,
  assetHistory,
  selectedWorkflowId,
  isLoaded,
  nodes,
  connections,
  groups,
  clipboard,
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
  activeGroupNodeIds,
  connectionStart,
  selectionRect,
  resizingNodeId,
  initialSize,
  resizeStartPos,
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
} = canvas

// --- UI State ---
const isChatOpen = ref(false)
const isSketchEditorOpen = ref(false)
const isMultiFrameOpen = ref(false)
const isSonicStudioOpen = ref(false)
const isSettingsOpen = ref(false)
const isStoryboardOpen = ref(false)

// --- Storyboard State ---
const currentStoryboard = ref<Storyboard | null>(null)
const storyboards = ref<Storyboard[]>([])

// Context Menu
const contextMenu = ref<ContextMenuState | null>(null)
const contextMenuTarget = ref<any>(null)

// Smart Sequence Dock Ref
const smartSequenceDockRef = ref<InstanceType<typeof SmartSequenceDock> | null>(null)

// Media Overlays
const expandedMedia = ref<any>(null)
const croppingNodeId = ref<string | null>(null)
const imageToCrop = ref<string | null>(null)

// Refs
const canvasRef = ref<HTMLDivElement | null>(null)
const replaceVideoInputRef = ref<HTMLInputElement | null>(null)
const replaceImageInputRef = ref<HTMLInputElement | null>(null)
const replacementTargetRef = ref<string | null>(null)

// Drag refs for node interaction
const dragNodeRef = ref<{
  id: string
  startX: number
  startY: number
  mouseStartX: number
  mouseStartY: number
  parentGroupId?: string | null
  siblingNodeIds: string[]
  nodeWidth: number
  nodeHeight: number
} | null>(null)

const dragGroupRef = ref<{
  id: string
  startX: number
  startY: number
  mouseStartX: number
  mouseStartY: number
  childNodes: { id: string; startX: number; startY: number }[]
} | null>(null)

// --- Keyboard Shortcuts ---
useKeyboard({
  onDelete: () => {
    if (selectedGroupId.value) {
      saveHistory()
      groups.value = groups.value.filter(g => g.id !== selectedGroupId.value)
      selectedGroupId.value = null
      return
    }
    if (selectedNodeIds.value.length > 0) {
      deleteNodes(selectedNodeIds.value)
    }
  },
  onUndo: undo,
  onCopy: () => {
    if (selectedNodeIds.value.length === 1) {
      const node = nodes.value.find(n => n.id === selectedNodeIds.value[0])
      if (node) clipboard.value = JSON.parse(JSON.stringify(node))
    }
  },
  onPaste: (x, y) => {
    if (clipboard.value) {
      saveHistory()
      const newNode: AppNode = {
        ...JSON.parse(JSON.stringify(clipboard.value)),
        id: `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        x: x,
        y: y,
        status: NodeStatus.IDLE,
        inputs: []
      }
      nodes.value.push(newNode)
      selectedNodeIds.value = [newNode.id]
    }
  },
  onSelectAll: () => {
    selectedNodeIds.value = nodes.value.map(n => n.id)
  },
  onEscape: () => {
    selectedNodeIds.value = []
    selectedGroupId.value = null
    contextMenu.value = null
  },
  onFitView: handleFitView
}, () => mousePos.value)

// --- Helper Functions ---
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
    case NodeType.STORY_GENERATOR: return Type // Will use BookOpen in actual render
    default: return Plus
  }
}

const getInputAssetsForNode = (node: AppNode): InputAsset[] => {
  return node.inputs
    .map(i => nodes.value.find(n => n.id === i))
    .filter(n => n && (n.data.image || n.data.videoUri || n.data.croppedFrame))
    .slice(0, 6)
    .map(n => ({
      id: n!.id,
      type: (n!.data.croppedFrame || n!.data.image) ? 'image' as const : 'video' as const,
      src: n!.data.croppedFrame || n!.data.image || n!.data.videoUri!
    }))
}

// --- Event Handlers ---
const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const newScale = Math.min(Math.max(0.2, scale.value - e.deltaY * 0.001), 3)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const scaleDiff = newScale - scale.value
    pan.value = {
      x: pan.value.x - (x - pan.value.x) * (scaleDiff / scale.value),
      y: pan.value.y - (y - pan.value.y) * (scaleDiff / scale.value)
    }
    scale.value = newScale
  } else {
    pan.value = {
      x: pan.value.x - e.deltaX,
      y: pan.value.y - e.deltaY
    }
  }
}

const handleCanvasMouseDown = (e: MouseEvent) => {
  if (contextMenu.value) contextMenu.value = null
  selectedGroupId.value = null

  if (e.button === 0 && !e.shiftKey) {
    if (e.detail > 1) {
      e.preventDefault()
      return
    }
    selectedNodeIds.value = []
    // Start selection rect
    selectionRect.value = {
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY
    }
  }

  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    isDraggingCanvas.value = true
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }
}

const handleCanvasDoubleClick = (e: MouseEvent) => {
  e.preventDefault()
  if (!selectionRect.value) {
    contextMenu.value = { visible: true, x: e.clientX, y: e.clientY }
    contextMenuTarget.value = { type: 'create' }
  }
}

const handleGlobalMouseMove = (e: MouseEvent) => {
  const { clientX, clientY } = e
  mousePos.value = { x: (clientX - pan.value.x) / scale.value, y: (clientY - pan.value.y) / scale.value }

  // Selection rect
  if (selectionRect.value) {
    selectionRect.value = {
      ...selectionRect.value,
      currentX: clientX,
      currentY: clientY
    }
    return
  }

  // Group dragging
  if (dragGroupRef.value) {
    const { id, startX, startY, mouseStartX, mouseStartY, childNodes } = dragGroupRef.value
    const dx = (clientX - mouseStartX) / scale.value
    const dy = (clientY - mouseStartY) / scale.value
    groups.value = groups.value.map(g => g.id === id ? { ...g, x: startX + dx, y: startY + dy } : g)
    if (childNodes.length > 0) {
      nodes.value = nodes.value.map(n => {
        const child = childNodes.find(c => c.id === n.id)
        return child ? { ...n, x: child.startX + dx, y: child.startY + dy } : n
      })
    }
    return
  }

  // Canvas panning
  if (isDraggingCanvas.value) {
    const dx = clientX - lastMousePos.value.x
    const dy = clientY - lastMousePos.value.y
    pan.value = { x: pan.value.x + dx, y: pan.value.y + dy }
    lastMousePos.value = { x: clientX, y: clientY }
    return
  }

  // Node dragging with snap
  if (draggingNodeId.value && dragNodeRef.value && dragNodeRef.value.id === draggingNodeId.value) {
    const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight } = dragNodeRef.value
    const dx = (clientX - mouseStartX) / scale.value
    const dy = (clientY - mouseStartY) / scale.value
    let proposedX = startX + dx
    let proposedY = startY + dy

    // Snap Logic
    const SNAP = SNAP_THRESHOLD / scale.value
    const myL = proposedX
    const myC = proposedX + nodeWidth / 2
    const myR = proposedX + nodeWidth
    const myT = proposedY
    const myM = proposedY + nodeHeight / 2
    const myB = proposedY + nodeHeight
    let snappedX = false
    let snappedY = false

    nodes.value.forEach(other => {
      if (other.id === draggingNodeId.value) return
      const otherBounds = getNodeBounds(other)
      if (!snappedX) {
        if (Math.abs(myL - otherBounds.x) < SNAP) { proposedX = otherBounds.x; snappedX = true }
        else if (Math.abs(myL - otherBounds.r) < SNAP) { proposedX = otherBounds.r; snappedX = true }
        else if (Math.abs(myR - otherBounds.x) < SNAP) { proposedX = otherBounds.x - nodeWidth; snappedX = true }
        else if (Math.abs(myR - otherBounds.r) < SNAP) { proposedX = otherBounds.r - nodeWidth; snappedX = true }
        else if (Math.abs(myC - (otherBounds.x + otherBounds.width / 2)) < SNAP) { proposedX = (otherBounds.x + otherBounds.width / 2) - nodeWidth / 2; snappedX = true }
      }
      if (!snappedY) {
        if (Math.abs(myT - otherBounds.y) < SNAP) { proposedY = otherBounds.y; snappedY = true }
        else if (Math.abs(myT - otherBounds.b) < SNAP) { proposedY = otherBounds.b; snappedY = true }
        else if (Math.abs(myB - otherBounds.y) < SNAP) { proposedY = otherBounds.y - nodeHeight; snappedY = true }
        else if (Math.abs(myB - otherBounds.b) < SNAP) { proposedY = otherBounds.b - nodeHeight; snappedY = true }
        else if (Math.abs(myM - (otherBounds.y + otherBounds.height / 2)) < SNAP) { proposedY = (otherBounds.y + otherBounds.height / 2) - nodeHeight / 2; snappedY = true }
      }
    })

    nodes.value = nodes.value.map(n => n.id === draggingNodeId.value ? { ...n, x: proposedX, y: proposedY } : n)
  }

  // Node resizing
  if (resizingNodeId.value && initialSize.value && resizeStartPos.value) {
    const dx = (clientX - resizeStartPos.value.x) / scale.value
    const dy = (clientY - resizeStartPos.value.y) / scale.value
    nodes.value = nodes.value.map(n => n.id === resizingNodeId.value ? {
      ...n,
      width: Math.max(360, initialSize.value!.width + dx),
      height: Math.max(240, initialSize.value!.height + dy)
    } : n)
  }
}

const handleGlobalMouseUp = () => {
  // Handle selection rect
  if (selectionRect.value) {
    const x = Math.min(selectionRect.value.startX, selectionRect.value.currentX)
    const y = Math.min(selectionRect.value.startY, selectionRect.value.currentY)
    const w = Math.abs(selectionRect.value.currentX - selectionRect.value.startX)
    const h = Math.abs(selectionRect.value.currentY - selectionRect.value.startY)

    if (w > 10) {
      const rect = { x: (x - pan.value.x) / scale.value, y: (y - pan.value.y) / scale.value, w: w / scale.value, h: h / scale.value }
      const enclosed = nodes.value.filter(n => {
        const cx = n.x + (n.width || 420) / 2
        const cy = n.y + 160
        return cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h
      })

      if (enclosed.length > 0) {
        saveHistory()
        // Create group for free nodes (not already in a group)
        const freeNodes = enclosed.filter(n => {
          const cx = n.x + (n.width || 420) / 2
          const cy = n.y + 160
          return !groups.value.some(g => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height)
        })

        if (freeNodes.length > 0) {
          const fMinX = Math.min(...freeNodes.map(n => n.x))
          const fMinY = Math.min(...freeNodes.map(n => n.y))
          const fMaxX = Math.max(...freeNodes.map(n => n.x + (n.width || 420)))
          const fMaxY = Math.max(...freeNodes.map(n => n.y + 320))
          groups.value.push({
            id: `g-${Date.now()}`,
            title: '新建分组',
            x: fMinX - 32,
            y: fMinY - 32,
            width: (fMaxX - fMinX) + 64,
            height: (fMaxY - fMinY) + 64
          })
        }
      }
    }
    selectionRect.value = null
  }

  // Collision detection for dropped node
  if (draggingNodeId.value) {
    const draggedNode = nodes.value.find(n => n.id === draggingNodeId.value)
    if (draggedNode) {
      const myBounds = getNodeBounds(draggedNode)
      const otherNodes = nodes.value.filter(n => n.id !== draggingNodeId.value)

      for (const other of otherNodes) {
        const otherBounds = getNodeBounds(other)

        // AABB Collision Check
        const isOverlapping = (
          myBounds.x < otherBounds.r &&
          myBounds.r > otherBounds.x &&
          myBounds.y < otherBounds.b &&
          myBounds.b > otherBounds.y
        )

        if (isOverlapping) {
          const overlapLeft = myBounds.r - otherBounds.x
          const overlapRight = otherBounds.r - myBounds.x
          const overlapTop = myBounds.b - otherBounds.y
          const overlapBottom = otherBounds.b - myBounds.y

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

          if (minOverlap === overlapLeft) {
            draggedNode.x = otherBounds.x - myBounds.width - COLLISION_PADDING
          } else if (minOverlap === overlapRight) {
            draggedNode.x = otherBounds.r + COLLISION_PADDING
          } else if (minOverlap === overlapTop) {
            draggedNode.y = otherBounds.y - myBounds.height - COLLISION_PADDING
          } else if (minOverlap === overlapBottom) {
            draggedNode.y = otherBounds.b + COLLISION_PADDING
          }

          myBounds.x = draggedNode.x
          myBounds.y = draggedNode.y
          myBounds.r = draggedNode.x + myBounds.width
          myBounds.b = draggedNode.y + myBounds.height
        }
      }

      nodes.value = nodes.value.map(n => n.id === draggingNodeId.value ? { ...n, x: draggedNode.x, y: draggedNode.y } : n)
    }
  }

  if (draggingNodeId.value || resizingNodeId.value || dragGroupRef.value) saveHistory()

  isDraggingCanvas.value = false
  draggingNodeId.value = null
  draggingNodeParentGroupId.value = null
  draggingGroup.value = null
  activeGroupNodeIds.value = []
  resizingNodeId.value = null
  initialSize.value = null
  resizeStartPos.value = null
  connectionStart.value = null
  dragNodeRef.value = null
  dragGroupRef.value = null
}

// --- Node Event Handlers ---
const handleNodeMouseDown = (e: MouseEvent, id: string) => {
  e.stopPropagation()
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    if (selectedNodeIds.value.includes(id)) {
      selectedNodeIds.value = selectedNodeIds.value.filter(i => i !== id)
    } else {
      selectedNodeIds.value = [...selectedNodeIds.value, id]
    }
  } else {
    selectedNodeIds.value = [id]
  }

  const n = nodes.value.find(x => x.id === id)
  if (n) {
    const w = n.width || 420
    const h = n.height || getApproxNodeHeight(n)
    const cx = n.x + w / 2
    const cy = n.y + 160
    const pGroup = groups.value.find(g => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height)
    let siblingNodeIds: string[] = []
    if (pGroup) {
      siblingNodeIds = nodes.value.filter(other => {
        if (other.id === id) return false
        const b = getNodeBounds(other)
        const ocx = b.x + b.width / 2
        const ocy = b.y + b.height / 2
        return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height
      }).map(s => s.id)
    }
    dragNodeRef.value = { id, startX: n.x, startY: n.y, mouseStartX: e.clientX, mouseStartY: e.clientY, parentGroupId: pGroup?.id, siblingNodeIds, nodeWidth: w, nodeHeight: h }
    draggingNodeParentGroupId.value = pGroup?.id || null
    draggingNodeId.value = id
  }
}

const handlePortMouseDown = (e: MouseEvent, id: string, type: 'input' | 'output') => {
  e.stopPropagation()
  connectionStart.value = { id, x: e.clientX, y: e.clientY }
}

const handlePortMouseUp = (e: MouseEvent, id: string, type: 'input' | 'output') => {
  e.stopPropagation()
  if (connectionStart.value && connectionStart.value.id !== id) {
    if (connectionStart.value.id !== 'smart-sequence-dock') {
      const exists = connections.value.some(c => c.from === connectionStart.value!.id && c.to === id)
      if (!exists) {
        saveHistory()
        connections.value.push({ from: connectionStart.value.id, to: id })
        nodes.value = nodes.value.map(n => n.id === id ? { ...n, inputs: [...n.inputs, connectionStart.value!.id] } : n)
      }
    }
  }
  connectionStart.value = null
}

const handleNodeContextMenu = (e: MouseEvent, id: string) => {
  e.stopPropagation()
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, id }
  contextMenuTarget.value = { type: 'node', id }
}

const handleResizeMouseDown = (e: MouseEvent, id: string, w: number, h: number) => {
  e.stopPropagation()
  const n = nodes.value.find(x => x.id === id)
  if (n) {
    const cx = n.x + w / 2
    const cy = n.y + 160
    const pGroup = groups.value.find(g => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height)
    draggingNodeParentGroupId.value = pGroup?.id || null
  }
  resizingNodeId.value = id
  initialSize.value = { width: w, height: h }
  resizeStartPos.value = { x: e.clientX, y: e.clientY }
}

const handleNodeUpdate = (id: string, data: any, size?: any, title?: string) => {
  updateNode(id, data, size, title || undefined)
}

const handleNodeAction = async (id: string, promptOverride?: string) => {
  const node = nodes.value.find(n => n.id === id)
  if (!node) return

  handleNodeUpdate(id, { error: undefined })
  nodes.value = nodes.value.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n)

  try {
    const inputs = node.inputs.map(i => nodes.value.find(n => n.id === i)).filter(Boolean) as AppNode[]

    const upstreamTexts = inputs.map(n => {
      if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt
      if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis
      return null
    }).filter(t => t && t.trim().length > 0) as string[]

    let prompt = promptOverride || node.data.prompt || ''
    if (upstreamTexts.length > 0) {
      const combinedUpstream = upstreamTexts.join('\n')
      prompt = prompt ? `${combinedUpstream}\n${prompt}` : combinedUpstream
    }

    if (node.type === NodeType.IMAGE_GENERATOR) {
      const inputImages: string[] = []
      inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image) })

      // Check for storyboard
      const isStoryboard = /分镜|storyboard|sequence|shots|frames|json/i.test(prompt)
      if (isStoryboard) {
        try {
          const storyboard = await planStoryboard(prompt, upstreamTexts.join('\n'))
          if (storyboard.length > 1) {
            const newNodes: AppNode[] = []
            const newConnections: Connection[] = []
            const COLUMNS = 3
            const gapX = 40, gapY = 40
            const childWidth = node.width || 420
            const ratio = node.data.aspectRatio || '16:9'
            const [rw, rh] = ratio.split(':').map(Number)
            const childHeight = (childWidth * rh / rw)
            const startX = node.x + (node.width || 420) + 150
            const startY = node.y
            const totalRows = Math.ceil(storyboard.length / COLUMNS)

            storyboard.forEach((shotPrompt, index) => {
              const col = index % COLUMNS
              const row = Math.floor(index / COLUMNS)
              const posX = startX + col * (childWidth + gapX)
              const posY = startY + row * (childHeight + gapY)
              const newNodeId = `n-${Date.now()}-${index}`
              newNodes.push({
                id: newNodeId,
                type: NodeType.IMAGE_GENERATOR,
                x: posX,
                y: posY,
                width: childWidth,
                height: childHeight,
                title: `分镜 ${index + 1}`,
                status: NodeStatus.WORKING,
                data: { ...node.data, aspectRatio: ratio, prompt: shotPrompt, image: undefined, images: undefined, imageCount: 1 },
                inputs: [node.id]
              })
              newConnections.push({ from: node.id, to: newNodeId })
            })

            const groupPadding = 30
            const groupWidth = (Math.min(storyboard.length, COLUMNS) * childWidth) + ((Math.min(storyboard.length, COLUMNS) - 1) * gapX) + (groupPadding * 2)
            const groupHeight = (totalRows * childHeight) + ((totalRows - 1) * gapY) + (groupPadding * 2)

            groups.value.push({ id: `g-${Date.now()}`, title: '分镜生成组', x: startX - groupPadding, y: startY - groupPadding, width: groupWidth, height: groupHeight })
            nodes.value = [...nodes.value, ...newNodes]
            connections.value = [...connections.value, ...newConnections]
            handleNodeUpdate(id, { status: NodeStatus.SUCCESS })

            // Generate images for each storyboard node
            newNodes.forEach(async (n) => {
              try {
                const res = await generateImageFromText(n.data.prompt!, n.data.model!, inputImages, { aspectRatio: n.data.aspectRatio, resolution: n.data.resolution, count: 1 })
                handleNodeUpdate(n.id, { image: res[0], images: res })
                nodes.value = nodes.value.map(node => node.id === n.id ? { ...node, status: NodeStatus.SUCCESS } : node)
              } catch (e: any) {
                handleNodeUpdate(n.id, { error: e.message })
                nodes.value = nodes.value.map(node => node.id === n.id ? { ...node, status: NodeStatus.ERROR } : node)
              }
            })
            return
          }
        } catch (e) {
          console.warn("Storyboard planning failed", e)
        }
      }

      const res = await generateImageFromText(prompt, node.data.model || 'gemini-2.5-flash-image', inputImages, { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount })
      handleNodeUpdate(id, { image: res[0], images: res })

    } else if (node.type === NodeType.VIDEO_GENERATOR) {
      const strategy = await getGenerationStrategy(node, inputs, prompt)

      const res = await generateVideo(
        strategy.finalPrompt,
        node.data.model || 'veo-3.1-fast-generate-preview',
        {
          aspectRatio: node.data.aspectRatio || '16:9',
          count: node.data.videoCount || 1,
          generationMode: strategy.generationMode,
          resolution: node.data.resolution
        },
        strategy.inputImageForGeneration,
        strategy.videoInput,
        strategy.referenceImages
      )

      if (res.isFallbackImage) {
        handleNodeUpdate(id, {
          image: res.uri,
          videoUri: undefined,
          videoMetadata: undefined,
          error: "Region restricted: Generated preview image instead."
        })
      } else {
        handleNodeUpdate(id, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris })
      }

    } else if (node.type === NodeType.AUDIO_GENERATOR) {
      const audioUri = await generateAudio(prompt)
      handleNodeUpdate(id, { audioUri: audioUri })

    } else if (node.type === NodeType.VIDEO_ANALYZER) {
      const vid = node.data.videoUri || inputs.find(n => n?.data.videoUri)?.data.videoUri
      if (!vid) throw new Error("未找到视频输入")
      let vidData = vid
      if (vid.startsWith('http')) vidData = await urlToBase64(vid)
      const txt = await analyzeVideo(vidData, prompt, node.data.model || 'gemini-3-pro-preview')
      handleNodeUpdate(id, { analysis: txt })

    } else if (node.type === NodeType.IMAGE_EDITOR) {
      const inputImages: string[] = []
      inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image) })
      const img = node.data.image || inputImages[0]
      if (!img) throw new Error("未找到图片输入")
      const res = await editImageWithText(img, prompt, node.data.model || 'gemini-2.5-flash-image')
      handleNodeUpdate(id, { image: res })

    } else if (node.type === NodeType.STORY_GENERATOR) {
      handleNodeUpdate(id, { progress: '正在创作故事...' })
      const result = await generateStory(prompt, {
        genre: node.data.storyGenre
      })
      handleNodeUpdate(id, {
        story: result.story,
        storyTitle: result.title,
        progress: undefined
      })
    }

    nodes.value = nodes.value.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n)
  } catch (e: any) {
    handleNodeUpdate(id, { error: e.message })
    nodes.value = nodes.value.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n)
  }
}

const handleInputReorder = (nodeId: string, newOrder: string[]) => {
  nodes.value = nodes.value.map(n => n.id === nodeId ? { ...n, inputs: newOrder } : n)
}

// --- Group Operations ---
const handleGroupMouseDown = (e: MouseEvent, g: Group) => {
  e.stopPropagation()
  selectedGroupId.value = g.id
  const childNodes = nodes.value.filter(n => {
    const b = getNodeBounds(n)
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height
  }).map(n => ({ id: n.id, startX: n.x, startY: n.y }))
  dragGroupRef.value = { id: g.id, startX: g.x, startY: g.y, mouseStartX: e.clientX, mouseStartY: e.clientY, childNodes }
  activeGroupNodeIds.value = childNodes.map(c => c.id)
  draggingGroup.value = { id: g.id }
}

const handleGroupContextMenu = (e: MouseEvent, g: Group) => {
  e.stopPropagation()
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, id: g.id }
  contextMenuTarget.value = { type: 'group', id: g.id }
}

const saveGroupAsWorkflow = (groupId: string) => {
  const group = groups.value.find(g => g.id === groupId)
  if (!group) return
  const nodesInGroup = nodes.value.filter(n => {
    const w = n.width || 420
    const h = n.height || getApproxNodeHeight(n)
    const cx = n.x + w / 2
    const cy = n.y + h / 2
    return cx > group.x && cx < group.x + group.width && cy > group.y && cy < group.y + group.height
  })
  const nodeIds = new Set(nodesInGroup.map(n => n.id))
  const connectionsInGroup = connections.value.filter(c => nodeIds.has(c.from) && nodeIds.has(c.to))
  const thumbNode = nodesInGroup.find(n => n.data.image)
  const thumbnail = thumbNode ? thumbNode.data.image : ''
  const newWf = {
    id: `wf-${Date.now()}`,
    title: group.title || '未命名工作流',
    thumbnail: thumbnail || '',
    nodes: JSON.parse(JSON.stringify(nodesInGroup)),
    connections: JSON.parse(JSON.stringify(connectionsInGroup)),
    groups: [JSON.parse(JSON.stringify(group))]
  }
  workflows.value.unshift(newWf)
}

// --- Connection Context Menu ---
const handleConnectionContextMenu = (e: MouseEvent, from: string, to: string) => {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, id: `${from}-${to}` }
  contextMenuTarget.value = { type: 'connection', from, to }
}

const deleteConnectionFromMenu = (from: string, to: string) => {
  saveHistory()
  connections.value = connections.value.filter(c => !(c.from === from && c.to === to))
  nodes.value = nodes.value.map(n => n.id === to ? { ...n, inputs: n.inputs.filter(i => i !== from) } : n)
}

// --- File Replace ---
const handleReplaceFile = (e: Event, type: 'image' | 'video') => {
  const file = (e.target as HTMLInputElement).files?.[0]
  const targetId = replacementTargetRef.value
  if (file && targetId) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      if (type === 'image') handleNodeUpdate(targetId, { image: result })
      else handleNodeUpdate(targetId, { videoUri: result })
    }
    reader.readAsDataURL(file)
  }
  (e.target as HTMLInputElement).value = ''
  contextMenu.value = null
  replacementTargetRef.value = null
}

// --- Drag & Drop ---
const handleCanvasDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

const handleCanvasDrop = (e: DragEvent) => {
  e.preventDefault()
  const dropX = (e.clientX - pan.value.x) / scale.value
  const dropY = (e.clientY - pan.value.y) / scale.value
  const assetData = e.dataTransfer?.getData('application/json')
  const workflowId = e.dataTransfer?.getData('application/workflow-id')

  if (workflowId && workflows.value) {
    const wf = workflows.value.find(w => w.id === workflowId)
    if (wf) {
      saveHistory()
      const minX = Math.min(...wf.nodes.map(n => n.x))
      const minY = Math.min(...wf.nodes.map(n => n.y))
      const width = Math.max(...wf.nodes.map(n => n.x + (n.width || 420))) - minX
      const height = Math.max(...wf.nodes.map(n => n.y + 320)) - minY
      const offsetX = dropX - (minX + width / 2)
      const offsetY = dropY - (minY + height / 2)
      const idMap = new Map<string, string>()
      const newNodes: AppNode[] = wf.nodes.map(n => {
        const newId = `n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        idMap.set(n.id, newId)
        return { ...n, id: newId, x: n.x + offsetX, y: n.y + offsetY, status: NodeStatus.IDLE, inputs: [] as string[] }
      })
      newNodes.forEach((n, i) => {
        const original = wf.nodes[i]
        n.inputs = original.inputs.map(oldId => idMap.get(oldId)).filter(Boolean) as string[]
      })
      const newConnections = wf.connections.map(c => ({ from: idMap.get(c.from)!, to: idMap.get(c.to)! })).filter(c => c.from && c.to)
      const newGroups = (wf.groups || []).map(g => ({ ...g, id: `g-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, x: g.x + offsetX, y: g.y + offsetY }))
      nodes.value = [...nodes.value, ...newNodes]
      connections.value = [...connections.value, ...newConnections]
      groups.value = [...groups.value, ...newGroups]
    }
    return
  }

  if (assetData) {
    try {
      const asset = JSON.parse(assetData)
      if (asset && asset.type) {
        if (asset.type === 'image') addNode(NodeType.IMAGE_GENERATOR, dropX - 210, dropY - 180, { image: asset.src, prompt: asset.title })
        else if (asset.type === 'video') addNode(NodeType.VIDEO_GENERATOR, dropX - 210, dropY - 180, { videoUri: asset.src })
      }
      return
    } catch (err) { console.error("Drop failed", err) }
  }

  // Multi-File Drop (9-Grid Support)
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files) as File[]
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))

    if (validFiles.length > 0) {
      const COLS = 3
      const GAP = 40
      const BASE_WIDTH = 420
      const BASE_HEIGHT = 450

      const startX = dropX - 210
      const startY = dropY - 180

      validFiles.forEach((file, index) => {
        const col = index % COLS
        const row = Math.floor(index / COLS)

        const xPos = startX + (col * (BASE_WIDTH + GAP))
        const yPos = startY + (row * BASE_HEIGHT)

        const reader = new FileReader()
        reader.onload = (event) => {
          const res = event.target?.result as string
          if (file.type.startsWith('image/')) {
            addNode(NodeType.IMAGE_GENERATOR, xPos, yPos, { image: res, prompt: file.name })
          } else if (file.type.startsWith('video/')) {
            addNode(NodeType.VIDEO_GENERATOR, xPos, yPos, { videoUri: res, prompt: file.name })
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }
}

// --- Sidebar Handlers ---
const handleAddNode = (type: NodeType) => {
  if (type === NodeType.IMAGE_EDITOR) {
    isSketchEditorOpen.value = true
    return
  }
  addNode(type)
}

const handleHistoryItemClick = (item: AssetHistoryItem) => {
  expandedMedia.value = {
    src: item.src,
    type: item.type
  }
}

const handleAudioGenerated = (src: string, prompt: string, _duration: number) => {
  const newAsset: AssetHistoryItem = {
    id: `audio-${Date.now()}`,
    type: 'audio',
    src,
    title: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
    timestamp: Date.now()
  }
  canvas.assetHistory.value = [newAsset, ...canvas.assetHistory.value]
}

// --- Image Cropper ---
const handleCropConfirm = (croppedBase64: string) => {
  if (croppingNodeId.value) {
    handleNodeUpdate(croppingNodeId.value, { croppedFrame: croppedBase64 })
  }
  croppingNodeId.value = null
  imageToCrop.value = null
}

const handleCropCancel = () => {
  croppingNodeId.value = null
  imageToCrop.value = null
}

// --- Sketch Editor ---
const handleSketchResult = (type: 'image' | 'video', result: string, prompt: string) => {
  const centerX = (-pan.value.x + window.innerWidth / 2) / scale.value - 210
  const centerY = (-pan.value.y + window.innerHeight / 2) / scale.value - 180

  if (type === 'image') {
    addNode(NodeType.IMAGE_GENERATOR, centerX, centerY, { image: result, prompt })
  } else {
    addNode(NodeType.VIDEO_GENERATOR, centerX, centerY, { videoUri: result, prompt })
  }

  handleAssetGenerated(type, result, prompt || 'Sketch Output')
  isSketchEditorOpen.value = false
}

// --- Storyboard ---
// 保存 storyboards 数组到 IndexedDB
const saveStoryboards = async () => {
  try {
    await saveToStorage('storyboards', storyboards.value)
  } catch (e) {
    console.error('保存分镜板列表失败:', e)
  }
}

// 从 IndexedDB 加载 storyboards 数组
const loadStoryboards = async () => {
  try {
    const saved = await loadFromStorage<Storyboard[]>('storyboards')
    if (saved && Array.isArray(saved)) {
      storyboards.value = saved
      console.log('已加载分镜板列表:', storyboards.value.length, '个')
      return true
    }
  } catch (e) {
    console.error('加载分镜板列表失败:', e)
  }
  return false
}

const handleStoryboardSave = async (storyboard: Storyboard) => {
  const existingIndex = storyboards.value.findIndex(s => s.id === storyboard.id)
  if (existingIndex >= 0) {
    storyboards.value[existingIndex] = storyboard
  } else {
    storyboards.value.unshift(storyboard)
  }
  currentStoryboard.value = storyboard
  // Save to IndexedDB
  await saveStoryboards()
  
  // 同步更新关联的节点数据
  const relatedNode = nodes.value.find(n => n.data.storyboardId === storyboard.id)
  if (relatedNode) {
    handleNodeUpdate(relatedNode.id, {
      storyShots: storyboard.shots,
      storyboardId: storyboard.id
    })
  }
}

const handleStoryboardAIGenerate = async (shotId: string) => {
  // AI generation logic for a specific shot
  console.log('AI Generate for shot:', shotId)
  // This can be extended to use the Gemini API to analyze and suggest shot details
}

// Handle viewing existing storyboard from a story node
const handleViewStoryboard = async (nodeId: string) => {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node || !node.data.storyShots || node.data.storyShots.length === 0) return

  // 优先从 storyboards 数组中查找完整的分镜板数据
  let storyboard: Storyboard | null = null
  
  if (node.data.storyboardId) {
    // 根据 storyboardId 查找完整的分镜板
    storyboard = storyboards.value.find(s => s.id === node.data.storyboardId) || null
  }
  
  // 如果找不到，尝试从 IndexedDB 加载
  if (!storyboard && node.data.storyboardId) {
    try {
      const savedBoards = await loadFromStorage<Storyboard[]>('storyboards')
      if (savedBoards && Array.isArray(savedBoards)) {
        storyboard = savedBoards.find(s => s.id === node.data.storyboardId) || null
        // 如果找到了，更新 storyboards 数组
        if (storyboard) {
          storyboards.value = savedBoards // 更新整个数组以确保数据同步
          const existingIndex = storyboards.value.findIndex(s => s.id === storyboard!.id)
          if (existingIndex >= 0) {
            storyboards.value[existingIndex] = storyboard
          } else {
            storyboards.value.unshift(storyboard)
          }
        }
      }
    } catch (e) {
      console.error('加载分镜板失败:', e)
    }
  }
  
  // 如果还是找不到，尝试通过标题和分镜数量匹配（处理旧数据）
  if (!storyboard && node.data.storyTitle) {
    const matchingBoard = storyboards.value.find(s => 
      s.title === node.data.storyTitle && 
      s.shots.length === (node.data.storyShots?.length || 0)
    )
    if (matchingBoard) {
      storyboard = matchingBoard
      // 更新节点数据，建立关联
      handleNodeUpdate(nodeId, { storyboardId: matchingBoard.id })
    }
  }
  
  // 如果还是找不到，使用节点中的数据创建分镜板（但会缺少 scenes、characters 等）
  if (!storyboard) {
    storyboard = {
      id: node.data.storyboardId || `sb-node-${nodeId}`,
      title: node.data.storyTitle || '未命名分镜板',
      shots: node.data.storyShots || [],
      scenes: [],
      characters: [],
      storyProps: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }

  // 设置当前分镜板并打开面板
  currentStoryboard.value = storyboard
  isStoryboardOpen.value = true
}

// Handle generating story shots from a story node
const handleGenerateStoryShots = async (nodeId: string) => {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node || !node.data.story) return

  // Set working status
  nodes.value = nodes.value.map(n => n.id === nodeId ? { ...n, status: NodeStatus.WORKING } : n)
  handleNodeUpdate(nodeId, { progress: '正在生成分镜...' })

  try {
    const result = await generateStoryShots(node.data.story, node.data.storyTitle)

    if (result.shots.length === 0) {
      throw new Error('未能生成分镜，请重试')
    }

    // 预定义颜色
    const colorOptions = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
      '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
      '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
    ]

    // 转换场景数据
    const storyboardScenes = result.scenes.map((scene, index) => ({
      id: scene.id || `scene-${Date.now()}-${index}`,
      name: scene.name || `场景 ${index + 1}`,
      description: scene.description || '',
      color: colorOptions[index % colorOptions.length]
    }))

    // 转换人物数据
    const storyboardCharacters = result.characters.map((char, index) => ({
      id: char.id || `char-${Date.now()}-${index}`,
      name: char.name || `角色 ${index + 1}`,
      description: char.description || '',
      color: colorOptions[(index + 7) % colorOptions.length]
    }))

    // 创建场景ID映射（处理AI可能返回的不同ID格式）
    const sceneIdMap = new Map<string, string>()
    result.scenes.forEach((scene, index) => {
      const newId = storyboardScenes[index].id
      sceneIdMap.set(scene.id, newId)
    })

    // 创建人物ID映射
    const charIdMap = new Map<string, string>()
    result.characters.forEach((char, index) => {
      const newId = storyboardCharacters[index].id
      charIdMap.set(char.id, newId)
    })

    // Convert to StoryboardShot format
    const storyboardShots = result.shots.map((shot, index) => ({
      id: `shot-${Date.now()}-${index}`,
      shotNumber: shot.shotNumber || index + 1,
      duration: shot.duration || 3,
      sceneType: (shot.sceneType || '中景') as any,
      cameraMovement: shot.cameraMovement || '固定',
      description: shot.description || '',
      dialogue: shot.dialogue || '',
      notes: shot.notes || '',
      timestamp: Date.now(),
      // 关联场景和人物（使用映射后的ID）
      sceneId: shot.sceneId ? (sceneIdMap.get(shot.sceneId) || shot.sceneId) : undefined,
      characterIds: shot.characterIds?.map(id => charIdMap.get(id) || id) || []
    }))

    // Create or update storyboard and open it
    const storyboardId = `sb-${Date.now()}`
    const newStoryboard: Storyboard = {
      id: storyboardId,
      title: node.data.storyTitle || '未命名分镜板',
      shots: storyboardShots,
      scenes: storyboardScenes,
      characters: storyboardCharacters,
      storyProps: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Update node with generated shots and storyboard ID
    handleNodeUpdate(nodeId, {
      storyShots: storyboardShots,
      storyboardId: storyboardId,
      progress: undefined
    })

    // Add to storyboards list
    storyboards.value.unshift(newStoryboard)
    currentStoryboard.value = newStoryboard

    // Save to IndexedDB
    await saveStoryboards()

    // Open storyboard panel
    isStoryboardOpen.value = true

    nodes.value = nodes.value.map(n => n.id === nodeId ? { ...n, status: NodeStatus.SUCCESS } : n)
  } catch (e: any) {
    handleNodeUpdate(nodeId, { error: e.message, progress: undefined })
    nodes.value = nodes.value.map(n => n.id === nodeId ? { ...n, status: NodeStatus.ERROR } : n)
  }
}

// --- Smart Sequence ---
const handleMultiFrameGenerate = async (frames: SmartSequenceItem[]) => {
  try {
    const complexPrompt = compileMultiFramePrompt(frames as any[])

    const res = await generateVideo(
      complexPrompt,
      'veo-3.1-generate-preview',
      { aspectRatio: '16:9', count: 1 },
      frames[0].src,
      null,
      frames.length > 1 ? frames.map(f => f.src) : undefined
    )

    if (res.isFallbackImage) {
      handleAssetGenerated('image', res.uri, 'Smart Sequence Preview (Fallback)')
    } else {
      handleAssetGenerated('video', res.uri, 'Smart Sequence')
    }

    smartSequenceDockRef.value?.onGenerateComplete(res.uri)
  } catch (e: any) {
    console.error('Smart Sequence Generation Failed:', e)
    smartSequenceDockRef.value?.onGenerateFail()
  }
}

// --- Computed ---
const canvasTransform = computed(() => {
  return `translate(${pan.value.x}px, ${pan.value.y}px) scale(${scale.value})`
})

const gridStyle = computed(() => {
  const gridSize = 32 * scale.value
  return {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${pan.value.x}px ${pan.value.y}px`
  }
})

const selectionRectStyle = computed(() => {
  if (!selectionRect.value) return {}
  return {
    left: `${(Math.min(selectionRect.value.startX, selectionRect.value.currentX) - pan.value.x) / scale.value}px`,
    top: `${(Math.min(selectionRect.value.startY, selectionRect.value.currentY) - pan.value.y) / scale.value}px`,
    width: `${Math.abs(selectionRect.value.currentX - selectionRect.value.startX) / scale.value}px`,
    height: `${Math.abs(selectionRect.value.currentY - selectionRect.value.startY) / scale.value}px`
  }
})

const activeConnectionPath = computed(() => {
  if (!connectionStart.value) return ''
  let startX = 0, startY = 0
  if (connectionStart.value.id === 'smart-sequence-dock') {
    startX = (connectionStart.value.x - pan.value.x) / scale.value
    startY = (connectionStart.value.y - pan.value.y) / scale.value
  } else {
    const startNode = nodes.value.find(n => n.id === connectionStart.value!.id)
    if (!startNode) return ''
    const startHeight = startNode.height || getApproxNodeHeight(startNode)
    startX = startNode.x + (startNode.width || 420) + 3
    startY = startNode.y + startHeight / 2
  }
  const endX = mousePos.value.x
  const endY = mousePos.value.y
  return `M ${startX} ${startY} L ${endX} ${endY}`
})

// --- Story Nodes Data Logger ---
const logStoryNodes = () => {
  const storyNodes = nodes.value.filter(n => n.type === NodeType.STORY_GENERATOR)
  if (storyNodes.length > 0) {
    console.group('📖 故事节点数据')
    storyNodes.forEach((node, index) => {
      console.group(`故事节点 ${index + 1} (ID: ${node.id})`)
      console.log('节点基本信息:', {
        id: node.id,
        title: node.title,
        type: node.type,
        status: node.status,
        x: node.x,
        y: node.y
      })
      console.log('故事数据:', {
        storyTitle: node.data.storyTitle || '未命名',
        storyGenre: node.data.storyGenre || '未指定',
        story: node.data.story ? (node.data.story.length > 200 ? node.data.story.substring(0, 200) + '...' : node.data.story) : '无',
        storyLength: node.data.story?.length || 0,
        storyShotsCount: node.data.storyShots?.length || 0,
        storyShots: node.data.storyShots || [],
        progress: node.data.progress,
        error: node.data.error
      })
      if (node.data.storyShots && node.data.storyShots.length > 0) {
        console.log('分镜详情:', node.data.storyShots)
      }
      console.groupEnd()
    })
    console.groupEnd()
  } else {
    console.log('📖 当前没有故事节点')
  }
}

// Watch for story nodes changes
watch(
  () => nodes.value.filter(n => n.type === NodeType.STORY_GENERATOR),
  (storyNodes) => {
    if (storyNodes.length > 0) {
      logStoryNodes()
    }
  },
  { deep: true }
)

// --- Lifecycle ---
onMounted(async () => {
  await loadData()
  
  // 从 IndexedDB 加载 storyboards 数组
  await loadStoryboards()
  
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  
  // Print story nodes data after data is loaded
  nextTick(() => {
    setTimeout(() => {
      logStoryNodes()
    }, 500)
  })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

// Provide canvas state to child components
provide('canvas', canvas)
</script>

<template>
  <div class="w-screen h-screen bg-[#0a0a0c] overflow-hidden relative select-none">
    <!-- Noise Background -->
    <div class="absolute inset-0 noise-bg" />

    <!-- Grid Background -->
    <div
      class="absolute inset-0 pointer-events-none opacity-[0.06]"
      :style="{
        backgroundImage: 'radial-gradient(circle, #aaa 1px, transparent 1px)',
        ...gridStyle
      }"
    />

    <!-- Welcome Screen -->
    <div
      :class="[
        'absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 z-50 pointer-events-none',
        nodes.length > 0 ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      ]"
      :style="{ transitionTimingFunction: SPRING }"
    >
      <div class="flex flex-col items-center justify-center mb-10 select-none">
        <div class="relative">
          <h1 class="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-300 to-zinc-600 drop-shadow-sm px-4 pb-2">
            SUNSTUDIO
          </h1>
          <div class="absolute -inset-10 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-blue-500/20 blur-[60px] opacity-20 pointer-events-none mix-blend-screen" />
        </div>
        <div class="flex items-center gap-4 mt-4">
          <div class="h-px w-12 bg-gradient-to-r from-transparent to-zinc-600" />
          <span class="text-[11px] font-bold tracking-[0.6em] text-zinc-500 uppercase">Welcome</span>
          <div class="h-px w-12 bg-gradient-to-l from-transparent to-zinc-600" />
        </div>
      </div>

      <div class="flex items-center gap-2 mb-6 text-zinc-500 text-xs font-medium tracking-wide opacity-60">
        <div class="px-1.5 py-0.5 rounded-md bg-zinc-800/50 border border-zinc-700/50 text-[10px] flex items-center gap-1">
          <MousePointerClick :size="10" />
          <span>双击</span>
        </div>
        <span>画布自由生成，或查看工作流模板</span>
      </div>

      <div
        :class="[
          'flex items-center gap-1.5 p-1.5 rounded-[18px] bg-[#09090b]/80 border border-white/5 backdrop-blur-xl shadow-2xl',
          nodes.length > 0 ? 'pointer-events-none' : 'pointer-events-auto'
        ]"
      >
        <button
          @click="addNode(NodeType.IMAGE_GENERATOR)"
          class="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
        >
          <ImageIcon :size="16" class="text-zinc-500 transition-colors group-hover:text-cyan-400" />
          <span class="text-[13px] font-medium tracking-wide">文字生图</span>
        </button>

        <button
          @click="addNode(NodeType.VIDEO_GENERATOR)"
          class="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
        >
          <Film :size="16" class="text-zinc-500 transition-colors group-hover:text-purple-400" />
          <span class="text-[13px] font-medium tracking-wide">文生视频</span>
        </button>

        <button
          @click="addNode(NodeType.VIDEO_GENERATOR, undefined, undefined, { generationMode: 'FIRST_LAST_FRAME' })"
          class="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300"
        >
          <Link :size="16" class="text-zinc-500 transition-colors group-hover:text-emerald-400" />
          <span class="text-[13px] font-medium tracking-wide">首尾插帧</span>
        </button>
      </div>
    </div>

    <!-- Hidden File Inputs -->
    <input type="file" ref="replaceVideoInputRef" class="hidden" accept="video/*" @change="handleReplaceFile($event, 'video')" />
    <input type="file" ref="replaceImageInputRef" class="hidden" accept="image/*" @change="handleReplaceFile($event, 'image')" />

    <!-- Canvas -->
    <div
      ref="canvasRef"
      :class="['w-full h-full overflow-hidden text-slate-200', isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default']"
      @mousedown="handleCanvasMouseDown"
      @wheel="handleWheel"
      @dblclick="handleCanvasDoubleClick"
      @contextmenu.prevent="contextMenu = null"
      @dragover="handleCanvasDragOver"
      @drop="handleCanvasDrop"
    >
      <div
        :style="{ transform: canvasTransform, width: '100%', height: '100%', transformOrigin: '0 0' }"
        class="w-full h-full"
      >
        <!-- Groups Layer -->
        <div
          v-for="g in groups"
          :key="g.id"
          :class="[
            'absolute rounded-[32px] border transition-all',
            (draggingGroup?.id === g.id || draggingNodeParentGroupId === g.id) ? 'duration-0' : 'duration-300',
            selectedGroupId === g.id ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/5'
          ]"
          :style="{ left: g.x + 'px', top: g.y + 'px', width: g.width + 'px', height: g.height + 'px' }"
          @mousedown="handleGroupMouseDown($event, g)"
          @contextmenu="handleGroupContextMenu($event, g)"
        >
          <div class="absolute -top-8 left-4 text-xs font-bold text-white/40 uppercase tracking-widest">{{ g.title }}</div>
        </div>

        <!-- Connections Layer -->
        <svg class="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0" style="overflow: visible; pointer-events: none; z-index: 0">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.5" />
              <stop offset="100%" stop-color="#a855f7" stop-opacity="0.5" />
            </linearGradient>
          </defs>

          <g v-for="conn in connections" :key="`${conn.from}-${conn.to}`" class="pointer-events-auto group/line">
            <template v-if="nodes.find(n => n.id === conn.from) && nodes.find(n => n.id === conn.to)">
              <path
                :d="(() => {
                  const f = nodes.find(n => n.id === conn.from)!
                  const t = nodes.find(n => n.id === conn.to)!
                  const fHeight = f.height || getApproxNodeHeight(f)
                  const tHeight = t.height || getApproxNodeHeight(t)
                  const fx = f.x + (f.width || 420) + 3
                  let fy = f.y + fHeight / 2
                  const tx = t.x - 3
                  let ty = t.y + tHeight / 2
                  if (Math.abs(fy - ty) < 0.5) ty += 0.5
                  return `M ${fx} ${fy} C ${fx + (tx - fx) * 0.5} ${fy} ${tx - (tx - fx) * 0.5} ${ty} ${tx} ${ty}`
                })()"
                stroke="url(#gradient)"
                stroke-width="3"
                fill="none"
                stroke-opacity="0.5"
                class="transition-colors duration-300 group-hover/line:stroke-white group-hover/line:stroke-opacity-40"
              />
              <path
                :d="(() => {
                  const f = nodes.find(n => n.id === conn.from)!
                  const t = nodes.find(n => n.id === conn.to)!
                  const fHeight = f.height || getApproxNodeHeight(f)
                  const tHeight = t.height || getApproxNodeHeight(t)
                  const fx = f.x + (f.width || 420) + 3
                  let fy = f.y + fHeight / 2
                  const tx = t.x - 3
                  let ty = t.y + tHeight / 2
                  if (Math.abs(fy - ty) < 0.5) ty += 0.5
                  return `M ${fx} ${fy} C ${fx + (tx - fx) * 0.5} ${fy} ${tx - (tx - fx) * 0.5} ${ty} ${tx} ${ty}`
                })()"
                stroke="transparent"
                stroke-width="15"
                fill="none"
                style="cursor: pointer"
                @contextmenu="handleConnectionContextMenu($event, conn.from, conn.to)"
              />
            </template>
          </g>

          <!-- Active Connection Line -->
          <path
            v-if="connectionStart"
            :d="activeConnectionPath"
            stroke="rgba(255,255,255,0.6)"
            stroke-width="2"
            stroke-dasharray="4,4"
            fill="none"
          />
        </svg>

        <!-- Nodes Layer -->
        <NodeComponent
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :is-selected="selectedNodeIds.includes(node.id)"
          :is-dragging="draggingNodeId === node.id"
          :is-resizing="resizingNodeId === node.id"
          :is-connecting="!!connectionStart"
          :is-group-dragging="activeGroupNodeIds.includes(node.id)"
          :input-assets="getInputAssetsForNode(node)"
          @update="handleNodeUpdate"
          @action="handleNodeAction"
          @delete="(id) => deleteNodes([id])"
          @expand="(data) => expandedMedia = data"
          @crop="(id, img) => { croppingNodeId = id; imageToCrop = img }"
          @node-mouse-down="handleNodeMouseDown"
          @port-mouse-down="handlePortMouseDown"
          @port-mouse-up="handlePortMouseUp"
          @node-context-menu="handleNodeContextMenu"
          @resize-mouse-down="handleResizeMouseDown"
          @input-reorder="handleInputReorder"
          @generate-story-shots="handleGenerateStoryShots"
          @view-storyboard="handleViewStoryboard"
        />

        <!-- Selection Rect -->
        <div
          v-if="selectionRect"
          class="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none"
          :style="selectionRectStyle"
        />
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu?.visible"
      class="fixed z-[100] bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 min-w-[160px]"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @mousedown.stop
    >
      <!-- Node Context Menu -->
      <template v-if="contextMenuTarget?.type === 'node'">
        <button
          class="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 rounded-lg flex items-center gap-2 transition-colors"
          @click="() => { const targetNode = nodes.find(n => n.id === contextMenu!.id); if (targetNode) clipboard = JSON.parse(JSON.stringify(targetNode)); contextMenu = null }"
        >
          <Copy :size="12" /> 复制节点
        </button>
        <button
          v-if="(() => { const targetNode = nodes.find(n => n.id === contextMenu?.id); return targetNode && (targetNode.type === NodeType.VIDEO_GENERATOR || targetNode.type === NodeType.VIDEO_ANALYZER || targetNode.type === NodeType.IMAGE_GENERATOR || targetNode.type === NodeType.IMAGE_EDITOR) })()"
          class="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg flex items-center gap-2 transition-colors"
          @click="() => {
            const menuId = contextMenu?.id
            if (!menuId) return
            replacementTargetRef = menuId
            const targetNode = nodes.find(n => n.id === menuId)
            if (targetNode?.type === NodeType.VIDEO_GENERATOR || targetNode?.type === NodeType.VIDEO_ANALYZER) {
              replaceVideoInputRef?.click()
            } else {
              replaceImageInputRef?.click()
            }
            contextMenu = null
          }"
        >
          <RefreshCw :size="12" /> 替换素材
        </button>
        <button
          class="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors mt-1"
          @click="deleteNodes([contextMenuTarget.id]); contextMenu = null"
        >
          <Trash2 :size="12" /> 删除节点
        </button>
      </template>

      <!-- Create Context Menu -->
      <template v-else-if="contextMenuTarget?.type === 'create'">
        <div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">创建新节点</div>
        <button
          v-for="t in [NodeType.PROMPT_INPUT, NodeType.IMAGE_GENERATOR, NodeType.VIDEO_GENERATOR, NodeType.AUDIO_GENERATOR, NodeType.VIDEO_ANALYZER, NodeType.IMAGE_EDITOR, NodeType.STORY_GENERATOR]"
          :key="t"
          class="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 rounded-lg flex items-center gap-2.5 transition-colors"
          @click="addNode(t, (contextMenu!.x - pan.x) / scale, (contextMenu!.y - pan.y) / scale); contextMenu = null"
        >
          <component :is="getNodeIcon(t)" :size="12" :class="t === NodeType.STORY_GENERATOR ? 'text-orange-400' : 'text-cyan-400'" />
          {{ getNodeNameCN(t) }}
        </button>
      </template>

      <!-- Group Context Menu -->
      <template v-else-if="contextMenuTarget?.type === 'group'">
        <button
          class="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors mb-1"
          @click="() => { if (contextMenu?.id) saveGroupAsWorkflow(contextMenu.id); contextMenu = null }"
        >
          <FolderHeart :size="12" class="text-cyan-400" /> 保存为工作流
        </button>
        <button
          class="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors"
          @click="() => { if (contextMenu?.id) groups = groups.filter(g => g.id !== contextMenu!.id); contextMenu = null }"
        >
          <Trash2 :size="12" /> 删除分组
        </button>
      </template>

      <!-- Connection Context Menu -->
      <template v-else-if="contextMenuTarget?.type === 'connection'">
        <button
          class="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors"
          @click="deleteConnectionFromMenu(contextMenuTarget.from, contextMenuTarget.to); contextMenu = null"
        >
          <Unplug :size="12" /> 删除连接线
        </button>
      </template>
    </div>

    <!-- Sidebar Dock -->
    <SidebarDock
      :is-chat-open="isChatOpen"
      :is-multi-frame-open="isMultiFrameOpen"
      :is-sonic-studio-open="isSonicStudioOpen"
      :is-storyboard-open="isStoryboardOpen"
      :asset-history="assetHistory"
      :workflows="workflows"
      :selected-workflow-id="selectedWorkflowId"
      @add-node="handleAddNode"
      @undo="undo"
      @toggle-chat="isChatOpen = !isChatOpen"
      @toggle-multi-frame="isMultiFrameOpen = !isMultiFrameOpen"
      @toggle-sonic-studio="isSonicStudioOpen = !isSonicStudioOpen"
      @toggle-storyboard="isStoryboardOpen = !isStoryboardOpen"
      @history-item-click="handleHistoryItemClick"
      @delete-asset="deleteAsset"
      @select-workflow="(id: string | null) => id && loadWorkflow(id)"
      @save-workflow="saveCurrentAsWorkflow"
      @delete-workflow="deleteWorkflow"
      @rename-workflow="renameWorkflow"
      @open-settings="isSettingsOpen = true"
    />

    <!-- Expanded Media View -->
    <ExpandedView
      :media="expandedMedia"
      @close="expandedMedia = null"
    />

    <!-- Sonic Studio (Audio Hub) -->
    <SonicStudio
      :is-open="isSonicStudioOpen"
      :history="assetHistory.filter(a => a.type === 'audio')"
      @close="isSonicStudioOpen = false"
      @generate="handleAudioGenerated"
    />

    <!-- Smart Sequence Dock -->
    <SmartSequenceDock
      ref="smartSequenceDockRef"
      :is-open="isMultiFrameOpen"
      @close="isMultiFrameOpen = false"
      @generate="handleMultiFrameGenerate"
    />

    <!-- Image Cropper -->
    <ImageCropper
      v-if="croppingNodeId && imageToCrop"
      :image-src="imageToCrop"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />

    <!-- Sketch Editor -->
    <SketchEditor
      v-if="isSketchEditorOpen"
      @close="isSketchEditorOpen = false"
      @generate="handleSketchResult"
    />

    <!-- Settings Modal -->
    <SettingsModal
      :is-open="isSettingsOpen"
      @close="isSettingsOpen = false"
    />

    <!-- Assistant Panel (Chat) -->
    <AssistantPanel
      :is-open="isChatOpen"
      @close="isChatOpen = false"
    />

    <!-- Storyboard Panel -->
    <StoryboardPanel
      :is-open="isStoryboardOpen"
      :storyboard="currentStoryboard"
      @close="isStoryboardOpen = false"
      @save="handleStoryboardSave"
      @generate-from-a-i="handleStoryboardAIGenerate"
    />

    <!-- Zoom Controls -->
    <div class="absolute bottom-8 right-8 flex items-center gap-3 px-4 py-2 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl z-50">
      <button @click="scale = Math.max(0.2, scale - 0.1)" class="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10">
        <Minus :size="14" :stroke-width="3" />
      </button>
      <div class="flex items-center gap-2 min-w-[100px]">
        <input
          type="range"
          min="0.2"
          max="3"
          step="0.1"
          :value="scale"
          @input="scale = parseFloat(($event.target as HTMLInputElement).value)"
          class="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
        />
        <span
          class="text-[10px] font-bold text-slate-400 w-8 text-right tabular-nums cursor-pointer hover:text-white"
          @click="scale = 1"
          title="Reset Zoom"
        >
          {{ Math.round(scale * 100) }}%
        </span>
      </div>
      <button @click="scale = Math.min(3, scale + 0.1)" class="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10">
        <Plus :size="14" :stroke-width="3" />
      </button>
      <button
        @click="handleFitView"
        class="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10 ml-2 border-l border-white/10 pl-3"
        title="适配视图"
      >
        <Scan :size="14" :stroke-width="3" />
      </button>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="!isLoaded"
      class="fixed inset-0 bg-[#0a0a0c] flex items-center justify-center z-[200]"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span class="text-sm text-slate-400">加载中...</span>
      </div>
    </div>
  </div>
</template>

<style>
/* Noise Background */
.noise-bg {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
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

/* Cursor Override for Space Key */
.cursor-grab-override,
.cursor-grab-override * {
  cursor: grab !important;
}

.cursor-grab-override:active,
.cursor-grab-override:active * {
  cursor: grabbing !important;
}
</style>
