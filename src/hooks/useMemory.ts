import { useState, useCallback, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

export type MemoryProvider = 'ollama' | 'openai' | 'custom'

export interface MemoryConfig {
  enabled: boolean
  provider: MemoryProvider
  model: string
  ollamaHost: string
  apiKey: string
  apiUrl: string
  topK: number
  minScore: number
  autoInject: boolean
  indexConversations: boolean
  indexProjectFiles: boolean
}

export interface MemoryChunk {
  id: number
  source: string
  source_id: string
  text: string
  metadata: string | null
  created_at: number
}

export interface SearchResult {
  chunk: MemoryChunk
  distance: number
}

export interface MemoryStats {
  total_chunks: number
  total_conversations: number
  total_project_files: number
  db_path: string
  dim: number
}

const STORAGE_KEY = 'solaria-memory-config'

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  provider: 'ollama',
  model: 'nomic-embed-text',
  ollamaHost: 'http://localhost:11434',
  apiKey: '',
  apiUrl: '',
  topK: 5,
  minScore: 0.7,
  autoInject: true,
  indexConversations: true,
  indexProjectFiles: true,
}

function loadConfig(): MemoryConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_MEMORY_CONFIG, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_MEMORY_CONFIG
}

function saveConfig(config: MemoryConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

interface SearchParams {
  query: string
  topK?: number
}

function buildEmbeddingArgs(config: MemoryConfig) {
  return {
    provider: config.provider,
    model: config.model,
    ollamaHost: config.provider === 'ollama' ? config.ollamaHost : null,
    apiKey: config.provider === 'ollama' ? null : config.apiKey,
    apiUrl: config.provider === 'custom' ? config.apiUrl : null,
  }
}

export function useMemory() {
  const [config, setConfig] = useState<MemoryConfig>(loadConfig)
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResults, setLastResults] = useState<SearchResult[]>([])
  const inflight = useRef<AbortController | null>(null)

  useEffect(() => {
    saveConfig(config)
  }, [config])

  const refreshStats = useCallback(async () => {
    try {
      const s = await invoke<MemoryStats>('memory_stats')
      setStats(s)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  const updateConfig = useCallback((updates: Partial<MemoryConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const search = useCallback(
    async ({ query, topK }: SearchParams): Promise<SearchResult[]> => {
      if (!config.enabled || !query.trim()) return []
      if (inflight.current) inflight.current.abort()
      const ctrl = new AbortController()
      inflight.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const args = buildEmbeddingArgs(config)
        const results = await invoke<SearchResult[]>('memory_search', {
          query,
          topK: topK ?? config.topK,
          ...args,
        })
        if (ctrl.signal.aborted) return []
        const filtered = results.filter(r => r.distance <= 1 - config.minScore)
        setLastResults(filtered)
        return filtered
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(String(e))
        }
        return []
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    },
    [config]
  )

  const indexText = useCallback(
    async (
      source: string,
      sourceId: string,
      text: string,
      metadata?: string
    ): Promise<number | null> => {
      if (!config.enabled || !text.trim()) return null
      const args = buildEmbeddingArgs(config)
      try {
        const id = await invoke<number>('memory_index_text', {
          source,
          sourceId,
          text,
          metadata: metadata ?? null,
          ...args,
        })
        await refreshStats()
        return id
      } catch (e) {
        setError(String(e))
        return null
      }
    },
    [config, refreshStats]
  )

  const indexFile = useCallback(
    async (path: string, text: string) => {
      return indexText('file', path, text, JSON.stringify({ path }))
    },
    [indexText]
  )

  const indexConversation = useCallback(
    async (convId: string, title: string, messages: { role: string; content: string }[]) => {
      const text = messages
        .map(m => `[${m.role}] ${m.content}`)
        .join('\n\n')
      if (!text.trim()) return null
      return indexText('conversation', convId, text, JSON.stringify({ title }))
    },
    [indexText]
  )

  const clearMemory = useCallback(async () => {
    try {
      await invoke('memory_clear')
      setLastResults([])
      await refreshStats()
    } catch (e) {
      setError(String(e))
    }
  }, [refreshStats])

  const indexProject = useCallback(
    async (workingDir: string, extensions?: string[]): Promise<number> => {
      if (!config.enabled || !workingDir) return 0
      const args = buildEmbeddingArgs(config)
      try {
        const count = await invoke<number>('memory_index_project_files', {
          workingDir,
          extensions: extensions ?? null,
          ...args,
        })
        await refreshStats()
        return count
      } catch (e) {
        setError(String(e))
        return 0
      }
    },
    [config, refreshStats]
  )

  const deleteSource = useCallback(
    async (source: string, sourceId: string) => {
      try {
        await invoke('memory_delete_source', { source, sourceId })
        await refreshStats()
      } catch (e) {
        setError(String(e))
      }
    },
    [refreshStats]
  )

  const formatContext = useCallback((results: SearchResult[]): string => {
    if (results.length === 0) return ''
    const lines = results.map((r, i) => {
      const source = r.chunk.source === 'conversation' ? 'conversación previa' : `archivo: ${r.chunk.source_id}`
      const score = (1 - r.distance).toFixed(2)
      return `${i + 1}. [${source}, relevancia ${score}]\n${r.chunk.text}`
    })
    return lines.join('\n\n')
  }, [])

  return {
    config,
    updateConfig,
    stats,
    loading,
    error,
    lastResults,
    search,
    indexText,
    indexFile,
    indexConversation,
    indexProject,
    clearMemory,
    deleteSource,
    refreshStats,
    formatContext,
  }
}
