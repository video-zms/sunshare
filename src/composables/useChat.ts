import { ref, computed } from 'vue'
import { sendChatMessage } from '../services/geminiService'

export interface ChatMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Chat Mode Options
  const isThinkingMode = ref(false)
  const isStoryboardMode = ref(false)
  const isHelpMeWriteMode = ref(false)

  const send = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading.value) return

    // Add user message
    messages.value.push({
      role: 'user',
      parts: [{ text: userMessage }]
    })

    isLoading.value = true
    error.value = null

    try {
      const response = await sendChatMessage(
        messages.value.slice(0, -1), // History without current message
        userMessage,
        {
          isThinkingMode: isThinkingMode.value,
          isStoryboard: isStoryboardMode.value,
          isHelpMeWrite: isHelpMeWriteMode.value
        }
      )

      // Add model response
      messages.value.push({
        role: 'model',
        parts: [{ text: response }]
      })
    } catch (e: any) {
      error.value = e.message || 'Failed to send message'
      // Remove the user message if failed
      messages.value.pop()
    } finally {
      isLoading.value = false
    }
  }

  const clearChat = () => {
    messages.value = []
    error.value = null
  }

  const toggleThinkingMode = () => {
    isThinkingMode.value = !isThinkingMode.value
  }

  const toggleStoryboardMode = () => {
    isStoryboardMode.value = !isStoryboardMode.value
    if (isStoryboardMode.value) {
      isHelpMeWriteMode.value = false
    }
  }

  const toggleHelpMeWriteMode = () => {
    isHelpMeWriteMode.value = !isHelpMeWriteMode.value
    if (isHelpMeWriteMode.value) {
      isStoryboardMode.value = false
    }
  }

  return {
    messages,
    isLoading,
    error,
    isThinkingMode,
    isStoryboardMode,
    isHelpMeWriteMode,
    send,
    clearChat,
    toggleThinkingMode,
    toggleStoryboardMode,
    toggleHelpMeWriteMode
  }
}


