import { useState, useCallback, useRef, useEffect } from 'react'
import { useChat, type ProviderConfig } from './hooks/useChat'
import { useSettings } from './hooks/useSettings'
import { useAgent } from './hooks/useAgent'
import { useMemory } from './hooks/useMemory'
import { useComparison } from './hooks/useComparison'
import type { AgentStep } from './hooks/useAgent'
import { appLog, setupGlobalErrorLogging } from './lib/log'
import Chat from './components/Chat'
import WorkspaceAside from './components/workspace/WorkspaceAside'
import type { Project } from './components/workspace/types'
import WikiListAside from './components/WikiListAside'
import WikiViewerAside from './components/WikiViewerAside'
import type { WikiFile } from './components/WikiListAside'
import SettingsPanel, { type SettingsPanelProps } from './components/SettingsPanel'
import ProgressPanel from './components/ProgressPanel'
import ModelComparator from './components/ModelComparator'

const PROVIDERS: { id: string; label: string; models: string[]; local: boolean }[] = [
  { id: 'ollama', label: 'Ollama (Local)', models: ['qwen3.5', 'llama3.2', 'llama3.1', 'mistral', 'phi3', 'deepseek-r1', 'gemma3', 'gemma4'], local: true },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-5.5', 'o1', 'o3-mini'], local: false },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-7'], local: false },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'], local: false },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-4-scout-17b-16e-instruct'], local: false },
  { id: 'google', label: 'Google', models: ['gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-pro-preview-03-25'], local: false },
  { id: 'cohere', label: 'Cohere', models: ['command-r7b-12-2024', 'command-r-plus-08-2024'], local: false },
  { id: 'kimi', label: 'Kimi (Moonshot)', models: ['kimi-k2.6', 'kimi-k2-0905-preview'], local: false },
  { id: 'glm', label: 'GLM (Z.AI)', models: ['glm-4.7', 'glm-4.7-flash', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.5', 'glm-4.5-flash'], local: false },
]

function App() {
  useEffect(() => {
    setupGlobalErrorLogging()
    appLog('info', 'App component mounted')
  }, [])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [wikiOpen, setWikiOpen] = useState(false)
  const [wikiFile, setWikiFile] = useState<WikiFile | null>(null)
  const [wikiAnimOpen, setWikiAnimOpen] = useState(false)
  const wikiCloseTimerRef = useRef<number | null>(null)
  const agentIdsRef = useRef<{ convId: string; assistantId: string } | null>(null)

  const openWikiViewer = useCallback((file: WikiFile) => {
    if (wikiCloseTimerRef.current) {
      clearTimeout(wikiCloseTimerRef.current)
      wikiCloseTimerRef.current = null
    }
    setWikiFile(file)
    requestAnimationFrame(() => setWikiAnimOpen(true))
  }, [])

  const closeWikiViewer = useCallback(() => {
    setWikiAnimOpen(false)
    if (wikiCloseTimerRef.current) clearTimeout(wikiCloseTimerRef.current)
    wikiCloseTimerRef.current = window.setTimeout(() => setWikiFile(null), 300)
  }, [])

  const {
    settings,
    showSettings,
    setShowSettings,
    updateSettings,
    updateApiKey,
    updateTavilyKey,
    updateProvider,
  } = useSettings()

  const {
    conversations,
    activeConvId,
    messages,
    isStreaming,
    sendMessage,
    regenerate,
    autoName,
    startAgentPrompt,
    completeAssistantMessage,
    setAssistantThinking,
    updateConvModel,
    updateToolSummary,
    updateConvSteps,
    stopGeneration,
    newConversation,
    deleteConversation,
    togglePin,
    archiveConversation,
    restoreConversation,
    renameConversation,
    selectConversation,
    setPendingPersona,
    setConvPersona,
    clearConvPersona,
  } = useChat()

  const {
    isRunning: agentIsRunning,
    agentConfig,
    updateAgentConfig,
    runAgent,
    stopAgent,
    resetAgent,
    confirmTool,
  } = useAgent()

  const memory = useMemory()

  const {
    isActive: comparisonActive,
    currentRound,
    isStreaming: comparisonStreaming,
    openComparator,
    closeComparator,
    startComparison,
    vote,
    reveal,
  } = useComparison()

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [panelForcedOpen, setPanelForcedOpen] = useState(false)
  const [panelDismissed, setPanelDismissed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('solaria-panel-dismissed') || '{}') } catch { return {} }
  })
  const [projects, setProjects] = useState<Project[]>(() => {
    try { return JSON.parse(localStorage.getItem('solaria-projects') || '[]') } catch { return [] }
  })
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const completeMsgRef = useRef(completeAssistantMessage)
  const updateToolSummaryRef = useRef(updateToolSummary)
  const updateConvStepsRef = useRef(updateConvSteps)
  const agentStepsRef = useRef(agentSteps)
  const conversationsRef = useRef(conversations)
  const setThinkingRef = useRef(setAssistantThinking)

  useEffect(() => { completeMsgRef.current = completeAssistantMessage }, [completeAssistantMessage])
  useEffect(() => { localStorage.setItem('solaria-projects', JSON.stringify(projects)) }, [projects])
  useEffect(() => { updateToolSummaryRef.current = updateToolSummary }, [updateToolSummary])
  useEffect(() => { updateConvStepsRef.current = updateConvSteps }, [updateConvSteps])
  useEffect(() => { agentStepsRef.current = agentSteps }, [agentSteps])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])
  useEffect(() => { setThinkingRef.current = setAssistantThinking }, [setAssistantThinking])
  useEffect(() => { localStorage.setItem('solaria-panel-dismissed', JSON.stringify(panelDismissed)) }, [panelDismissed])

  // Index completed conversations into memory (chat + agent)
  useEffect(() => {
    if (!memory.config.enabled || !memory.config.indexConversations) return
    if (isStreaming || agentIsRunning) return
    const conv = conversations.find(c => c.id === activeConvId)
    if (!conv) return
    if (conv.messages.length < 2) return
    const last = conv.messages[conv.messages.length - 1]
    if (last.role !== 'assistant' || !last.content) return
    const lastIndexedRef = (window as any).__solaria_last_indexed || {}
    if (lastIndexedRef[conv.id] === last.id) return
    const allMessages = conv.messages.map(m => ({ role: m.role, content: m.content }))
    memory.indexConversation(conv.id, conv.title, allMessages).then(() => {
      ;(window as any).__solaria_last_indexed = { ...lastIndexedRef, [conv.id]: last.id }
    }).catch(() => {})
  }, [conversations, isStreaming, agentIsRunning, activeConvId, memory])

  // Auto-re-index project files in background every 5 min while idle
  const isIdleRef = useRef(true)
  isIdleRef.current = !isStreaming && !agentIsRunning
  const memoryRef = useRef(memory)
  memoryRef.current = memory
  useEffect(() => {
    if (!memoryRef.current.config.enabled || !memoryRef.current.config.indexProjectFiles) return
    if (!activeProjectId) return
    const project = projects.find(p => p.id === activeProjectId)
    if (!project?.path) return
    const tryIndex = () => {
      if (!isIdleRef.current) return
      const idx = (window as any).__solaria_project_indexed || {}
      const last = idx[project.path] || 0
      if (Date.now() - last > 3600000) {
        memoryRef.current.indexProject(project.path).catch(() => {})
        ;(window as any).__solaria_project_indexed = { ...idx, [project.path]: Date.now() }
      }
    }
    tryIndex()
    const interval = setInterval(tryIndex, 300000)
    return () => clearInterval(interval)
  }, [activeProjectId, projects])

  const handleToggleAgent = useCallback(() => {
    updateAgentConfig({ enabled: !agentConfig.enabled })
  }, [agentConfig.enabled, updateAgentConfig])

  const handleStartComparison = useCallback((
    prompt: string,
    models: { providerId: string; modelName: string; apiKey?: string }[],
  ) => {
    startComparison(prompt, models, settings.temperature, settings.topP, settings.maxTokens)
  }, [startComparison, settings.temperature, settings.topP, settings.maxTokens])

  const handleClear = useCallback(() => {
    if (activeConvId) deleteConversation(activeConvId)
  }, [activeConvId, deleteConversation])

  const handleNewConversation = useCallback(() => {
    resetAgent()
    setAgentSteps([])
    setPanelForcedOpen(false)
    newConversation(settings.defaultProvider, settings.defaultModel, activeProjectId || undefined)
  }, [resetAgent, newConversation, settings, activeProjectId])

  const handleAgentStep = useCallback((step: AgentStep) => {
    setAgentSteps(prev => [...prev, step])
    // Chat updates progresivo durante la ejecución del agente
    if (step.type === 'chat_update' && agentIdsRef.current) {
      completeMsgRef.current(agentIdsRef.current.convId, agentIdsRef.current.assistantId, step.content)
    }
  }, [])

  const handleAgentThinking = useCallback((content: string) => {
    const ids = agentIdsRef.current
    if (ids) setThinkingRef.current(ids.convId, ids.assistantId, content)
  }, [])

  const handleAgentComplete = useCallback((finalContent: string) => {
    const ids = agentIdsRef.current
    if (ids) {
      completeMsgRef.current(ids.convId, ids.assistantId, finalContent)
      const currentConv = conversationsRef.current.find(c => c.id === ids.convId)
      if (currentConv && currentConv.title === 'Nueva conversación') {
        const provider = currentConv.provider || settings.defaultProvider
        const model = currentConv.model || settings.defaultModel
        autoName(ids.convId, { type: provider as ProviderConfig['type'], model, apiKey: settings.apiKeys[provider as keyof typeof settings.apiKeys] })
      }
      const existing = currentConv?.toolSummary || {}
      const stepSummary: Record<string, number> = { ...existing }
      for (const step of agentStepsRef.current) {
        if (step.type === 'tool_result' && step.toolName) {
          stepSummary[step.toolName] = (stepSummary[step.toolName] || 0) + 1
        }
      }
      if (Object.keys(stepSummary).length > 0) {
        updateToolSummaryRef.current(ids.convId, stepSummary)
      }
      if (agentStepsRef.current.length > 0) {
        updateConvStepsRef.current(ids.convId, agentStepsRef.current)
      }
      agentIdsRef.current = null
    }

    if (memory.config.enabled && memory.config.indexConversations && ids) {
      const conv = conversationsRef.current.find(c => c.id === ids.convId)
      if (conv) {
        const allMessages = conv.messages.map(m => ({ role: m.role, content: m.content }))
        memory.indexConversation(conv.id, conv.title, allMessages).catch(() => {})
      }
    }
  }, [memory])

  const getModelParams = useCallback(() => ({
    temperature: settings.temperature,
    topP: settings.topP,
    maxTokens: settings.maxTokens,
  }), [settings])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          handleNewConversation()
          break
        case ',':
          e.preventDefault()
          setShowSettings('general')
          break
        case 'l':
          e.preventDefault()
          handleClear()
          break
        case 'e':
          e.preventDefault()
          handleToggleAgent()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNewConversation, handleClear, handleToggleAgent])

  const handleSend = useCallback(async (content: string, attachments?: { name: string; size: number }[], options?: { forceAgent?: boolean; persona?: { prompt: string; title: string } | null }) => {
    const activeConv = conversations.find(c => c.id === activeConvId)
    const convProvider = activeConv?.provider || settings.defaultProvider
    const convModel = activeConv?.model || settings.defaultModel
    const apiKey = convProvider !== 'ollama' ? settings.apiKeys[convProvider as keyof typeof settings.apiKeys] : undefined
    const providerConfig = {
      type: convProvider as ProviderConfig['type'],
      model: convModel,
      apiKey,
      ...getModelParams(),
    }

    let memoryContext: string | undefined
    if (memory.config.enabled && memory.config.autoInject) {
      const results = await memory.search({ query: content })
      const ctx = memory.formatContext(results)
      memoryContext = ctx || undefined
    }

    if (options?.persona !== undefined) {
      if (activeConvId) {
        if (options.persona) setConvPersona(activeConvId, options.persona)
        else clearConvPersona(activeConvId)
      } else {
        setPendingPersona(options.persona)
      }
    }

    const persona = options?.persona
      ? options.persona
      : activeConv?.personaPrompt
        ? { prompt: activeConv.personaPrompt, title: activeConv.personaTitle || 'Persona' }
        : null

    const useAgent = options?.forceAgent ?? agentConfig.enabled

    if (useAgent) {
      const ids = startAgentPrompt(content, activeProjectId || undefined)
      agentIdsRef.current = ids
      runAgent(content, providerConfig, handleAgentStep, handleAgentComplete, { memoryContext, personaPrompt: persona?.prompt, onThinking: handleAgentThinking })
    } else {
      sendMessage(content, providerConfig, memoryContext, attachments)
    }
  }, [agentConfig.enabled, settings, conversations, activeConvId, sendMessage, startAgentPrompt, runAgent, handleAgentStep, handleAgentComplete, handleAgentThinking, getModelParams, memory, setConvPersona, clearConvPersona, setPendingPersona])

  const activeConv = conversations.find(c => c.id === activeConvId)

  const handleSelectConversation = useCallback((convId: string) => {
    if (activeConvId && activeConvId !== convId) {
      const current = conversationsRef.current.find(c => c.id === activeConvId)
      if (current && agentStepsRef.current.length > 0) {
        updateConvStepsRef.current(activeConvId, agentStepsRef.current)
      }
    }
    selectConversation(convId)
    const target = conversationsRef.current.find(c => c.id === convId)
    setAgentSteps(target?.steps ? [...target.steps] : [])
    setPanelForcedOpen(false)
  }, [activeConvId, selectConversation])

  const handlePanelClose = useCallback(() => {
    if (activeConvId) {
      setPanelDismissed(prev => ({ ...prev, [activeConvId]: true }))
      updateConvStepsRef.current(activeConvId, agentStepsRef.current)
    }
    setPanelForcedOpen(false)
    setAgentSteps([])
  }, [activeConvId])

  const handlePanelOpen = useCallback(() => {
    setPanelForcedOpen(true)
    if (activeConvId) {
      setPanelDismissed(prev => {
        if (!prev[activeConvId]) return prev
        const next = { ...prev }
        delete next[activeConvId]
        return next
      })
      const conv = conversationsRef.current.find(c => c.id === activeConvId)
      if (conv?.steps && conv.steps.length > 0) {
        setAgentSteps([...conv.steps])
      }
    }
  }, [activeConvId])

  const showPanel = panelForcedOpen || (!panelDismissed[activeConvId || ''] && (agentSteps.length > 0 || agentIsRunning))

  return (
    <div className="flex h-screen bg-[#131313] overflow-hidden">
      <WorkspaceAside
        conversations={conversations}
        activeConvId={activeConvId}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={deleteConversation}
        onPin={togglePin}
        onArchive={archiveConversation}
        onRestore={restoreConversation}
        onRename={renameConversation}
        onShowSettings={(tab?: string) => setShowSettings(tab || 'general')}
        onOpenWiki={() => setWikiOpen(true)}
        projects={projects}
        onAddProject={(p) => setProjects(prev => [...prev, p])}
        onUpdateProject={(p) => setProjects(prev => prev.map(proj => proj.id === p.id ? p : proj))}
        onDeleteProject={(id) => { setProjects(prev => prev.filter(p => p.id !== id)); if (activeProjectId === id) setActiveProjectId(null) }}
        onSelectProject={(p: Project) => {
          const isActive = activeProjectId === p.id
          if (isActive) {
            setActiveProjectId(null)
          } else {
            setActiveProjectId(p.id)
            if (p.path) {
              updateAgentConfig({ workingDirectory: p.path })
              setWikiOpen(true)
              if (memory.config.enabled && memory.config.indexProjectFiles) {
                const indexed = (window as any).__solaria_project_indexed || {}
                const lastTime = indexed[p.path] || 0
                if (Date.now() - lastTime > 3600000) {
                  memory.indexProject(p.path).catch(() => {})
                  ;(window as any).__solaria_project_indexed = { ...indexed, [p.path]: Date.now() }
                }
              }
            }
          }
        }}
        activeProjectId={activeProjectId}
      />

      <WikiListAside
        open={wikiOpen}
        workingDirectory={agentConfig.workingDirectory}
        activePath={wikiFile?.path || null}
        onSelectFile={(file) => openWikiViewer(file)}
        onClose={() => setWikiOpen(false)}
      />

      <Chat
        messages={messages}
        isStreaming={isStreaming || agentIsRunning}
        onSend={handleSend}
        onStop={agentIsRunning ? stopAgent : stopGeneration}
        onClear={handleClear}
        onClearPersona={() => {
          if (activeConvId) clearConvPersona(activeConvId)
        }}
        lang={settings.language}
        onRegenerate={agentConfig.enabled ? undefined : () => {
          const activeConv = conversations.find(c => c.id === activeConvId)
          const regenProvider = activeConv?.provider || settings.defaultProvider
          const regenModel = activeConv?.model || settings.defaultModel
          regenerate({
            type: regenProvider as ProviderConfig['type'],
            model: regenModel,
            apiKey: regenProvider !== 'ollama' ? settings.apiKeys[regenProvider as keyof typeof settings.apiKeys] : undefined,
            ...getModelParams(),
          })
        }}
        settings={settings}
        onShowSettings={() => setShowSettings('general')}
        agentConfig={agentConfig}
        agentIsRunning={agentIsRunning}
        onToggleAgent={handleToggleAgent}
        conversationTitle={activeConv?.title}
        activeConversation={activeConv || null}
        onUpdateConvModel={updateConvModel}
        providers={PROVIDERS}
        activeProject={activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null}
        comparisonEnabled={settings.comparisonEnabled}
        onOpenComparator={openComparator}
        onOpenPanel={handlePanelOpen}
      />

      {wikiFile && (
        <WikiViewerAside
          open={wikiAnimOpen}
          file={wikiFile}
          onClose={closeWikiViewer}
        />
      )}

      {showPanel && (
        <ProgressPanel
          steps={agentSteps}
          isRunning={agentIsRunning}
          onClose={handlePanelClose}
          onStop={agentIsRunning ? stopAgent : undefined}
          onConfirmTool={confirmTool}
          projectName={activeProjectId ? (projects.find(p => p.id === activeProjectId)?.name || undefined) : undefined}
          workingDirectory={agentConfig.workingDirectory || undefined}
          personaPrompt={activeConv?.personaPrompt}
          onOpenDocument={(file) => openWikiViewer({ name: file.name, path: file.path, size: file.content.length, modified: Date.now() })}
        />
      )}

      {comparisonActive && (
        <ModelComparator
          models={PROVIDERS}
          apiKeys={settings.apiKeys as unknown as Record<string, string>}
          temperature={settings.temperature}
          topP={settings.topP}
          maxTokens={settings.maxTokens}
          onClose={closeComparator}
          onStartComparison={handleStartComparison}
          currentRound={currentRound}
          isStreaming={comparisonStreaming}
          onVote={vote}
          onReveal={reveal}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          initialTab={typeof showSettings === 'string' ? showSettings as SettingsPanelProps['initialTab'] : undefined}
          onClose={() => setShowSettings(false)}
          onUpdate={updateSettings}
          onUpdateApiKey={updateApiKey}
          onUpdateTavilyKey={updateTavilyKey}
          onUpdateProvider={updateProvider}
          agentConfig={agentConfig}
          onUpdateAgentConfig={updateAgentConfig}
        />
      )}
    </div>
  )
}

export default App
