export enum NodeType {
  PROMPT_INPUT = 'PROMPT_INPUT',
  IMAGE_GENERATOR = 'IMAGE_GENERATOR',
  VIDEO_GENERATOR = 'VIDEO_GENERATOR',
  VIDEO_ANALYZER = 'VIDEO_ANALYZER',
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  AUDIO_GENERATOR = 'AUDIO_GENERATOR',
  STORY_GENERATOR = 'STORY_GENERATOR',
}

export enum NodeStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export type VideoGenerationMode = 'DEFAULT' | 'CONTINUE' | 'CUT' | 'FIRST_LAST_FRAME' | 'CHARACTER_REF'

export interface NodeData {
  prompt?: string
  model?: string
  image?: string
  images?: string[]
  imageCount?: number
  videoCount?: number
  videoUri?: string
  videoUris?: string[]
  videoMetadata?: any
  audioUri?: string
  analysis?: string
  error?: string
  progress?: string
  aspectRatio?: string
  resolution?: string
  duration?: number
  generationMode?: VideoGenerationMode
  selectedFrame?: string
  croppedFrame?: string
  sortedInputIds?: string[]
  // Story Generator specific
  story?: string
  storyTitle?: string
  storyGenre?: string
  storyShots?: StoryboardShot[]
}

export interface AppNode {
  id: string
  type: NodeType
  x: number
  y: number
  width?: number
  height?: number
  title: string
  status: NodeStatus
  data: NodeData
  inputs: string[]
}

export interface Group {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
}

export interface Connection {
  from: string
  to: string
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  id?: string
}

export interface Workflow {
  id: string
  title: string
  thumbnail: string
  nodes: AppNode[]
  connections: Connection[]
  groups: Group[]
}

export interface SmartSequenceItem {
  id: string
  src: string
  transition: {
    duration: number
    prompt: string
  }
}

export interface InputAsset {
  id: string
  type: 'image' | 'video'
  src: string
}

export interface AssetHistoryItem {
  id: string
  type: 'image' | 'video' | 'audio'
  src: string
  title: string
  timestamp: number
}

// Storyboard Types
export type SceneType = '全景' | '中景' | '近景' | '特写' | '远景' | '大特写'
export type CameraMovement = '固定' | '横摇' | '俯仰' | '横移' | '升降' | '跟随' | '推' | '拉' | '摇' | '移' | '环绕'

export interface StoryboardShot {
  id: string
  shotNumber: number
  duration: number // in seconds
  sceneType: SceneType
  cameraMovement: CameraMovement | string
  description: string
  dialogue: string
  notes: string
  sceneImage?: string // base64 or URL
  characterImage?: string // base64 or URL
  timestamp: number
}

export interface Storyboard {
  id: string
  title: string
  shots: StoryboardShot[]
  createdAt: number
  updatedAt: number
}

// Window interface for Google AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>
    openSelectKey: () => Promise<void>
  }
}


