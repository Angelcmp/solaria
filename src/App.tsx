import { useState, useCallback, useRef, useEffect } from 'react'
import { useChat } from './hooks/useChat'
import { useSettings } from './hooks/useSettings'
import { useAgent } from './hooks/useAgent'
import type { AgentStep } from './hooks/useAgent'
import Chat from './components/Chat'
import WorkspaceAside from './components/WorkspaceAside'
import SettingsPanel from './components/SettingsPanel'
import AgentAside from './components/AgentAside'

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
    updateToolSummary,
    stopGeneration,
    newConversation,
    deleteConversation,
    togglePin,
    archiveConversation,
    restoreConversation,
    renameConversation,
    selectConversation,
  } = useChat()

  const {
    isRunning: agentIsRunning,
    sessionLocked,
    agentConfig,
    liveThinking,
    updateAgentConfig,
    runAgent,
    stopAgent,
    resetAgent,
    confirmTool,
    resumeSession,
  } = useAgent()

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])

  const handleToggleAgent = useCallback(() => {
    updateAgentConfig({ enabled: !agentConfig.enabled })
  }, [agentConfig.enabled, updateAgentConfig])

  const handleClear = useCallback(() => {
    if (activeConvId) deleteConversation(activeConvId)
  }, [activeConvId, deleteConversation])

  const handleNewConversation = useCallback(() => {
    resetAgent()
    setAgentSteps([])
    newConversation()
  }, [resetAgent, newConversation])

  const handleAgentStep = useCallback((step: AgentStep) => {
    setAgentSteps(prev => [...prev, step])
  }, [])

  const handleAgentComplete = useCallback((finalContent: string) => {
    const ids = agentIdsRef.current
    if (ids) {
      completeAssistantMessage(ids.convId, ids.assistantId, finalContent)
      // Calculate tool summary from agentSteps, merged with existing
      const currentConv = conversations.find(c => c.id === ids.convId)
      const existing = currentConv?.toolSummary || {}
      const stepSummary: Record<string, number> = { ...existing }
      for (const step of agentSteps) {
        if (step.type === 'tool_result' && step.toolName) {
          stepSummary[step.toolName] = (stepSummary[step.toolName] || 0) + 1
        }
      }
      if (Object.keys(stepSummary).length > 0) {
        updateToolSummary(ids.convId, stepSummary)
      }
      agentIdsRef.current = null
    }
  }, [completeAssistantMessage, updateToolSummary, agentSteps, conversations])

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
          setShowSettings(true)
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
    if (agentConfig.enabled) {
      setAgentSteps([])
      const ids = startAgentPrompt(content)
      agentIdsRef.current = ids
      runAgent(content, {
        type: settings.defaultProvider,
        model: settings.defaultModel,
        apiKey: settings.defaultProvider !== 'ollama' ? settings.apiKeys[settings.defaultProvider] : undefined,
        ...getModelParams(),
      }, handleAgentStep, handleAgentComplete)
    } else {
      sendMessage(content, {
        type: settings.defaultProvider,
        model: settings.defaultModel,
        apiKey: settings.defaultProvider !== 'ollama' ? settings.apiKeys[settings.defaultProvider] : undefined,
        ...getModelParams(),
      })
    }
  }, [agentConfig.enabled, settings, sendMessage, startAgentPrompt, runAgent, handleAgentStep, handleAgentComplete, getModelParams])

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
      />
      <Chat
        messages={messages}
        isStreaming={isStreaming || agentIsRunning}
        onSend={handleSend}
        onStop={agentIsRunning ? stopAgent : stopGeneration}
        onClear={handleClear}
        lang={settings.language}
        onRegenerate={agentConfig.enabled ? undefined : () => regenerate({
          type: settings.defaultProvider,
          model: settings.defaultModel,
          apiKey: settings.defaultProvider !== 'ollama' ? settings.apiKeys[settings.defaultProvider] : undefined,
          ...getModelParams(),
        })}
        settings={settings}
        onShowSettings={() => setShowSettings(true)}
        agentConfig={agentConfig}
        agentIsRunning={agentIsRunning}
        agentLocked={sessionLocked}
        onToggleAgent={handleToggleAgent}
        onResumeSession={resumeSession}
        conversationTitle={activeConv?.title}
      />
      <AgentAside
        steps={agentSteps}
        isRunning={agentIsRunning}
        liveThinking={liveThinking}
        workingDirectory={agentConfig.workingDirectory}
        onClose={() => setAgentSteps([])}
        onStop={stopAgent}
        onConfirmTool={confirmTool}
      />

      {showSettings && (
        <SettingsPanel
          settings={settings}
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
