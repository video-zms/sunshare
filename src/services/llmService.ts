/**
 * LLM Service - 基于 LangChain OpenAI SDK 的聊天服务
 * 统一使用 OpenAI 兼容的 API 格式，支持各种代理服务
 */

import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, AIMessage, type BaseMessage } from "@langchain/core/messages"
import type { LLMProviderConfig, ImageGenConfig, VideoGenConfig, SoraVideoGenConfig } from "../types"

// --- 配置管理 ---

// 获取环境变量中的默认配置
const getEnvConfig = (): LLMProviderConfig => ({
  provider: 'custom',
  apiKey: import.meta.env.VITE_API_KEY || '',
  baseUrl: import.meta.env.VITE_API_BASE_URL || undefined,
  model: 'gemini-2.5-flash'
})

// 从环境变量和 localStorage 获取配置
const getStoredConfig = (): LLMProviderConfig => {
  const envConfig = getEnvConfig()
  
  try {
    const stored = localStorage.getItem('llm_config')
    if (stored) {
      const parsedConfig = JSON.parse(stored) as LLMProviderConfig
      // 如果 localStorage 中的 apiKey 为空，使用环境变量的值
      return {
        ...parsedConfig,
        apiKey: parsedConfig.apiKey || envConfig.apiKey,
        baseUrl: parsedConfig.baseUrl || envConfig.baseUrl
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored LLM config:', e)
  }
  
  // 默认使用环境变量中的配置
  return envConfig
}

// 保存配置到 localStorage
export const saveConfig = (config: LLMProviderConfig): void => {
  localStorage.setItem('llm_config', JSON.stringify(config))
}

// 获取当前配置
export const getConfig = (): LLMProviderConfig => {
  return getStoredConfig()
}

// --- 模型工厂 ---

/**
 * 创建 ChatOpenAI 实例
 * 统一使用 OpenAI 兼容的 API 格式
 */
const createChatModel = (config: LLMProviderConfig): ChatOpenAI => {
  const { apiKey, baseUrl, model } = config
  
  if (!apiKey) {
    console.error('LLM Config:', { hasApiKey: !!apiKey, baseUrl, model })
    throw new Error('API Key is missing. Please configure it in Settings.')
  }
  
  // 确保 baseUrl 以 /v1 结尾（OpenAI 兼容 API 标准格式）
  let normalizedBaseUrl = baseUrl
  if (baseUrl && !baseUrl.endsWith('/v1') && !baseUrl.endsWith('/v1/')) {
    normalizedBaseUrl = baseUrl.replace(/\/$/, '') + '/v1'
  }
  
  console.log('Creating ChatOpenAI with config:', { 
    hasApiKey: !!apiKey, 
    apiKeyPrefix: apiKey.substring(0, 8) + '...', 
    baseUrl: normalizedBaseUrl, 
    model 
  })
  
  return new ChatOpenAI({
    apiKey: apiKey,
    model: model || 'gemini-2.5-flash',
    configuration: normalizedBaseUrl ? { baseURL: normalizedBaseUrl } : undefined
  })
}

// 获取当前模型实例（带缓存）
let cachedModel: ChatOpenAI | null = null
let cachedConfigHash: string = ''

const getConfigHash = (config: LLMProviderConfig): string => {
  return JSON.stringify(config)
}

const getChatModel = (): ChatOpenAI => {
  const config = getStoredConfig()
  const configHash = getConfigHash(config)
  
  if (cachedModel && cachedConfigHash === configHash) {
    return cachedModel
  }
  
  cachedModel = createChatModel(config)
  cachedConfigHash = configHash
  return cachedModel
}

// 清除缓存（当配置变更时调用）
export const clearModelCache = (): void => {
  cachedModel = null
  cachedConfigHash = ''
}

// --- 图片生成配置管理 ---

const IMAGE_GEN_CONFIG_KEY = 'image_gen_config'

// 获取图片生成配置
export const getImageGenConfig = (): ImageGenConfig => {
  try {
    const stored = localStorage.getItem(IMAGE_GEN_CONFIG_KEY)
    if (stored) {
      return JSON.parse(stored) as ImageGenConfig
    }
  } catch (e) {
    console.warn('Failed to parse stored image gen config:', e)
  }
  
  // 默认配置：未启用独立配置
  return {
    apiKey: '',
    baseUrl: undefined,
    model: 'gemini-2.5-flash-image',
    enabled: false
  }
}

// 保存图片生成配置
export const saveImageGenConfig = (config: ImageGenConfig): void => {
  localStorage.setItem(IMAGE_GEN_CONFIG_KEY, JSON.stringify(config))
}

// 获取图片生成使用的 API Key（优先使用独立配置，否则使用默认配置）
export const getImageGenApiKey = (): { apiKey: string, baseUrl?: string } => {
  const imageGenConfig = getImageGenConfig()
  
  // 如果启用了独立配置且有 API Key，使用独立配置
  if (imageGenConfig.enabled && imageGenConfig.apiKey) {
    return {
      apiKey: imageGenConfig.apiKey,
      baseUrl: imageGenConfig.baseUrl
    }
  }
  
  // 否则使用环境变量中的默认配置
  const envConfig = getEnvConfig()
  return {
    apiKey: envConfig.apiKey,
    baseUrl: envConfig.baseUrl
  }
}

// --- 视频生成配置管理 ---

const VIDEO_GEN_CONFIG_KEY = 'video_gen_config'

// 获取视频生成配置
export const getVideoGenConfig = (): VideoGenConfig => {
  try {
    const stored = localStorage.getItem(VIDEO_GEN_CONFIG_KEY)
    if (stored) {
      return JSON.parse(stored) as VideoGenConfig
    }
  } catch (e) {
    console.warn('Failed to parse stored video gen config:', e)
  }
  
  // 默认配置：未启用独立配置
  return {
    apiKey: '',
    baseUrl: undefined,
    model: 'veo-3.1-fast-generate-preview',
    enabled: false
  }
}

// 保存视频生成配置
export const saveVideoGenConfig = (config: VideoGenConfig): void => {
  localStorage.setItem(VIDEO_GEN_CONFIG_KEY, JSON.stringify(config))
}

// 获取视频生成使用的 API Key（优先使用独立配置，否则使用默认配置）
export const getVideoGenApiKey = (): { apiKey: string, baseUrl?: string } => {
  const videoGenConfig = getVideoGenConfig()
  
  // 如果启用了独立配置且有 API Key，使用独立配置
  if (videoGenConfig.enabled && videoGenConfig.apiKey) {
    return {
      apiKey: videoGenConfig.apiKey,
      baseUrl: videoGenConfig.baseUrl
    }
  }
  
  // 否则使用环境变量中的默认配置
  const envConfig = getEnvConfig()
  return {
    apiKey: envConfig.apiKey,
    baseUrl: envConfig.baseUrl
  }
}

// --- Sora 视频生成配置管理 ---

const SORA_VIDEO_GEN_CONFIG_KEY = 'sora_video_gen_config'

// 获取 Sora 视频生成配置
export const getSoraVideoGenConfig = (): SoraVideoGenConfig => {
  try {
    const stored = localStorage.getItem(SORA_VIDEO_GEN_CONFIG_KEY)
    if (stored) {
      return JSON.parse(stored) as SoraVideoGenConfig
    }
  } catch (e) {
    console.warn('Failed to parse stored Sora video gen config:', e)
  }
  
  // 默认配置：未启用独立配置
  return {
    apiKey: '',
    baseUrl: undefined,
    model: 'sora-2',
    enabled: false
  }
}

// 保存 Sora 视频生成配置
export const saveSoraVideoGenConfig = (config: SoraVideoGenConfig): void => {
  localStorage.setItem(SORA_VIDEO_GEN_CONFIG_KEY, JSON.stringify(config))
}

// 获取 Sora 视频生成使用的 API Key（优先使用独立配置，否则使用默认配置）
export const getSoraVideoGenApiKey = (): { apiKey: string, baseUrl?: string } => {
  const soraVideoGenConfig = getSoraVideoGenConfig()
  
  // 如果启用了独立配置且有 API Key，使用独立配置
  if (soraVideoGenConfig.enabled && soraVideoGenConfig.apiKey) {
    return {
      apiKey: soraVideoGenConfig.apiKey,
      baseUrl: soraVideoGenConfig.baseUrl
    }
  }
  
  // 否则使用环境变量中的默认配置
  const envConfig = getEnvConfig()
  return {
    apiKey: envConfig.apiKey,
    baseUrl: envConfig.baseUrl
  }
}

// --- 消息转换 ---

interface ChatHistoryItem {
  role: 'user' | 'model' | 'assistant'
  parts: { text: string }[]
}

const convertHistoryToMessages = (history: ChatHistoryItem[]): BaseMessage[] => {
  return history.map(item => {
    const text = item.parts.map(p => p.text).join('\n')
    if (item.role === 'user') {
      return new HumanMessage(text)
    } else {
      return new AIMessage(text)
    }
  })
}

// --- 公共 API ---

/**
 * 发送聊天消息
 */
export const sendChatMessage = async (
  history: ChatHistoryItem[],
  newMessage: string,
  options?: {
    systemPrompt?: string
    isThinkingMode?: boolean
  }
): Promise<string> => {
  const model = getChatModel()
  
  const messages: BaseMessage[] = []
  
  // 添加系统提示
  if (options?.systemPrompt) {
    messages.push(new SystemMessage(options.systemPrompt))
  }
  
  // 添加历史消息
  messages.push(...convertHistoryToMessages(history))
  
  // 添加新消息
  messages.push(new HumanMessage(newMessage))
  
  try {
    const response = await model.invoke(messages)
    return typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
  } catch (error: any) {
    console.error('LLM Chat Error:', error)
    // 打印更详细的错误信息
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    throw new Error(getErrorMessage(error))
  }
}

/**
 * 发送带有 JSON 输出的请求
 */
export const sendJsonRequest = async (
  prompt: string,
  systemPrompt?: string
): Promise<any> => {
  const model = getChatModel()
  
  const messages: BaseMessage[] = []
  
  if (systemPrompt) {
    messages.push(new SystemMessage(systemPrompt + '\n\n输出严格的 JSON 格式，不要包含任何 markdown 标记。'))
  }
  
  messages.push(new HumanMessage(prompt))
  
  try {
    const response = await model.invoke(messages)
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
    
    // 尝试解析 JSON
    // 移除可能的 markdown 代码块标记
    const cleanContent = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    
    return JSON.parse(cleanContent)
  } catch (error: any) {
    console.error('LLM JSON Request Error:', error)
    // 打印更详细的错误信息
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    throw new Error(getErrorMessage(error))
  }
}

/**
 * 流式聊天（返回 AsyncGenerator）
 */
export async function* streamChatMessage(
  history: ChatHistoryItem[],
  newMessage: string,
  options?: {
    systemPrompt?: string
  }
): AsyncGenerator<string, void, unknown> {
  const model = getChatModel()
  
  const messages: BaseMessage[] = []
  
  if (options?.systemPrompt) {
    messages.push(new SystemMessage(options.systemPrompt))
  }
  
  messages.push(...convertHistoryToMessages(history))
  messages.push(new HumanMessage(newMessage))
  
  try {
    const stream = await model.stream(messages)
    
    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' 
        ? chunk.content 
        : ''
      if (content) {
        yield content
      }
    }
  } catch (error: any) {
    console.error('LLM Stream Error:', error)
    throw new Error(getErrorMessage(error))
  }
}

/**
 * 获取当前提供商信息
 */
export const getCurrentProvider = (): string => {
  return getStoredConfig().provider
}

/**
 * 获取当前模型名称
 */
export const getCurrentModel = (): string => {
  return getStoredConfig().model || 'unknown'
}

// --- 错误处理 ---

const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error"
  if (typeof error === 'string') return error
  if (error.message) return error.message
  if (error.error && error.error.message) return error.error.message
  return JSON.stringify(error)
}
