import { useState, useRef, useEffect } from 'react'
import type { Message } from '../hooks/useChat'
import type { AppSettings } from '../hooks/useSettings'
import type { AgentConfig } from '../hooks/useAgent'
import type { Template } from '../lib/templates'
import type { Lang } from '../lib/i18n'
import { t } from '../lib/i18n'
import { estimateTokens, estimateCost, formatCost } from '../lib/pricing'
import TemplateSelector from './TemplateSelector'
import Markdown from '../lib/Markdown'

interface ChatProps {
  messages: Message[]
  isStreaming: boolean
  onSend: (content: string) => void
  onStop: () => void
  onClear: () => void
  onRegenerate?: () => void
  settings: AppSettings
  onShowSettings: () => void
  agentConfig?: AgentConfig
  agentIsRunning?: boolean
  agentLocked?: boolean
  templateTrigger?: number
  onToggleAgent?: () => void
  onResumeSession?: () => void
  lang?: Lang
}

interface QuickAction {
  label: string
  systemPrompt: string
  icon: string
}

const QUICK_ACTION_DEFS = [
  { labelKey: 'action.learn', promptKey: 'action.learn.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
  { labelKey: 'action.summarize', promptKey: 'action.summarize.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
  { labelKey: 'action.translate', promptKey: 'action.translate.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
  { labelKey: 'action.analyze', promptKey: 'action.analyze.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' },
  { labelKey: 'action.code', promptKey: 'action.code.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { labelKey: 'action.write', promptKey: 'action.write.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7 21l-4-1a2 2 0 01-1-3l2-6a2 2 0 012-1l6 3 6-3z"/><path d="M9 13l2 2 4-4"/></svg>' },
  { labelKey: 'action.ideas', promptKey: 'action.ideas.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a4 4 0 105.656 0L12 19"/></svg>' },
  { labelKey: 'action.improve', promptKey: 'action.improve.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>' },
  { labelKey: 'action.data', promptKey: 'action.data.prompt', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' },
]

function getQuickActions(lang: Lang): QuickAction[] {
  return QUICK_ACTION_DEFS.map(d => ({
    label: t(d.labelKey, lang),
    systemPrompt: t(d.promptKey, lang),
    icon: d.icon,
  }))
}

interface AttachedFile {
  name: string
  content: string
  size: number
}

export default function Chat({
  messages,
  isStreaming,
  onSend,
  onStop,
  onClear,
  onRegenerate,
  settings,
  onShowSettings,
  agentConfig,
  agentIsRunning,
  agentLocked,
  onToggleAgent,
  onResumeSession,
  lang = 'es',
}: ChatProps) {
  const [input, setInput] = useState('')
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [webSearchActive, setWebSearchActive] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus()
    }
  }, [isStreaming])

  const isAgentEnabled = agentConfig?.enabled ?? false

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const handleFilesSelected = async (files: FileList) => {
    const newFiles: AttachedFile[] = []
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024) {
        alert('Archivo demasiado grande: ${file.name} (> 1MB)')
        continue
      }
      try {
        const content = await readFileAsText(file)
        newFiles.push({ name: file.name, content, size: file.size })
      } catch {
        alert('No se pudo leer: ${file.name}')
      }
    }
    setAttachedFiles(prev => [...prev, ...newFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return
    let content = input.trim()

    if (attachedFiles.length > 0) {
      const filesSection = attachedFiles.map(f =>
        `--- Archivo: ${f.name} (${f.size} bytes) ---\n${f.content}`
      ).join('\n\n')
      content = `${content}\n\n${filesSection}`
      setAttachedFiles([])
    }

    if (webSearchActive && settings.tavilyKey && !isAgentEnabled) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const result: any = await invoke('web_search', { apiKey: settings.tavilyKey, query: content })
        if (result.success) {
          const context = result.results.map((r: any) => `Título: ${r.title}\nURL: ${r.url}\nContenido: ${r.content}`).join('\n\n')
          const answer = result.answer ? `Resumen: ${result.answer}\n\n` : ''
          content = `${content}\n\n---\n\nUsa la siguiente información de búsqueda web para responder:\n\n${answer}${context}`
        }
      } catch {}
    }

    setInput('')
    if (activePrompt) {
      content = '${activePrompt}\n\n${content}'
      setActivePrompt(null)
      setActiveAction(null)
    }
    onSend(content)
  }

  const handleQuickAction = (action: QuickAction) => {
    setActivePrompt(action.systemPrompt)
    setActiveAction(action.label)
    inputRef.current?.focus()
  }

  const handleTemplateSelect = (template: Template) => {
    setActivePrompt(template.prompt)
    setActiveAction(template.title)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const displayMessages = messages.length > 0 ? messages : []

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-[#131313] text-[#E5E5E5] font-['Inter',system-ui,sans-serif]">
      <header className="sticky top-0 z-40 shrink-0 border-b border-[rgba(255,255,255,0.04)] bg-[#1C1B1B]">
        <div className="flex items-center gap-2 w-full max-w-[800px] mx-auto px-4 py-1.5">
          <a className="flex items-center gap-[0.375rem] no-underline" href="#" onClick={(e) => { e.preventDefault(); onClear() }}>
            <img src="/solaria-logo.svg" alt="Solaria" className="w-4 h-4" />
            <span className="text-[0.8125rem] font-semibold text-[#DCB263]">Solaria</span>
          </a>
          {isAgentEnabled && (
            <div className={'flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[0.6875rem] font-medium ' + (agentIsRunning ? 'bg-[rgba(0,229,201,0.12)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]' : 'bg-[rgba(220,178,99,0.08)] border-[rgba(220,178,99,0.2)] text-[#DCB263]')}>
              <span>Agent{agentIsRunning ? '...' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.2)] text-[#00E5C9] text-[0.6875rem] font-medium">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>
            <span className="max-w-[100px] truncate">{settings.defaultModel}</span>
          </div>
          <div className="flex-1" />
          <button onClick={onShowSettings} className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white transition-colors" title={t('chat.settings', lang)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          {displayMessages.length > 0 && (
            <button onClick={onClear} className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444] text-[#999999] transition-colors" title={t('chat.clear', lang)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          )}
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-4 py-4 relative"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(0,229,201,0.06)] border-2 border-dashed border-[rgba(0,229,201,0.3)] rounded-lg pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span className="text-[0.75rem] font-medium text-[#00E5C9]">{t('chat.drop_files', lang)}</span>
            </div>
          </div>
        )}
        <div className="max-w-[720px] mx-auto space-y-3">
          {displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4 py-8 animate-[fadeIn_0.5s_ease]">
              <div className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center bg-[linear-gradient(135deg,rgba(220,178,99,0.2),rgba(0,229,201,0.1))] shadow-[0_8px_32px_rgba(220,178,99,0.1)]">
                <img src="/solaria-logo.svg" alt="Solaria" className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {isAgentEnabled ? t('chat.welcome.agent', lang) : t('chat.welcome.title', lang)}
              </h2>
              <p className="text-[0.8125rem] text-[#999999] max-w-[360px]">
                {isAgentEnabled ? t('chat.welcome.agent_desc', lang) : t('chat.welcome.desc', lang)}
              </p>
              {!isAgentEnabled && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {getQuickActions(lang).slice(0, 6).map(action => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      className="flex items-center gap-[0.25rem] px-3 py-1.5 rounded-[20px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#E5E5E5] text-[0.75rem] transition-all duration-200 hover:bg-[rgba(255,255,255,0.08)] hover:border-[#DCB263] hover:text-white hover:-translate-y-[1px] hover:shadow-[0_4px_16px_rgba(220,178,99,0.1)]"
                      dangerouslySetInnerHTML={{ __html: action.icon.replace('width="13"', 'width="11"').replace('height="13"', 'height="11"') + '<span>' + action.label + '</span>' }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-[800px] mx-auto px-4 py-3">
              {displayMessages.map((msg, i) => (
                <div key={msg.id} className="mb-4 animate-[msgFadeIn_0.3s_ease-out]" style={{ animationDelay: i * 50 + 'ms' }}>
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end">
                      <div className="max-w-[75%] px-[0.75rem] py-[0.5rem] rounded-[14px_14px_4px_14px] border border-[rgba(220,178,99,0.15)] bg-[linear-gradient(135deg,rgba(220,178,99,0.1),rgba(220,178,99,0.05))] text-white text-[0.875rem] leading-[1.6]">
                        <Markdown content={msg.content} />
                      </div>
                    </div>
                  ) : (
                    <div className="group">
                      {msg.content === '' && isStreaming ? (
                        <div className="flex gap-[4px] px-[0.875rem] py-[0.625rem] bg-[#1C1B1B] border border-[rgba(255,255,255,0.04)] rounded-[12px] w-fit">
                          {[0, 0.2, 0.4].map((delay, index) => (
                            <div key={index} className="w-[6px] h-[6px] bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: delay + 's' }} />
                          ))}
                        </div>
                      ) : (
                        <Markdown content={msg.content} />
                      )}
                      {i === displayMessages.length - 1 && !isStreaming && (
                        <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button onClick={async () => await navigator.clipboard.writeText(msg.content)} className="flex items-center justify-center w-6 h-6 rounded bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#999999] hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] hover:text-white transition-colors" title={t('chat.copy', lang)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/></svg>
                          </button>
                          {onRegenerate && msg.role === 'assistant' && msg.content && (
                            <button onClick={onRegenerate} className="flex items-center justify-center w-6 h-6 rounded bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#999999] hover:bg-[rgba(220,178,99,0.1)] hover:border-[rgba(220,178,99,0.3)] hover:text-[#DCB263] transition-colors" title={t('chat.regenerate', lang)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {activePrompt && !isAgentEnabled && (
        <div className="w-full max-w-[800px] mx-auto px-4">
          <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 rounded-md bg-[rgba(0,229,201,0.06)] border border-[rgba(0,229,201,0.12)]">
            <span className="text-[0.625rem] font-semibold text-[#00E5C9] uppercase tracking-[0.03em]">{activeAction || 'Prompt'}</span>
            <span className="text-[0.6875rem] text-[rgba(255,255,255,0.5)] truncate flex-1">{activePrompt.slice(0, 80)}...</span>
            <button onClick={() => { setActivePrompt(null); setActiveAction(null) }} className="flex items-center justify-center w-4 h-4 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-40 bg-[linear-gradient(to_top,#131313_70%,transparent)] backdrop-blur-[8px]" style={{ WebkitBackdropFilter: 'blur(8px)' }}>
        <div className="w-full max-w-[800px] mx-auto px-4 pb-2 pt-1">
          <div className={'flex flex-col bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] p-2 gap-1 relative transition-all duration-300 focus-within:border-[rgba(220,178,99,0.4)] focus-within:shadow-[0_0_0_3px_rgba(220,178,99,0.08)] focus-within:bg-[rgba(255,255,255,0.06)] ' + ((agentIsRunning || agentLocked) ? 'opacity-40 pointer-events-none' : '')}>
            <div className="flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto'
                    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px'
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={isAgentEnabled ? t('chat.placeholder.agent', lang) : t('chat.placeholder', lang)}
                rows={1}
                disabled={agentIsRunning}
                className="flex-1 bg-transparent border-none outline-none text-[0.875rem] text-white placeholder-[#666666] leading-[1.5] resize-none max-h-[150px] min-h-[22px] py-[2px] overflow-y-auto font-['Inter',system-ui,sans-serif]"
              />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFilesSelected(e.target.files)} />
              <button
                onClick={isStreaming ? onStop : handleSubmit}
                disabled={!input.trim() && !isStreaming}
                className={'shrink-0 w-8 h-8 rounded-lg border-none flex items-center justify-center transition-all duration-200 ' + (isStreaming ? 'bg-[#666666]' : input.trim() ? 'bg-[linear-gradient(135deg,#00E5C9,#DCB263)] text-[#131313] hover:shadow-[0_0_20px_rgba(0,229,201,0.3),0_0_6px_rgba(220,178,99,0.2)] hover:scale-105 active:scale-95' : 'bg-[rgba(255,255,255,0.06)] text-[#666666] opacity-30 cursor-not-allowed')}
              >
                {isStreaming ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                )}
              </button>
            </div>

            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[rgba(0,229,201,0.06)] border border-[rgba(0,229,201,0.12)]">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span className="text-[0.6rem] text-[#00E5C9] font-mono max-w-[80px] truncate">{f.name}</span>
                    <span className="text-[0.5rem] text-[#4a4a4a]">{(f.size / 1024).toFixed(1)}KB</span>
                    <button onClick={() => removeAttachedFile(i)} className="flex items-center justify-center w-3.5 h-3.5 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#666666] hover:text-[#ef4444] transition-colors">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 min-h-[24px]">
              {agentLocked && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[rgba(220,178,99,0.08)] border border-[rgba(220,178,99,0.15)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="flex-1 text-[0.625rem] text-[#DCB263]">{t('chat.session_locked', lang)}</span>
                  <button onClick={onResumeSession} className="px-2 py-0.5 rounded text-[0.6rem] font-semibold bg-[rgba(220,178,99,0.12)] border border-[rgba(220,178,99,0.3)] text-[#DCB263] hover:bg-[rgba(220,178,99,0.2)] transition-colors">{t('chat.resume', lang)}</button>
                </div>
              )}

              <button
                onClick={() => setWebSearchActive(!webSearchActive)}
                className={'shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ' + (webSearchActive ? 'bg-[rgba(0,229,201,0.1)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]' : 'bg-transparent border-[rgba(255,255,255,0.06)] text-[#666666] hover:border-[rgba(255,255,255,0.15)] hover:text-[#999999]')}
                title={webSearchActive ? t('chat.search_web.off', lang) : t('chat.search_web', lang)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><ellipse cx="12" cy="12" rx="10" ry="4"/></svg>
              </button>

              <button
                onClick={onToggleAgent}
                className={'shrink-0 h-6 rounded flex items-center justify-center border transition-all duration-200 px-1.5 gap-1 ' + (isAgentEnabled ? 'bg-[rgba(0,229,201,0.1)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]' : 'bg-transparent border-[rgba(255,255,255,0.06)] text-[#666666] hover:border-[rgba(255,255,255,0.15)] hover:text-[#999999]')}
                title={isAgentEnabled ? 'Modo chat normal' : t('chat.agent', lang)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="8" cy="13" r="1.5" fill="currentColor"/><circle cx="16" cy="13" r="1.5" fill="currentColor"/><path d="M12 3v3M12 16v3"/></svg>
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.04em]">Agent</span>
              </button>

              <div className="w-px h-3.5 bg-[rgba(255,255,255,0.06)] mx-0.5" />

              <button onClick={() => setShowTemplates(true)} className="shrink-0 w-6 h-6 rounded flex items-center justify-center border border-[rgba(255,255,255,0.06)] text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(220,178,99,0.3)] hover:text-[#DCB263] transition-all duration-200" title={t('chat.templates', lang)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>

              <button onClick={() => fileInputRef.current?.click()} className="shrink-0 w-6 h-6 rounded flex items-center justify-center border border-[rgba(255,255,255,0.06)] text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(0,229,201,0.3)] hover:text-[#00E5C9] transition-all duration-200" title={t('chat.attach_file', lang)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>

              {!isAgentEnabled && (
                <div className="flex gap-0.5" style={{ scrollbarWidth: 'none' }}>
                  {getQuickActions(lang).map(action => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      className={'shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ' + (activeAction === action.label ? 'bg-[rgba(220,178,99,0.1)] border-[rgba(220,178,99,0.3)] text-[#DCB263]' : 'bg-transparent border-[rgba(255,255,255,0.06)] text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(220,178,99,0.3)] hover:text-[#DCB263]')}
                      title={action.label}
                      dangerouslySetInnerHTML={{ __html: action.icon.replace('width="13"', 'width="11"').replace('height="13"', 'height="11"') }}
                    />
                  ))}
                </div>
              )}

              <div className="flex-1" />

              {messages.length > 0 && (() => {
                const inputTokens = messages.filter(m => m.role === 'user').reduce((s, m) => s + estimateTokens(m.content), 0)
                const outputTokens = messages.filter(m => m.role === 'assistant').reduce((s, m) => s + estimateTokens(m.content), 0)
                const totalTokens = inputTokens + outputTokens
                const cost = settings.defaultProvider !== 'ollama' ? estimateCost(settings.defaultModel, inputTokens, outputTokens) : null
                return (
                  <span className="text-[0.5rem] text-[#4a4a4a] font-mono select-none cursor-default" title={cost ? 'Input: ' + formatCost(cost.inputCost) + ' | Output: ' + formatCost(cost.outputCost) + ' | Total: ' + formatCost(cost.totalCost) : t('chat.ollama_free', lang)}>
                    ~{totalTokens} tokens{cost ? ' · ' + formatCost(cost.totalCost) : ''}
                  </span>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      <TemplateSelector isOpen={showTemplates} onClose={() => setShowTemplates(false)} onSelect={handleTemplateSelect} />
    </div>
  )
}
