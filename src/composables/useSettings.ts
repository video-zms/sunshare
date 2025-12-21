import { ref, watch, onMounted } from 'vue'

export interface AppSettings {
  theme: 'dark' | 'light'
  apiKey: string
  polloApiKey: string
  defaultModel: string
  autoSave: boolean
}

const STORAGE_KEY = 'sunstudio_settings'

export function useSettings() {
  const settings = ref<AppSettings>({
    theme: 'dark',
    apiKey: '',
    polloApiKey: '',
    defaultModel: 'gemini-2.5-flash',
    autoSave: true
  })

  const isSettingsOpen = ref(false)

  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        settings.value = { ...settings.value, ...parsed }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  // Watch for changes and auto-save
  watch(settings, saveSettings, { deep: true })

  // Apply theme
  const applyTheme = () => {
    document.documentElement.classList.toggle('light-theme', settings.value.theme === 'light')
    document.documentElement.classList.toggle('dark-theme', settings.value.theme === 'dark')
  }

  watch(() => settings.value.theme, applyTheme)

  // Update individual setting
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    settings.value[key] = value
  }

  // Toggle theme
  const toggleTheme = () => {
    settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
  }

  // Open/Close settings modal
  const openSettings = () => {
    isSettingsOpen.value = true
  }

  const closeSettings = () => {
    isSettingsOpen.value = false
  }

  // Initialize
  onMounted(() => {
    loadSettings()
    applyTheme()
  })

  return {
    settings,
    isSettingsOpen,
    loadSettings,
    saveSettings,
    updateSetting,
    toggleTheme,
    openSettings,
    closeSettings
  }
}


