import { useState, useRef, useEffect, useMemo } from 'react'
import type { AgentStep } from '../hooks/useAgent'
import Markdown from '../lib/Markdown'

interface ResearchAsideProps {
  steps: AgentStep[]
  isRunning: boolean
  liveThinking?: string
  onClose: () => void
  onStop?: () => void
  onConfirmTool?: (allow: boolean) => void
}

type Tab = 'agent' | 'report' | 'sources'

interface SourceItem {
  url: string
  title: string
  status: 'pending' | 'fetched' | 'error'
}

interface ReportFile {
  path: string
  content: string
  written: boolean
}

function extractSources(steps: AgentStep[]): SourceItem[] {
  const sources: SourceItem[] = []
  const seen = new Set<string>()

  for (const step of steps) {
    if (step.type === 'tool_call' && step.toolArgs) {
      try {
        const args = JSON.parse(step.toolArgs)
        if (step.toolName === 'web_search' && args.query) {
          const key = `search:${args.query}`
          if (!seen.has(key)) {
            seen.add(key)
            sources.push({ url: '', title: `Búsqueda: ${args.query.slice(0, 60)}`, status: 'pending' })
          }
        }
        if (step.toolName === 'fetch_url' && args.url) {
          if (!seen.has(args.url)) {
            seen.add(args.url)
            const title = args.url.replace(/https?:\/\//, '').split('/')[0] || args.url
            sources.push({ url: args.url, title, status: 'pending' })
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

function extractReport(steps: AgentStep[]): ReportFile | null {
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
        return { path, content, written }
      } catch {}
    }
  }
  return null
}

export default function ResearchAside(props: ResearchAsideProps) {
  const { steps, isRunning, liveThinking, onClose, onStop, onConfirmTool } = props
  const [tab, setTab] = useState<Tab>('agent')

  const sources = useMemo(() => extractSources(steps), [steps])
  const report = useMemo(() => extractReport(steps), [steps])

  const hasContent = steps.length > 0 || isRunning

  if (!hasContent) return null

  return (
    <div className="flex flex-col bg-[#1C1B1B] border-l border-[rgba(255,255,255,0.04)] w-[480px] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 min-h-[40px] border-b border-[rgba(255,255,255,0.04)]">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#00E5C9] animate-pulse' : 'bg-[#DCB263]'}`} />
        <span className="text-[0.75rem] font-semibold text-[#E5E5E5]">Solaria Research</span>
        <span className="text-[0.6rem] text-[#666666] font-mono">
          {isRunning ? 'investigando...' : steps.some(s => s.type === 'final') ? 'completado' : `${steps.length} paso${steps.length !== 1 ? 's' : ''}`}
        </span>
        {isRunning && onStop && (
          <button onClick={onStop} className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#999999] hover:text-[#ef4444] transition-colors" title="Detener">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.04)]">
        {([
          { id: 'agent' as Tab, label: 'Agente', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' },
          { id: 'report' as Tab, label: 'Reporte', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', badge: report ? 'dot' : undefined },
          { id: 'sources' as Tab, label: 'Fuentes', icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', badge: sources.length > 0 ? String(sources.length) : undefined },
        ] as { id: Tab; label: string; icon: string; badge?: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[0.65rem] font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#00E5C9] text-[#00E5C9]'
                : 'border-transparent text-[#666666] hover:text-[#999999]'
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: t.icon }} />
            <span>{t.label}</span>
            {t.badge === 'dot' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C9]" />
            ) : t.badge ? (
              <span className="text-[0.5rem] px-1 rounded bg-[rgba(0,229,201,0.1)] text-[#00E5C9]">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
        {tab === 'agent' && (
          <AgentTabContent steps={steps} isRunning={isRunning} liveThinking={liveThinking} onConfirmTool={onConfirmTool} />
        )}
        {tab === 'report' && (
          <ReportTabContent report={report} />
        )}
        {tab === 'sources' && (
          <SourcesTabContent sources={sources} />
        )}
      </div>
    </div>
  )
}

// ── Agent Tab ────────────────────────────────────────────────────────────────

function AgentTabContent({ steps, isRunning, liveThinking, onConfirmTool }: {
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

  const reasoningCount = steps.filter(s => s.type === 'reasoning').length

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto py-2 px-2 space-y-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
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
          className="sticky bottom-0 w-full py-1 text-[0.55rem] text-[#00E5C9] bg-[rgba(0,229,201,0.06)] border border-[rgba(0,229,201,0.15)] rounded hover:bg-[rgba(0,229,201,0.1)] transition-colors"
        >
          ↓ Ir al último paso
        </button>
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
          autoCollapse={step.type === 'reasoning' && reasoningCount > 3 && i < steps.length - 3}
        />
      ))}
      {liveThinking && isRunning && (
        <div className="border-l-2 border-l-[rgba(220,178,99,0.4)] pl-2 py-1 animate-[msgFadeIn_0.3s_ease-out]">
          <div className="flex items-center gap-1.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span className="text-[0.65rem] font-medium text-[#999999]">Investigando...</span>
            <div className="flex gap-[2px] ml-1">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} className="w-1 h-1 bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
          </div>
          <div className="text-[0.6875rem] text-[#E5E5E5] leading-[1.5] mt-0.5 whitespace-pre-wrap">
            {liveThinking}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step Card (same as AgentAside) ────────────────────────────────────────────

function StepCard({ step, stepIndex, totalSteps, isLast, isRunning, onConfirmTool, autoCollapse }: {
  step: AgentStep
  stepIndex: number
  totalSteps: number
  isLast: boolean
  isRunning: boolean
  onConfirmTool?: (allow: boolean) => void
  autoCollapse: boolean
}) {
  const [collapsed, setCollapsed] = useState(step.type === 'final' || autoCollapse)
  const [showFull, setShowFull] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (autoCollapse) setCollapsed(true)
  }, [autoCollapse])

  const borderColor = step.type === 'reasoning' ? 'border-l-[rgba(220,178,99,0.4)]'
    : step.type === 'tool_call' ? 'border-l-[#DCB263]'
    : step.type === 'tool_result' ? 'border-l-[#00E5C9]'
    : 'border-l-[#DCB263]'

  const icon = step.type === 'reasoning' ? (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
  ) : step.type === 'tool_call' ? (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ) : step.type === 'tool_result' ? (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
  ) : (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  )

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <div className={`border-l-2 ${borderColor} pl-2 py-1 ${isLast && isRunning ? 'animate-[msgFadeIn_0.3s_ease-out]' : ''}`}>
      <div className="flex items-start gap-1.5">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left pt-0.5">
          {icon}
          <span className="text-[0.65rem] font-medium text-[#999999] truncate">
            {step.type === 'reasoning' && 'Razonando'}
            {step.type === 'tool_call' && step.toolName && (
              <span className="flex items-center gap-1">
                <span className="text-[#DCB263]">→</span> {step.toolName}
                {isLast && isRunning && (
                  <span className="inline-flex gap-[2px]">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} className="w-1 h-1 bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: d + 's', opacity: i === 0 ? 0.8 : 0.5 - i * 0.1 }} />
                    ))}
                  </span>
                )}
              </span>
            )}
            {step.type === 'tool_result' && (
              <span><span className="text-[#00E5C9]">✓</span> {step.toolName}{step.toolWarning && <span className="text-[#f59e0b] ml-1">⚠</span>}</span>
            )}
            {step.type === 'final' && 'Respuesta final → Chat'}
          </span>
          <span className="text-[0.45rem] text-[#4a4a4a] font-mono shrink-0 ml-auto mr-1">{stepIndex}/{totalSteps}</span>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" className={`transition-transform shrink-0 ${collapsed ? '' : 'rotate-180'}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="mt-1">
          {step.type === 'tool_call' && step.toolArgs && (
            <div className="flex items-start gap-1">
              <div className="flex-1 text-[0.6rem] text-[#999999] font-mono bg-[rgba(0,0,0,0.25)] rounded px-1.5 py-1 whitespace-pre-wrap break-all overflow-x-auto" style={{ maxHeight: '120px' }}>
                {formatArgs(step.toolArgs)}
              </div>
              <button onClick={() => handleCopy(step.toolArgs!)} className="shrink-0 px-1 py-0.5 rounded text-[0.5rem] text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors" title="Copiar args">{copied ? '✓' : '📋'}</button>
            </div>
          )}

          {step.type === 'tool_result' && step.toolResult && (
            <div>
              {step.toolWarning && (
                <div className="text-[0.55rem] text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded px-1.5 py-0.5 mb-1">
                  ⚠ {step.toolWarning}
                </div>
              )}
              {step.toolResult.startsWith('[PENDIENTE') ? (
                <div>
                  <div className="flex gap-1.5 mt-1">
                    <button onClick={() => onConfirmTool?.(true)} className="px-2 py-1 rounded text-[0.6rem] font-semibold bg-[rgba(0,229,201,0.12)] border border-[rgba(0,229,201,0.3)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.2)] transition-colors">Allow</button>
                    <button onClick={() => onConfirmTool?.(false)} className="px-2 py-1 rounded text-[0.6rem] font-semibold bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors">Deny</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1">
                  <div className="flex-1 text-[0.6rem] text-[#E5E5E5] font-mono bg-[rgba(0,0,0,0.25)] rounded px-1.5 py-1 mt-0.5 whitespace-pre-wrap overflow-x-auto" style={{ maxHeight: showFull ? 'none' : '130px' }}>
                    {showFull ? step.toolResult : (step.toolResult.slice(0, 800) + (step.toolResult.length > 800 ? '\n...' : ''))}
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                    {step.toolResult.length > 800 && (
                      <button onClick={() => setShowFull(!showFull)} className="px-1 py-0.5 rounded text-[0.5rem] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.1)] transition-colors">
                        {showFull ? '▲' : '▼'}
                      </button>
                    )}
                    <button onClick={() => handleCopy(step.toolResult!)} className="px-1 py-0.5 rounded text-[0.5rem] text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors" title="Copiar resultado">{copied ? '✓' : '📋'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step.type === 'reasoning' && step.content && (
            <div className="text-[0.6875rem] text-[#E5E5E5] leading-[1.5] mt-0.5 whitespace-pre-wrap">{step.content}</div>
          )}

          {step.type === 'final' && (
            <div className="text-[0.6rem] text-[#666666] italic mt-0.5">Respuesta visible en el chat</div>
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

// ── Report Tab ───────────────────────────────────────────────────────────────

function ReportTabContent({ report }: { report: ReportFile | null }) {
  if (!report) {
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

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[rgba(255,255,255,0.06)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span className="text-[0.65rem] text-[#00E5C9] font-mono truncate flex-1" title={report.path}>{report.path.split('/').pop()}</span>
        {report.written && <span className="text-[0.5rem] text-[#00E5C9] bg-[rgba(0,229,201,0.1)] px-1 rounded">✓ escrito</span>}
      </div>
      <div className="bg-[rgba(0,0,0,0.2)] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]">
        <Markdown content={report.content} />
      </div>
    </div>
  )
}

// ── Sources Tab ──────────────────────────────────────────────────────────────

function SourcesTabContent({ sources }: { sources: SourceItem[] }) {
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
    <div className="p-3 space-y-1.5">
      {sources.map((s, i) => (
        <div key={i} className="px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            {s.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-[#DCB263] animate-pulse shrink-0" />}
            {s.status === 'fetched' && <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C9] shrink-0" />}
            {s.status === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />}
            <span className="text-[0.65rem] text-[#E5E5E5] truncate flex-1">{s.title}</span>
          </div>
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[0.55rem] text-[#00E5C9] truncate mt-0.5 hover:underline">
              {s.url}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
