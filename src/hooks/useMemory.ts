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
  recencyWeight: number
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

export interface SearchFilters {
  sources?: string[]
  maxAgeDays?: number
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
  recencyWeight: 0.3,
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
  filters?: SearchFilters
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

export interface IndexProgress {
  total: number
  current: number
  phase: string
  file?: string
  indexed?: number
}

export function useMemory() {
  const [config, setConfig] = useState<MemoryConfig>(loadConfig)
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResults, setLastResults] = useState<SearchResult[]>([])
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null)
  const inflight = useRef<AbortController | null>(null)

  useEffect(() => {
    saveConfig(config)
  }, [config])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const u = await listen<IndexProgress>('memory://index-progress', (event) => {
          setIndexProgress(event.payload)
        })
        unlisten = u
      } catch {}
    }
    setup()
    return () => { unlisten?.() }
  }, [])

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
    async ({ query, topK, filters }: SearchParams): Promise<SearchResult[]> => {
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
          filters: filters ?? null,
          ...args,
        })
        if (ctrl.signal.aborted) return []
        const now = Date.now() / 1000
        const maxAge = 90 * 86400
        const ranked = results.map(r => {
          const age = now - r.chunk.created_at
          const recencyNorm = Math.min(age / maxAge, 1)
          const blended = r.distance * (1 - config.recencyWeight) + recencyNorm * config.recencyWeight
          return { ...r, distance: blended }
        })
        ranked.sort((a, b) => a.distance - b.distance)
        const deduped: SearchResult[] = []
        const seen = new Set<string>()
        for (const r of ranked) {
          if (r.distance > 1 - config.minScore) continue
          const key = `${r.chunk.source}:${r.chunk.source_id}`
          if (seen.has(key)) continue
          seen.add(key)
          deduped.push(r)
        }
        setLastResults(deduped)
        return deduped
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
    const conversations = results.filter(r => r.chunk.source === 'conversation')
    const files = results.filter(r => r.chunk.source === 'file')
    const parts: string[] = []
    if (conversations.length > 0) {
      parts.push('## Conversaciones previas relevantes')
      conversations.forEach((r, i) => {
        const score = (1 - r.distance).toFixed(2)
        const meta = r.chunk.metadata ? JSON.parse(r.chunk.metadata) : {}
        const date = new Date(r.chunk.created_at * 1000).toLocaleDateString()
        parts.push(`### ${i + 1}. ${meta.title || 'Conversación'} (${date}, relevancia: ${score})`)
        parts.push(r.chunk.text)
      })
    }
    if (files.length > 0) {
      parts.push('## Archivos del proyecto relevantes')
      files.forEach((r, i) => {
        const score = (1 - r.distance).toFixed(2)
        parts.push(`### ${i + 1}. \`${r.chunk.source_id}\` (relevancia: ${score})`)
        parts.push(r.chunk.text)
      })
    }
    return parts.join('\n\n')
  }, [])

  return {
    config,
    updateConfig,
    stats,
    loading,
    error,
    lastResults,
    indexProgress,
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
