import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Message, Conversation } from '../hooks/useChat'
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
  templateTrigger?: number
  onToggleAgent?: () => void
  lang?: Lang
  conversationTitle?: string
  activeConversation?: Conversation | null
  onUpdateConvModel?: (convId: string, provider: string, model: string) => void
  providers?: { id: string; label: string; models: string[]; local: boolean }[]
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

function getTimeGreeting(lang: Lang): string {
  const h = new Date().getHours()
  if (h < 12) return t('chat.welcome.morning', lang)
  if (h < 18) return t('chat.welcome.afternoon', lang)
  return t('chat.welcome.evening', lang)
}

const WELCOME_VARIANTS_CHAT = ['chat.welcome.ask', 'chat.welcome.ask1', 'chat.welcome.ask2', 'chat.welcome.ask3', 'chat.welcome.ask4']
const WELCOME_VARIANTS_AGENT = ['chat.welcome.ask.agent', 'chat.welcome.ask.agent1', 'chat.welcome.ask.agent2', 'chat.welcome.ask.agent3', 'chat.welcome.ask.agent4']

function getWelcomeVariant(isAgent: boolean, lang: Lang): string {
  const variants = isAgent ? WELCOME_VARIANTS_AGENT : WELCOME_VARIANTS_CHAT
  const key = `solaria-welcome-idx-${isAgent ? 'agent' : 'chat'}`
  const stored = localStorage.getItem(key)
  let idx = stored ? parseInt(stored, 10) : 0
  if (isNaN(idx) || idx >= variants.length) idx = 0
  const text = t(variants[idx], lang)
  localStorage.setItem(key, String((idx + 1) % variants.length))
  return text
}

