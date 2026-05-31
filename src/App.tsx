import { useState, useCallback, useRef, useEffect } from 'react'
import { useChat, type ProviderConfig } from './hooks/useChat'
import { useSettings } from './hooks/useSettings'
import { useAgent } from './hooks/useAgent'
import type { AgentStep } from './hooks/useAgent'
import Chat from './components/Chat'
import WorkspaceAside, { type Project } from './components/WorkspaceAside'
import SettingsPanel from './components/SettingsPanel'
import ResearchAside from './components/ResearchAside'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const agentIdsRef = useRef<{ convId: string; assistantId: string } | null>(null)

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
    startAgentPrompt,
    completeAssistantMessage,
    updateConvModel,
    updateToolSummary,
    stopGeneration,
    newConversation,
    deleteConversation,
    togglePin,
    archiveConversation,
    restoreConversation,
    renameConversation,
    selectConversation,
    autoName,
  } = useChat()

  const {
    isRunning: agentIsRunning,
    agentConfig,
    liveThinking,
    updateAgentConfig,
    runAgent,
    stopAgent,
    resetAgent,
    confirmTool,
  } = useAgent()

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [projects, setProjects] = useState<Project[]>(() => {
    try { return JSON.parse(localStorage.getItem('solaria-projects') || '[]') } catch { return [] }
  })
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const completeMsgRef = useRef(completeAssistantMessage)
  const updateToolSummaryRef = useRef(updateToolSummary)
  const agentStepsRef = useRef(agentSteps)
  const conversationsRef = useRef(conversations)

  useEffect(() => { completeMsgRef.current = completeAssistantMessage }, [completeAssistantMessage])
  useEffect(() => { localStorage.setItem('solaria-projects', JSON.stringify(projects)) }, [projects])
  useEffect(() => { updateToolSummaryRef.current = updateToolSummary }, [updateToolSummary])
  useEffect(() => { agentStepsRef.current = agentSteps }, [agentSteps])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  const handleToggleAgent = useCallback(() => {
    updateAgentConfig({ enabled: !agentConfig.enabled })
  }, [agentConfig.enabled, updateAgentConfig])

  const handleClear = useCallback(() => {
    if (activeConvId) deleteConversation(activeConvId)
  }, [activeConvId, deleteConversation])

  const handleNewConversation = useCallback(() => {
    resetAgent()
    setAgentSteps([])
    newConversation(settings.defaultProvider, settings.defaultModel, activeProjectId || undefined)
  }, [resetAgent, newConversation, settings, activeProjectId])

  const handleAgentStep = useCallback((step: AgentStep) => {
    setAgentSteps(prev => [...prev, step])
    // Chat updates progressivo durante la ejecución del agente
    if (step.type === 'chat_update' && agentIdsRef.current) {
      completeMsgRef.current(agentIdsRef.current.convId, agentIdsRef.current.assistantId, step.content)
    }
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
      agentIdsRef.current = null
    }
  }, [])

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

  const handleSend = useCallback((content: string) => {
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

    if (agentConfig.enabled) {
      const ids = startAgentPrompt(content, activeProjectId || undefined)
      agentIdsRef.current = ids
      runAgent(content, providerConfig, handleAgentStep, handleAgentComplete)
    } else {
      sendMessage(content, providerConfig)
    }
  }, [agentConfig.enabled, settings, conversations, activeConvId, sendMessage, startAgentPrompt, runAgent, handleAgentStep, handleAgentComplete, getModelParams])

  const activeConv = conversations.find(c => c.id === activeConvId)

  return (
    <div className="flex h-screen bg-[#131313] overflow-hidden">
      <WorkspaceAside
        conversations={conversations}
        activeConvId={activeConvId}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelect={selectConversation}
        onNew={handleNewConversation}
        onDelete={deleteConversation}
        onPin={togglePin}
        onArchive={archiveConversation}
        onRestore={restoreConversation}
        onRename={renameConversation}
        onShowSettings={(tab?: string) => setShowSettings(tab || 'general')}
        projects={projects}
        onAddProject={(p) => setProjects(prev => [...prev, p])}
        onDeleteProject={(id) => { setProjects(prev => prev.filter(p => p.id !== id)); if (activeProjectId === id) setActiveProjectId(null) }}
        onSelectProject={(p: Project) => {
          const isActive = activeProjectId === p.id
          if (isActive) {
            setActiveProjectId(null)
          } else {
            setActiveProjectId(p.id)
            if (p.path) {
              updateAgentConfig({ workingDirectory: p.path })
            }
          }
        }}
        activeProjectId={activeProjectId}
      />
      <Chat
        messages={messages}
        isStreaming={isStreaming || agentIsRunning}
        onSend={handleSend}
        onStop={agentIsRunning ? stopAgent : stopGeneration}
        onClear={handleClear}
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
      />
      <ResearchAside
        steps={agentSteps}
        isRunning={agentIsRunning}
        liveThinking={liveThinking}
        onClose={() => setAgentSteps([])}
        onStop={agentIsRunning ? stopAgent : undefined}
        onConfirmTool={confirmTool}
      />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          initialTab={typeof showSettings === 'string' ? showSettings as 'general' | 'providers' | 'search' | 'skills' | 'audit' : undefined}
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
