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
  storyboardId?: string // 关联的分镜板ID
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

// 场景定义
export interface StoryScene {
  id: string
  name: string
  description: string
  image?: string // base64 or URL
  color?: string // 用于 UI 显示的颜色标识
}

// 人物定义
export interface StoryCharacter {
  id: string
  name: string
  description: string
  image?: string // base64 or URL (人物头像/参考图)
  color?: string // 用于 UI 显示的颜色标识
  type?: 'sora' | 'custom' // 角色类型：sora 角色或自定义图片角色
  soraCharacterId?: string // Sora API 创建的角色 ID（仅当 type === 'sora' 时使用）
}

// 道具定义
export interface StoryProp {
  id: string
  name: string
  description: string
  image?: string // base64 or URL (道具参考图)
  color?: string // 用于 UI 显示的颜色标识
}

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
  videoUrl?: string // 生成的视频 URL
  videoTaskId?: string // 视频生成任务 ID
  videoGeneratingStatus?: 'queued' | 'processing' | 'completed' | 'failed' // 视频生成状态
  videoGeneratingProgress?: number // 视频生成进度 0-100
  timestamp: number
  // 关联的场景、人物和道具
  sceneId?: string // 关联的场景 ID
  characterIds?: string[] // 关联的人物 ID 列表
  propIds?: string[] // 关联的道具 ID 列表
}

export interface Storyboard {
  id: string
  title: string
  shots: StoryboardShot[]
  scenes: StoryScene[] // 场景列表
  characters: StoryCharacter[] // 人物列表
  storyProps?: StoryProp[] // 道具列表
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

// --- LLM Provider Types ---

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'custom'

export interface LLMProviderConfig {
  provider: LLMProvider
  apiKey: string
  baseUrl?: string
  model?: string
}

// 图片生成配置（可以使用独立的 API Key）
export interface ImageGenConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  enabled: boolean  // 是否启用独立的图片生成配置
}

// 视频生成配置（可以使用独立的 API Key）
export interface VideoGenConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  enabled: boolean  // 是否启用独立的视频生成配置
}

// Sora 视频生成配置（专门用于 multipart/form-data 格式的 API，如 Sora-2）
export interface SoraVideoGenConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  enabled: boolean  // 是否启用独立的 Sora 视频生成配置
}

export interface LLMProviderInfo {
  id: LLMProvider
  name: string
  description: string
  models: LLMModelInfo[]
  supportsVision?: boolean
  supportsAudio?: boolean
  supportsVideo?: boolean
}

export interface LLMModelInfo {
  id: string
  name: string
  description?: string
  contextWindow?: number
  supportsVision?: boolean
  supportsAudio?: boolean
}

// 画风类型定义
export interface ArtStyle {
  id: string
  name: string
  description: string
  promptSuffix: string  // 添加到提示词末尾的风格描述
  previewColor: string  // 用于 UI 预览的颜色
}

// 预定义画风
export const ART_STYLES: ArtStyle[] = [
  {
    id: 'realistic',
    name: '写实风格',
    description: '高清写实照片风格',
    promptSuffix: ', photorealistic, highly detailed, 8K UHD, professional photography, natural lighting',
    previewColor: '#3b82f6'
  },
  {
    id: 'anime',
    name: '日系动漫',
    description: '日本动漫风格插画',
    promptSuffix: ', anime style, Japanese animation, vibrant colors, cel shading, studio ghibli inspired',
    previewColor: '#ec4899'
  },
  {
    id: 'cartoon',
    name: '卡通风格',
    description: '可爱卡通插画风格',
    promptSuffix: ', cartoon style, colorful, playful, cute illustration, bold outlines',
    previewColor: '#f59e0b'
  },
  {
    id: 'oil-painting',
    name: '油画风格',
    description: '经典油画艺术风格',
    promptSuffix: ', oil painting style, classical art, rich textures, brushstrokes visible, masterpiece',
    previewColor: '#8b5cf6'
  },
  {
    id: 'watercolor',
    name: '水彩风格',
    description: '柔和水彩画风格',
    promptSuffix: ', watercolor painting, soft edges, flowing colors, artistic, delicate brushwork',
    previewColor: '#06b6d4'
  },
  {
    id: 'pixel-art',
    name: '像素风格',
    description: '复古像素游戏风格',
    promptSuffix: ', pixel art style, 16-bit, retro game aesthetic, crisp pixels, nostalgic',
    previewColor: '#22c55e'
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    description: '未来科幻霓虹风格',
    promptSuffix: ', cyberpunk style, neon lights, futuristic, dark atmosphere, high tech low life',
    previewColor: '#a855f7'
  },
  {
    id: 'ink-wash',
    name: '水墨风格',
    description: '中国传统水墨画风格',
    promptSuffix: ', Chinese ink wash painting, traditional art, elegant, minimalist, brush strokes',
    previewColor: '#64748b'
  },
  {
    id: '3d-render',
    name: '3D渲染',
    description: '高质量3D渲染风格',
    promptSuffix: ', 3D render, Octane render, high quality CGI, detailed textures, studio lighting',
    previewColor: '#ef4444'
  },
  {
    id: 'comic',
    name: '漫画风格',
    description: '美式漫画风格',
    promptSuffix: ', comic book style, bold lines, dynamic composition, halftone dots, superhero aesthetic',
    previewColor: '#f97316'
  }
]

// 预定义的模型提供商信息
export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google 的多模态 AI 模型',
    supportsVision: true,
    supportsAudio: true,
    supportsVideo: true,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', supportsVision: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', supportsVision: true },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', supportsVision: true },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI GPT 系列模型',
    supportsVision: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsVision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', supportsVision: true },
      { id: 'o1', name: 'o1', supportsVision: false },
      { id: 'o1-mini', name: 'o1 Mini', supportsVision: false },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Anthropic Claude 系列模型',
    supportsVision: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', supportsVision: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', supportsVision: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', supportsVision: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', supportsVision: true },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek AI 模型',
    supportsVision: false,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', supportsVision: false },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', supportsVision: false },
    ]
  },
  {
    id: 'custom',
    name: '自定义 OpenAI 兼容',
    description: '任何 OpenAI 兼容的 API',
    supportsVision: true,
    models: []
  }
]