// Prompt injection detection patterns (EN + ES)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|the\s+above)\s+(instructions?|prompts?|messages?)/i,
  /ignor[aá]\s+(tod[ao]s?\s+)?(l[ao]s?\s+)?(instrucciones|indicaciones|mensajes)\s+(previas?|anteriores?|de\s+arriba)/i,
  /you\s+are\s+now\s+(a\s+|an?\s+)?(different|new|another)/i,
  /ahora\s+eres\s+(un|una)\s+(diferente|nuevo|otro)/i,
  /forget\s+(everything|all)/i,
  /olv[ií]da\s+(todo|lo\s+anterior)/i,
  /system\s*:\s*/i,
  /sistema\s*:\s*/i,
  /<\|.*\|>/,
  /\[system\s*\]/i,
  /\[sistema\s*\]/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /finge\s+que\s+(eres|sos)/i,
]

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text))
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
  onToggleAgent,
  lang = 'es',
  conversationTitle,
  activeConversation,
  onUpdateConvModel,
  providers,
}: ChatProps) {
  const [input, setInput] = useState('')
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const [webSearchActive, setWebSearchActive] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const qaDropdownRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom()
    }
  }, [messages, userScrolledUp, scrollToBottom])

  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus()
    }
  }, [isStreaming])

  // Close quick actions dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (qaDropdownRef.current && !qaDropdownRef.current.contains(e.target as Node)) {
        setShowQuickActions(false)
      }
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll-spy detection
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setUserScrolledUp(!atBottom)
  }, [])

  const isAgentEnabled = agentConfig?.enabled ?? false
  const welcomeText = useMemo(() => getWelcomeVariant(isAgentEnabled, lang), [isAgentEnabled, lang, messages.length === 0])

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

    // Prompt injection detection
    if (detectInjection(content)) {
      alert(t('chat.injection_warn', lang))
      return
    }

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
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setUserScrolledUp(false)
    setShowQuickActions(false)
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
    setShowQuickActions(false)
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
    <div className="flex flex-col flex-1 min-w-0 bg-[#131313] text-[#E5E5E5]" style={{ fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-40 shrink-0 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(19,19,19,0.85)] backdrop-blur-[12px]" style={{ WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 w-full max-w-[800px] mx-auto px-4 py-1.5">
          <a className="flex items-center gap-[0.375rem] no-underline" href="#" onClick={(e) => { e.preventDefault(); onClear() }}>
            <img src="/solaria-logo.svg" alt="Solaria" className="w-4 h-4" />
            <span className="text-[0.8125rem] font-semibold text-[#DCB263]">Solaria</span>
          </a>
          {conversationTitle && (
            <span className="text-[0.6875rem] text-[#999999] ml-2 truncate max-w-[200px]">{conversationTitle}</span>
          )}
          {isAgentEnabled && (
            <div className={'flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[0.6875rem] font-medium ' + (agentIsRunning ? 'bg-[rgba(0,229,201,0.12)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]' : 'bg-[rgba(220,178,99,0.08)] border-[rgba(220,178,99,0.2)] text-[#DCB263]')}>
              <span>Agent{agentIsRunning ? '...' : ''}</span>
            </div>
          )}
          <div className="relative" ref={modelPickerRef}>
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.2)] text-[#00E5C9] text-[0.6875rem] font-medium hover:bg-[rgba(0,229,201,0.12)] transition-colors cursor-pointer whitespace-nowrap"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>
              <span className="max-w-[100px] truncate">
                {activeConversation?.model || settings.defaultModel}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showModelPicker && providers && (
              <div className="absolute top-full right-0 mt-1 w-[260px] max-h-[300px] overflow-y-auto bg-[#1C1B1B] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl z-50 py-1" style={{ scrollbarWidth: 'thin' }}>
                {providers.map(p => (
                  <div key={p.id}>
                    <div className="text-[0.55rem] text-[#666666] uppercase tracking-[0.06em] px-3 py-1.5 mt-1 first:mt-0">{p.label}</div>
                    {p.models.map(m => {
                      const isActive = (activeConversation?.provider || settings.defaultProvider) === p.id
                        && (activeConversation?.model || settings.defaultModel) === m
                      return (
                        <button
                          key={m}
                          onClick={() => {
                            if (activeConversation && activeConversation.id && onUpdateConvModel) {
                              onUpdateConvModel(activeConversation.id, p.id, m)
                            }
                            setShowModelPicker(false)
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[0.6875rem] transition-colors ${
                            isActive
                              ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9]'
                              : 'text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)]'
                          }`}
                        >
                          <span className="font-mono">{m}</span>
                          {isActive && <span className="ml-1.5 text-[0.55rem] opacity-60">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          {isAgentEnabled && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#666666] text-[0.6rem] font-mono" title={agentConfig?.workingDirectory || 'Sin directorio de trabajo. Haz clic para configurar.'}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              <span
                className="cursor-pointer hover:text-[#00E5C9] transition-colors max-w-[200px] truncate"
                onClick={onShowSettings}
                title="Haz clic para cambiar el directorio en Settings"
              >
                {agentConfig?.workingDirectory || 'Seleccionar directorio...'}
              </span>
              {!agentConfig?.workingDirectory && (
                <span className="text-[#DCB263] animate-pulse">⚠</span>
              )}
            </div>
          )}
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
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 relative"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onScroll={handleScroll}
      >
        <div ref={messagesTopRef} />
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(0,229,201,0.06)] border-2 border-dashed border-[rgba(0,229,201,0.3)] rounded-lg pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span className="text-[0.75rem] font-medium text-[#00E5C9]">{t('chat.drop_files', lang)}</span>
            </div>
          </div>
        )}
        <div className="max-w-[720px] mx-auto h-full flex flex-col">
          {displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 px-4 animate-[fadeIn_0.8s_ease-out] select-none">
              <img src="/solaria-logo.svg" alt="Solaria" className="w-16 h-16 opacity-70" />
              <div className="space-y-2">
                <p className="text-[1rem] text-[#999999]" style={{ fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif", fontWeight: 450, letterSpacing: '0.02em' }}>
                  {getTimeGreeting(lang)}
                </p>
                <p className="text-[1.375rem] text-[#E5E5E5]" style={{ fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif", fontWeight: 350 }}>
                  {welcomeText}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[800px] mx-auto px-4 py-3">
              {displayMessages.map((msg, i) => (
                <div key={msg.id} className="mb-4 animate-[msgFadeIn_0.3s_ease-out]" style={{ animationDelay: i * 50 + 'ms' }}>
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end">
                      <div className="max-w-[70%] px-[0.6rem] py-[0.35rem] rounded-[12px_12px_4px_12px] border border-[rgba(220,178,99,0.12)] bg-[linear-gradient(135deg,rgba(220,178,99,0.08),rgba(220,178,99,0.03))] text-white text-[0.75rem] leading-[1.5]">
                        <Markdown content={msg.content} compact />
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

        {/* Floating scroll buttons */}
        {userScrolledUp && displayMessages.length > 0 && (
          <button
            onClick={() => { setUserScrolledUp(false); scrollToBottom() }}
            className="fixed bottom-28 right-8 z-30 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#1C1B1B] border border-[rgba(255,255,255,0.12)] text-[#999999] hover:text-white hover:border-[#DCB263] shadow-lg transition-all duration-200 text-[0.6875rem] font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            {t('chat.scroll_down', lang)}
          </button>
        )}
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
          <div className={'flex flex-col bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[14px] pt-1.5 px-2 pb-2 gap-1 relative transition-all duration-300 focus-within:border-[rgba(220,178,99,0.4)] focus-within:shadow-[0_0_0_3px_rgba(220,178,99,0.08)] focus-within:bg-[rgba(255,255,255,0.06)] ' + (agentIsRunning ? 'opacity-40 pointer-events-none' : '')}>
            {isAgentEnabled && agentConfig?.workingDirectory && (
              <div className="flex items-center gap-1 px-2 text-[0.5rem] text-[#555555] font-mono">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span className="truncate max-w-[250px]" title={agentConfig.workingDirectory}>{agentConfig.workingDirectory}</span>
              </div>
            )}
            {isAgentEnabled && !agentConfig?.workingDirectory && (
              <div className="flex items-center gap-1 px-2 text-[0.5rem] text-[#DCB263] font-mono">
                ⚠ Sin directorio de trabajo — configurar en Settings
              </div>
            )}
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
                className="flex-1 bg-transparent border-none outline-none text-[0.875rem] text-white placeholder-[#666666] leading-[1.5] resize-none max-h-[150px] min-h-[22px] py-[2px] overflow-y-auto"
                style={{ fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif" }}
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
                <div ref={qaDropdownRef} className="relative">
                  <button
                    onClick={() => setShowQuickActions(!showQuickActions)}
                    className={'shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ' + (showQuickActions ? 'bg-[rgba(220,178,99,0.1)] border-[rgba(220,178,99,0.3)] text-[#DCB263]' : 'bg-transparent border-[rgba(255,255,255,0.06)] text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(220,178,99,0.3)] hover:text-[#DCB263]')}
                    title={t('chat.quick_actions', lang)}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </button>
                  {showQuickActions && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-48 bg-[#1C1B1B] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl overflow-hidden animate-[fadeIn_0.15s_ease]">
                      {getQuickActions(lang).map(action => (
                        <button
                          key={action.label}
                          onClick={() => handleQuickAction(action)}
                          className={'flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] transition-colors ' + (activeAction === action.label ? 'bg-[rgba(220,178,99,0.08)] text-[#DCB263]' : 'text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:text-white')}
                          dangerouslySetInnerHTML={{ __html: action.icon.replace('width="13"', 'width="12"').replace('height="13"', 'height="12"') + '<span>' + action.label + '</span>' }}
                        />
                      ))}
                    </div>
                  )}
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
