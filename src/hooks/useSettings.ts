import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface ApiKeys {
  openai: string
  anthropic: string
  deepseek: string
  groq: string
  google: string
  cohere: string
  kimi: string
  glm: string
}

export type SecurityProfile = 'explore' | 'execute'

export interface AppSettings {
  ollamaHost: string
  ollamaTimeout: number
  defaultModel: string
  defaultProvider: 'ollama' | 'openai' | 'anthropic' | 'deepseek' | 'groq' | 'google' | 'cohere' | 'kimi' | 'glm'
  temperature: number
  topP: number
  maxTokens: number
  language: 'es' | 'en'
  tavilyKey: string
  apiKeys: ApiKeys
  securityProfile: SecurityProfile
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaHost: 'http://localhost:11434',
  ollamaTimeout: 120,
  defaultModel: 'gpt-4o-mini',
  defaultProvider: 'openai',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  language: 'es',
  tavilyKey: '',
  apiKeys: {
    openai: '',
    anthropic: '',
    deepseek: '',
    groq: '',
    google: '',
    cohere: '',
    kimi: '',
    glm: '',
  },
  securityProfile: 'explore',
}

const STORAGE_KEY = 'solaria-settings'
const API_PROVIDERS: (keyof ApiKeys)[] = ['openai', 'anthropic', 'deepseek', 'groq', 'google', 'cohere', 'kimi', 'glm']

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState<string | false>(false)

  // Load API keys from OS keyring on mount (fallback to localStorage)
  useEffect(() => {
    const loadKeys = async () => {
      const loaded: Partial<ApiKeys> = {}
      for (const p of API_PROVIDERS) {
        try {
          const key = await invoke<string>('get_api_key', { provider: p })
          if (key) loaded[p] = key
        } catch {
          const cached = localStorage.getItem(`solaria-key-${p}`)
          if (cached) loaded[p] = cached
        }
      }
      if (Object.keys(loaded).length > 0) {
        setSettings(prev => ({
          ...prev,
          apiKeys: { ...prev.apiKeys, ...loaded },
        }))
      }
    }
    // Also try tavily from keyring
    const loadTavily = async () => {
      try {
        const key = await invoke<string>('get_api_key', { provider: 'tavily' })
        if (key) setSettings(prev => ({ ...prev, tavilyKey: key }))
      } catch {
        // localStorage fallback is already loaded from loadSettings
      }
    }
    loadKeys()
    loadTavily()
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const updateApiKey = useCallback(async (provider: keyof ApiKeys, key: string) => {
    setSettings(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: key },
    }))
    // Persist to OS keyring + localStorage fallback
    localStorage.setItem(`solaria-key-${provider}`, key)
    try {
      await invoke('store_api_key', { provider, key })
    } catch {
      // Keyring unavailable — localStorage fallback is already set
    }
  }, [])

  const updateTavilyKey = useCallback(async (key: string) => {
    setSettings(prev => ({ ...prev, tavilyKey: key }))
    localStorage.setItem('solaria-key-tavily', key)
    try {
      await invoke('store_api_key', { provider: 'tavily', key })
    } catch {
      // Keyring unavailable — localStorage fallback
    }
  }, [])

  const updateProvider = useCallback((provider: AppSettings['defaultProvider'], model: string) => {
    setSettings(prev => ({
      ...prev,
      defaultProvider: provider,
      defaultModel: model,
    }))
  }, [])

  return {
    settings,
    showSettings,
    setShowSettings,
    updateSettings,
    updateApiKey,
    updateTavilyKey,
    updateProvider,
  }
}
