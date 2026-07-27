import { useState, useRef, useEffect, useMemo } from 'react'
import type { AgentStep } from '../hooks/useAgent'
import Markdown from '../lib/Markdown'
import { BulletIcon, CheckIcon, WarningIcon, ChevronUpIcon, ChevronDownIcon } from './Icons'

interface ResearchAsideProps {
  steps: AgentStep[]
  isRunning: boolean
  liveThinking?: string
  onClose: () => void
  onStop?: () => void
  onConfirmTool?: (allow: boolean) => void
}

type Tab = 'process' | 'document' | 'references'

interface SourceItem {
  url: string
  title: string
  status: 'pending' | 'fetched' | 'error'
  score: number
}

interface ReportFile {
  path: string
  content: string
  written: boolean
}

interface TavilyResultLike {
  url?: string
  title?: string
  score?: number
}

interface WebSearchResult {
  success?: boolean
  results?: TavilyResultLike[]
  answer?: string
  error?: string
}

function defaultScore(status: SourceItem['status']): number {
  if (status === 'fetched') return 0.75
  if (status === 'error') return 0.15
  return 0.35
}

function extractSources(steps: AgentStep[]): SourceItem[] {
  const sources: SourceItem[] = []
  const seen = new Set<string>()
  const searchScores = new Map<string, number>()

  for (const step of steps) {
    if (step.type === 'tool_result' && step.toolName === 'web_search' && step.toolResult) {
      try {
        const parsed: WebSearchResult = JSON.parse(step.toolResult)
        if (parsed.results) {
          for (const r of parsed.results) {
            if (r.url) {
              searchScores.set(r.url, r.score ?? 0.7)
            }
          }
        }
      } catch {}
    }
  }

  for (const step of steps) {
    if (step.type === 'tool_call' && step.toolArgs) {
      try {
        const args = JSON.parse(step.toolArgs)
        if (step.toolName === 'web_search' && args.query) {
          const key = `search:${args.query}`
          if (!seen.has(key)) {
            seen.add(key)
            sources.push({ url: '', title: `Búsqueda: ${args.query.slice(0, 60)}`, status: 'pending', score: 0.5 })
          }
        }
        if (step.toolName === 'fetch_url' && args.url) {
          if (!seen.has(args.url)) {
            seen.add(args.url)
            const title = args.url.replace(/https?:\/\//, '').split('/')[0] || args.url
            sources.push({ url: args.url, title, status: 'pending', score: searchScores.get(args.url) ?? 0.5 })
          }
        }
      } catch {}
    }
    if (step.type === 'tool_result' && step.toolName === 'fetch_url' && step.toolResult) {
      const url = findUrlInArgs(steps, step.toolResult)
      if (url) {
        const existing = sources.find(s => s.url === url)
        if (existing) {
          existing.status = step.toolResult.startsWith('ERROR') ? 'error' : 'fetched'
          if (existing.score === undefined || existing.score <= 0.5) {
            existing.score = defaultScore(existing.status)
          }
        }
      }
    }
  }
  return sources
}

function findUrlInArgs(steps: AgentStep[], _result: string): string | null {
  for (const step of steps) {
    if (step.type === 'tool_call' && step.toolName === 'fetch_url' && step.toolArgs) {
      try {
        const args = JSON.parse(step.toolArgs)
        if (args.url) return args.url
      } catch {}
    }
  }
  return null
}

function extractReports(steps: AgentStep[]): ReportFile[] {
  const reports: ReportFile[] = []
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.type === 'tool_call' && step.toolName === 'write_file' && step.toolArgs) {
      try {
        const args = JSON.parse(step.toolArgs)
        const path = args.path || ''
        const content = args.content || ''
        const nextStep = steps[i + 1]
        const written = nextStep?.type === 'tool_result' && nextStep.toolName === 'write_file'
          ? !nextStep.toolResult?.startsWith('ERROR')
          : false
        reports.push({ path, content, written })
      } catch {}
    }
  }
  return reports
}

