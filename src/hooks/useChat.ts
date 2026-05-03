import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  pinned: boolean
  type: 'chat' | 'agent'
  toolSummary?: Record<string, number>
}

export interface ProviderConfig {
  type: 'ollama' | 'openai' | 'anthropic' | 'deepseek' | 'groq' | 'google' | 'cohere' | 'kimi' | 'glm'
  model: string
  apiKey?: string
  systemPrompt?: string
}

const STORAGE_KEY = 'solaria-conversations'

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs))
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const activeConv = conversations.find(c => c.id === activeConvId) || null
  const messages = activeConv?.messages || []

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  const updateConv = useCallback((convId: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, ...updates, updatedAt: Date.now() } : c
    ))
  }, [])

  const newConversation = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: 'Nueva conversación',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      type: 'chat',
    }
    setConversations(prev => [conv, ...prev])
    setActiveConvId(conv.id)
  }, [])

  const deleteConversation = useCallback((convId: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convId)
      if (activeConvId === convId) {
        const next = updated[0] || null
        setActiveConvId(next?.id || null)
      }
      return updated
    })
  }, [activeConvId])

  const togglePin = useCallback((convId: string) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, pinned: !c.pinned } : c
    ))
  }, [])

  const renameConversation = useCallback((convId: string, title: string) => {
    updateConv(convId, { title })
  }, [updateConv])

  const selectConversation = useCallback((convId: string) => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setActiveConvId(convId)
  }, [])

  const sendMessage = useCallback(async (content: string, provider: ProviderConfig) => {
    let convId = activeConvId
    let existingMessages = messages

    if (!convId) {
      convId = crypto.randomUUID()
      existingMessages = []
      const newConv: Conversation = {
        id: convId,
        title: content.slice(0, 60).trim() + (content.length > 60 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
        type: 'chat',
      }
      setConversations(prev => [newConv, ...prev])
      setActiveConvId(convId)
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    const assistantId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    const isFirstMessage = existingMessages.length === 0
    const newMessages = [...existingMessages, userMessage, assistantMessage]

    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c
      return {
        ...c,
        messages: newMessages,
        title: isFirstMessage
          ? content.slice(0, 60).trim() + (content.length > 60 ? '...' : '')
          : c.title,
        updatedAt: Date.now(),
      }
    }))

    setIsStreaming(true)

    try {
      abortControllerRef.current = new AbortController()

      const historyMessages = existingMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      let reply = ''

      if (provider.type === 'ollama') {
        const result = await invoke<{ success: boolean; content: string; error: string | null }>('ollama_chat', {
          model: provider.model,
          messages: JSON.stringify(historyMessages),
          systemPrompt: provider.systemPrompt || null,
        })
        if (!result.success) throw new Error(result.error || 'Error')
        reply = result.content
      } else {
        const result = await invoke<{ success: boolean; content: string; error: string | null }>('provider_chat', {
          provider: provider.type,
          model: provider.model,
          apiKey: provider.apiKey || '',
          messages: JSON.stringify(historyMessages),
          systemPrompt: provider.systemPrompt || null,
        })
        if (!result.success) throw new Error(result.error || 'Error')
        reply = result.content
      }

      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId ? { ...m, content: reply } : m
          ),
        }
      }))
    } catch (error: any) {
      if (error.name === 'AbortError') return
      const errorMsg = error?.message || error?.toString() || 'No se pudo conectar con Ollama'
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Error: ' + errorMsg }
              : m
          ),
        }
      }))
    } finally {
      setIsStreaming(false)
    }
  }, [activeConvId, messages])

  const startAgentPrompt = useCallback((userContent: string) => {
    const existingConv = conversations.find(c => c.id === activeConvId)

    // Reuse active conversation if it's already an agent session
    if (existingConv && existingConv.type === 'agent') {
      const assistantId = crypto.randomUUID()
      setConversations(prev => prev.map(c => {
        if (c.id !== existingConv.id) return c
        return {
          ...c,
          messages: [
            ...c.messages,
            { id: crypto.randomUUID(), role: 'user', content: userContent, timestamp: Date.now() },
            { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() },
          ],
          updatedAt: Date.now(),
        }
      }))
      return { convId: existingConv.id, assistantId }
    }

    // Otherwise create a new agent conversation
    const convId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()
    const title = userContent.slice(0, 55).trim() + (userContent.length > 55 ? '...' : '')

    setConversations(prev => [{
      id: convId,
      title,
      messages: [
        { id: crypto.randomUUID(), role: 'user', content: userContent, timestamp: Date.now() },
        { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      type: 'agent',
    }, ...prev])
    setActiveConvId(convId)

    return { convId, assistantId }
  }, [activeConvId, conversations])

  const completeAssistantMessage = useCallback((convId: string, assistantId: string, content: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === assistantId ? { ...m, content } : m
        ),
        updatedAt: Date.now(),
      }
    }))
  }, [])

  const updateToolSummary = useCallback((convId: string, summary: Record<string, number>) => {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, toolSummary: summary } : c
    ))
  }, [])

  const clearChat = useCallback(() => {
    if (activeConvId) {
      deleteConversation(activeConvId)
    }
  }, [activeConvId, deleteConversation])

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return {
    conversations,
    activeConvId,
    messages,
    isStreaming,
    sendMessage,
    startAgentPrompt,
    completeAssistantMessage,
    updateToolSummary,
    clearChat,
    stopGeneration,
    newConversation,
    deleteConversation,
    togglePin,
    renameConversation,
    selectConversation,
  }
}
