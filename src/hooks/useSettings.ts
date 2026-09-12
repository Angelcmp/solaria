import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { appLog } from '../lib/log'

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

/** Tipo de API de un proveedor definido por el usuario. */
export type ApiType = 'openai' | 'anthropic' | 'google' | 'cohere'

/** Esquema de autenticación de un proveedor custom. */
export type AuthScheme = 'bearer' | 'x-api-key' | 'none'

/**
 * Proveedor definido por el usuario (endpoint propio o servicio
 * OpenAI-compatible: LM Studio, vLLM, llama.cpp, OpenRouter, etc.).
 */
export interface CustomProvider {
  id: string
  name: string
  baseUrl: string
  apiType: ApiType
  auth: AuthScheme
  /** Header a usar cuando `auth` no coincide con el default del esquema. */
  authHeader?: string
  models: string[]
}

export type SecurityProfile = 'explore' | 'execute'

export interface AppSettings {
  ollamaHost: string
  ollamaTimeout: number
  defaultModel: string
  defaultProvider: string
  temperature: number
  topP: number
  maxTokens: number
  language: 'es' | 'en'
  tavilyKey: string
  apiKeys: ApiKeys
  customProviders: CustomProvider[]
  customApiKeys: Record<string, string>
  securityProfile: SecurityProfile
  comparisonEnabled: boolean
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
  customProviders: [],
  customApiKeys: {},
  securityProfile: 'explore',
  comparisonEnabled: false,
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
        } catch (e) {
          const cached = localStorage.getItem(`solaria-key-${p}`)
          if (cached) loaded[p] = cached
          appLog('warn', `useSettings loadKeys ${p}: ${e}`)
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
      } catch (e) {
        // localStorage fallback is already loaded from loadSettings
        appLog('warn', `useSettings loadTavily: ${e}`)
      }
    }
    loadKeys()
    loadTavily()
  }, [])

  // Load custom provider keys from keyring (fallback localStorage)
  useEffect(() => {
    const ids = settings.customProviders.map(p => p.id)
    if (ids.length === 0) return
    let cancelled = false
    const loadCustom = async () => {
      const loaded: Record<string, string> = {}
      for (const id of ids) {
        if (settings.customApiKeys[id]) continue
        try {
          const key = await invoke<string>('get_api_key', { provider: id })
          if (key) loaded[id] = key
        } catch {
          const cached = localStorage.getItem(`solaria-key-${id}`)
          if (cached) loaded[id] = cached
        }
      }
      if (!cancelled && Object.keys(loaded).length > 0) {
        setSettings(prev => ({ ...prev, customApiKeys: { ...prev.customApiKeys, ...loaded } }))
      }
    }
    loadCustom()
    return () => { cancelled = true }
  }, [settings.customProviders])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const updateApiKey = useCallback(async (provider: keyof ApiKeys, key: string) => {
    const clean = key.trim()
    setSettings(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: clean },
    }))
    localStorage.setItem(`solaria-key-${provider}`, clean)
    try {
      await invoke('store_api_key', { provider, key: clean })
    } catch {
    }
  }, [])

  const updateTavilyKey = useCallback(async (key: string) => {
    const clean = key.trim()
    setSettings(prev => ({ ...prev, tavilyKey: clean }))
    localStorage.setItem('solaria-key-tavily', clean)
    try {
      await invoke('store_api_key', { provider: 'tavily', key: clean })
    } catch {
    }
  }, [])

  const updateProvider = useCallback((provider: string, model: string) => {
    setSettings(prev => ({
      ...prev,
      defaultProvider: provider,
      defaultModel: model,
    }))
  }, [])

  const addCustomProvider = useCallback((provider: CustomProvider) => {
    setSettings(prev => ({ ...prev, customProviders: [...prev.customProviders, provider] }))
  }, [])

  const updateCustomProvider = useCallback((provider: CustomProvider) => {
    setSettings(prev => ({
      ...prev,
      customProviders: prev.customProviders.map(p => (p.id === provider.id ? provider : p)),
    }))
  }, [])

  const removeCustomProvider = useCallback((id: string) => {
    setSettings(prev => {
      const customApiKeys = { ...prev.customApiKeys }
      delete customApiKeys[id]
      return {
        ...prev,
        customProviders: prev.customProviders.filter(p => p.id !== id),
        customApiKeys,
        defaultProvider: prev.defaultProvider === id ? 'openai' : prev.defaultProvider,
      }
    })
    localStorage.removeItem(`solaria-key-${id}`)
    invoke('delete_api_key', { provider: id }).catch(() => {})
  }, [])

  const updateCustomApiKey = useCallback(async (id: string, key: string) => {
    const clean = key.trim()
    setSettings(prev => ({
      ...prev,
      customApiKeys: { ...prev.customApiKeys, [id]: clean },
    }))
    localStorage.setItem(`solaria-key-${id}`, clean)
    try {
      await invoke('store_api_key', { provider: id, key: clean })
    } catch {
    }
  }, [])

  return {
    settings,
    showSettings,
    setShowSettings,
    updateSettings,
    updateApiKey,
    updateTavilyKey,
    updateProvider,
    addCustomProvider,
    updateCustomProvider,
    removeCustomProvider,
    updateCustomApiKey,
  }
}