export default function ResearchAside(props: ResearchAsideProps) {
  const { steps, isRunning, liveThinking, onClose, onStop, onConfirmTool } = props
  const [tab, setTab] = useState<Tab>('process')
  const [collapsed, setCollapsed] = useState(false)

  const sources = useMemo(() => extractSources(steps), [steps])
  const reports = useMemo(() => extractReports(steps), [steps])

  const hasContent = steps.length > 0 || isRunning

  if (!hasContent) return null

  if (collapsed) {
    return (
      <div className="flex flex-col items-center bg-[#1C1B1B] border-l border-[rgba(255,255,255,0.04)] w-[36px] shrink-0 overflow-hidden">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center w-6 h-6 mt-2 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors"
          title="Expandir panel"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className={`w-1.5 h-1.5 rounded-full mt-2 ${isRunning ? 'bg-[#00E5C9] animate-pulse' : 'bg-[#666666]'}`} />
        <div className="flex flex-col items-center gap-2 mt-3">
          <button onClick={() => setTab('process')} className={`w-5 h-5 rounded flex items-center justify-center text-[0.55rem] ${tab === 'process' ? 'text-[#DCB263]' : 'text-[#666666]'}`} title="Proceso">P</button>
          <button onClick={() => setTab('document')} className={`w-5 h-5 rounded flex items-center justify-center text-[0.55rem] ${tab === 'document' ? 'text-[#DCB263]' : 'text-[#666666]'}`} title="Documento">D</button>
          <button onClick={() => setTab('references')} className={`w-5 h-5 rounded flex items-center justify-center text-[0.55rem] ${tab === 'references' ? 'text-[#DCB263]' : 'text-[#666666]'}`} title="Referencias">R</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-[#1C1B1B] border-l border-[rgba(255,255,255,0.04)] w-[420px] shrink-0 overflow-hidden">
      {/* Tabs + controls */}
      <div className="flex items-center border-b border-[rgba(255,255,255,0.04)]">
        {([
          { id: 'process' as Tab, label: 'Proceso', icon: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
          { id: 'document' as Tab, label: 'Documento', icon: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', badge: reports.length > 0 ? 'dot' : undefined },
          { id: 'references' as Tab, label: 'Referencias', icon: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', badge: sources.length > 0 ? String(sources.length) : undefined },
        ] as { id: Tab; label: string; icon: string; badge?: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-2 text-[0.6rem] font-medium transition-colors ${
              tab === t.id
                ? 'text-[#E5E5E5] border-b border-[#00E5C9]'
                : 'text-[#666666] border-b border-transparent hover:text-[#999999]'
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: t.icon }} />
            <span>{t.label}</span>
            {t.badge === 'dot' ? (
              <span className="w-1 h-1 rounded-full bg-[#00E5C9] ml-1" />
            ) : t.badge ? (
              <span className="text-[0.45rem] ml-1 px-1 rounded bg-[rgba(0,229,201,0.08)] text-[#00E5C9]">{t.badge}</span>
            ) : null}
          </button>
        ))}
          <div className="flex-1" />
          <div className={`w-1.5 h-1.5 rounded-full mr-1 ${isRunning ? 'bg-[#00E5C9] animate-pulse' : 'bg-[#666666]'}`} />
          {isRunning && onStop && (
            <button onClick={onStop} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#999999] hover:text-[#ef4444] transition-colors mr-1" title="Detener">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
          )}
          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors mr-1"
            title="Colapsar panel"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors mr-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {tab === 'process' && (
          <ProcessTabContent steps={steps} isRunning={isRunning} liveThinking={liveThinking} onConfirmTool={onConfirmTool} />
        )}
        {tab === 'document' && (
          <DocumentTabContent reports={reports} />
        )}
        {tab === 'references' && (
          <ReferencesTabContent sources={sources} />
        )}
      </div>
    </div>
  )
}

// ── Process Tab ──────────────────────────────────────────────────────────────

function ProcessTabContent({ steps, isRunning, liveThinking, onConfirmTool }: {
  steps: AgentStep[]
  isRunning: boolean
  liveThinking?: string
  onConfirmTool?: (allow: boolean) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps, liveThinking, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  const toolCalls = steps.filter(s => s.type === 'tool_call').length
  const results = steps.filter(s => s.type === 'tool_result').length
  const hasFinal = steps.some(s => s.type === 'final')

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto py-3 px-3 space-y-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
      {steps.length === 0 && isRunning && (
        <div className="flex items-center justify-center h-full">
          <div className="flex gap-1.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-2 h-2 bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
        </div>
      )}

      {!autoScroll && steps.length > 3 && (
        <button
          onClick={() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); setAutoScroll(true) }}
          className="sticky bottom-0 w-full py-1.5 text-[0.6rem] text-[#00E5C9] bg-[rgba(0,229,201,0.06)] border border-[rgba(0,229,201,0.15)] rounded-lg hover:bg-[rgba(0,229,201,0.1)] transition-colors"
        >
          ↓ Ir al último paso
        </button>
      )}

      {steps.length > 3 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] text-[0.55rem]">
          <span className="flex items-center gap-1 text-[#DCB263]"><BulletIcon size={6} color="#DCB263" />{toolCalls} herramienta{toolCalls !== 1 ? 's' : ''}</span>
          <span className="text-[#4a4a4a]">·</span>
          <span className="text-[#00E5C9]">{results} resultado{results !== 1 ? 's' : ''}</span>
          {hasFinal && <><span className="text-[#4a4a4a]">·</span><span className="flex items-center gap-1 text-[#999999]"><CheckIcon size={10} color="#999999" />final</span></>}
          <span className="ml-auto text-[#4a4a4a]">{steps.length} pasos</span>
        </div>
      )}
      {steps.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          stepIndex={i + 1}
          totalSteps={steps.length}
          isLast={i === steps.length - 1}
          isRunning={isRunning}
          onConfirmTool={onConfirmTool}
        />
      ))}
      {liveThinking && isRunning && (
        <div className="p-3 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.06)] border-l-2 border-l-[rgba(220,178,99,0.5)] animate-[msgFadeIn_0.3s_ease-out]">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span className="text-[0.7rem] font-medium text-[#999999]">Investigando...</span>
            <div className="flex gap-[2px] ml-1">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} className="w-1 h-1 bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
          </div>
          <div className="text-[0.75rem] text-[#E5E5E5] leading-[1.6] mt-1.5 whitespace-pre-wrap">
            {liveThinking}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step Card (same as AgentAside) ────────────────────────────────────────────

function StepCard({ step, stepIndex, totalSteps, isLast, isRunning, onConfirmTool }: {
  step: AgentStep
  stepIndex: number
  totalSteps: number
  isLast: boolean
  isRunning: boolean
  onConfirmTool?: (allow: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const [copied, setCopied] = useState(false)

  const isFetch = step.toolName === 'fetch_url'
  const isError = step.type === 'tool_result' && step.toolResult?.startsWith('ERROR')

  const borderColor = step.type === 'tool_result'
    ? (isError ? 'border-l-[#ef4444]' : 'border-l-[rgba(0,229,201,0.5)]')
    : isFetch
      ? 'border-l-[rgba(0,229,201,0.5)]'
      : 'border-l-[rgba(220,178,99,0.5)]'

  const statusIcon = step.type === 'reasoning' ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
  ) : step.type === 'tool_call' ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isFetch ? '#00E5C9' : '#DCB263'} strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ) : step.type === 'tool_result' ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isError ? '#ef4444' : '#00E5C9'} strokeWidth="2">{isError ? <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></> : <><polyline points="20 6 9 17 4 12"/></>}</svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  )

  const titleText = step.type === 'reasoning' ? 'Razonando'
    : step.type === 'tool_call' ? step.toolName
    : step.type === 'tool_result' ? `${step.toolName}${isError ? ' · error' : ' · ok'}`
    : 'Finalizado'

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <div className={`p-3 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.06)] ${borderColor} border-l-2 opacity-50 hover:opacity-95 transition-opacity ${isLast && isRunning ? 'animate-[msgFadeIn_0.3s_ease-out]' : ''}`}>
      <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2.5 w-full text-left">
        <div className="shrink-0">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] text-[#E5E5E5] font-medium truncate">{titleText}</span>
            {isLast && isRunning && step.type === 'tool_call' && (
              <span className="inline-flex gap-[2px]">
                {[0, 0.2, 0.4].map((d, i) => (
                  <span key={i} className="w-1 h-1 bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: d + 's', opacity: i === 0 ? 0.8 : 0.5 - i * 0.1 }} />
                ))}
              </span>
            )}
          </div>
          <div className="text-[0.55rem] text-[#666666] font-mono">{stepIndex}/{totalSteps}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" className={`transition-transform shrink-0 ${collapsed ? '' : 'rotate-180'}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {!collapsed && (
        <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.04)]">
          {step.type === 'tool_call' && step.toolArgs && (
            <div className="flex items-start gap-1.5">
              <div className="flex-1 text-[0.6rem] text-[#999999] font-mono bg-[rgba(0,0,0,0.25)] rounded px-2 py-1.5 whitespace-pre-wrap break-all overflow-x-auto" style={{ maxHeight: '120px' }}>
                {formatArgs(step.toolArgs)}
              </div>
              <button onClick={() => handleCopy(step.toolArgs!)} className="shrink-0 px-1.5 py-0.5 rounded text-[0.55rem] text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors border border-[rgba(255,255,255,0.06)] flex items-center gap-1" title="Copiar args">
                {copied ? <CheckIcon size={10} color="#00E5C9" /> : null}
                {copied ? 'Listo' : 'Copiar'}
              </button>
            </div>
          )}

          {step.type === 'tool_result' && step.toolResult && (
            <div>
              {step.toolWarning && (
                <div className="flex items-center gap-1 text-[0.55rem] text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded px-2 py-1 mb-1.5">
                  <WarningIcon size={10} color="#f59e0b" />
                  {step.toolWarning}
                </div>
              )}
              {step.toolResult.startsWith('[PENDIENTE') ? (
                <div className="flex gap-2 mt-1">
                  <button onClick={() => onConfirmTool?.(true)} className="px-3 py-1.5 rounded text-[0.65rem] font-semibold bg-[rgba(0,229,201,0.12)] border border-[rgba(0,229,201,0.3)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.2)] transition-colors">Allow</button>
                  <button onClick={() => onConfirmTool?.(false)} className="px-3 py-1.5 rounded text-[0.65rem] font-semibold bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors">Deny</button>
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <div className="flex-1 text-[0.6rem] text-[#E5E5E5] font-mono bg-[rgba(0,0,0,0.25)] rounded px-2 py-1.5 whitespace-pre-wrap overflow-x-auto" style={{ maxHeight: showFull ? 'none' : '140px' }}>
                    {showFull ? step.toolResult : (step.toolResult.slice(0, 800) + (step.toolResult.length > 800 ? '\n...' : ''))}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {step.toolResult.length > 800 && (
                      <button onClick={() => setShowFull(!showFull)} className="px-1.5 py-0.5 rounded text-[#00E5C9] hover:bg-[rgba(0,229,201,0.1)] transition-colors border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                        {showFull ? <ChevronUpIcon size={10} color="#00E5C9" /> : <ChevronDownIcon size={10} color="#00E5C9" />}
                      </button>
                    )}
                    <button onClick={() => handleCopy(step.toolResult!)} className="px-1.5 py-0.5 rounded text-[0.55rem] text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors border border-[rgba(255,255,255,0.06)] flex items-center gap-1" title="Copiar resultado">
                      {copied ? <CheckIcon size={10} color="#00E5C9" /> : null}
                      {copied ? 'Listo' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step.type === 'reasoning' && step.content && (
            <div className="text-[0.75rem] text-[#E5E5E5] leading-[1.6] whitespace-pre-wrap">{step.content}</div>
          )}

          {step.type === 'final' && (
            <div className="text-[0.65rem] text-[#666666] italic">Respuesta visible en el chat</div>
          )}
        </div>
      )}
    </div>
  )
}

function formatArgs(args: string): string {
  try {
    const parsed = JSON.parse(args)
    const simplified: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (k === 'content' && typeof v === 'string' && v.length > 100) {
        simplified[k] = v.slice(0, 100) + '...'
      } else if (k === 'path') {
        simplified[k] = v as string
      } else {
        simplified[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
    }
    return JSON.stringify(simplified, null, 2)
  } catch {
    return args
  }
}

// ── Document Tab ─────────────────────────────────────────────────────────────

function DocumentTabContent({ reports }: { reports: ReportFile[] }) {
  const [copied, setCopied] = useState(false)

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5" className="mx-auto mb-2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-[0.6875rem] text-[#666666]">El agente aún no ha generado ningún reporte.</p>
          <p className="text-[0.6rem] text-[#666666] mt-1 opacity-70">Pídele que escriba un archivo .md con los resultados.</p>
        </div>
      </div>
    )
  }

  const handleCopy = async (content: string) => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <div className={`${reports.length > 1 ? 'p-3 space-y-3' : 'h-full'}`}>
      {reports.map((r, i) => (
        <div key={i} className={`bg-[#0F0F0F] rounded-xl border border-[rgba(255,255,255,0.08)] border-l-2 border-l-[rgba(0,229,201,0.15)] overflow-hidden flex flex-col ${reports.length === 1 ? 'h-full' : ''}`}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.25)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="text-[0.7rem] text-[#00E5C9] font-mono truncate flex-1" title={r.path}>{r.path.split('/').pop()}</span>
            {r.written && <span className="flex items-center gap-1 text-[0.55rem] text-[#00E5C9] bg-[rgba(0,229,201,0.1)] px-1.5 py-0.5 rounded"><CheckIcon size={10} color="#00E5C9" /> escrito</span>}
            <button
              onClick={() => handleCopy(r.content)}
              className="shrink-0 px-2 py-1 rounded-md text-[0.55rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] transition-colors flex items-center gap-1"
              title="Copiar contenido"
            >
              {copied ? <CheckIcon size={10} color="#00E5C9" /> : null}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 bg-[#0F0F0F]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
            <Markdown content={r.content} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── References Tab ───────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function Favicon({ url, domain }: { url?: string; domain: string }) {
  const src = url
    ? `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=16`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  return (
    <img
      src={src}
      alt=""
      className="w-3.5 h-3.5 rounded shrink-0"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

function scoreColor(score: number): string {
  if (score >= 0.8) return 'bg-[rgba(0,229,201,0.12)] text-[#00E5C9]'
  if (score >= 0.5) return 'bg-[rgba(220,178,99,0.12)] text-[#DCB263]'
  return 'bg-[rgba(255,255,255,0.05)] text-[#999999]'
}

function scoreDot(score: number): string {
  if (score >= 0.8) return '#00E5C9'
  if (score >= 0.5) return '#DCB263'
  return '#666666'
}

function ReferencesTabContent({ sources }: { sources: SourceItem[] }) {
  const fetched = sources.filter(s => s.status === 'fetched').length
  const errors = sources.filter(s => s.status === 'error').length
  const pending = sources.filter(s => s.status === 'pending').length
  const avgScore = sources.length > 0
    ? sources.reduce((sum, s) => sum + (s.score ?? 0), 0) / sources.length
    : 0

  if (sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5" className="mx-auto mb-2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p className="text-[0.6875rem] text-[#666666]">Sin fuentes aún.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] text-[0.6rem] text-[#666666]">
        <span>{fetched > 0 && <span className="text-[#00E5C9]">{fetched} obtenida{fetched !== 1 ? 's' : ''}</span>}</span>
        {errors > 0 && <span className="text-[#ef4444]"> · {errors} error{errors !== 1 ? 'es' : ''}</span>}
        {pending > 0 && <span className="text-[#DCB263]"> · {pending} pendiente{pending !== 1 ? 's' : ''}</span>}
        <span className="ml-auto text-[#4a4a4a]">{sources.length} total</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(0,229,201,0.03)] border border-[rgba(0,229,201,0.08)] text-[0.6rem]">
        <span className="text-[#666666]">Relevancia promedio</span>
        <span className="ml-auto text-[#00E5C9] font-medium">{(avgScore * 100).toFixed(0)}%</span>
      </div>
      {sources.map((s, i) => (
        <div key={i} className="px-3 py-2.5 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            {s.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-[#DCB263] animate-pulse shrink-0" />}
            {s.status === 'fetched' && <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C9] shrink-0" />}
            {s.status === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />}
            {s.url && <Favicon url={s.url} domain={s.url} />}
            <span className="text-[0.7rem] text-[#E5E5E5] truncate flex-1">{s.title}</span>
            <span title={`Score: ${((s.score ?? 0) * 100).toFixed(0)}%`} className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.55rem] font-medium ${scoreColor(s.score ?? 0)}`}>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: scoreDot(s.score ?? 0) }} />
              {((s.score ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[0.6rem] text-[#00E5C9] truncate mt-0.5 hover:underline ml-[18px]">
              {extractDomain(s.url)}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
