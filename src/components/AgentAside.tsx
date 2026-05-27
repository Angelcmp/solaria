import { useState, useRef, useEffect } from 'react'
import type { AgentStep } from '../hooks/useAgent'

interface AgentAsideProps {
  steps: AgentStep[]
  isRunning: boolean
  liveThinking?: string
  workingDirectory?: string
  onClose: () => void
  onStop: () => void
  onConfirmTool?: (allow: boolean) => void
}

export default function AgentAside({ steps, isRunning, liveThinking, workingDirectory, onClose, onStop, onConfirmTool }: AgentAsideProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const hasFinalStep = steps.some(s => s.type === 'final')

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

  if (steps.length === 0 && !isRunning) return null

  const reasoningCount = steps.filter(s => s.type === 'reasoning').length

  return (
    <div className="flex flex-col bg-[#1C1B1B] border-l border-[rgba(255,255,255,0.04)] w-[480px] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 min-h-[40px] border-b border-[rgba(255,255,255,0.04)]">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#00E5C9] animate-pulse' : 'bg-[#DCB263]'}`} />
        <span className="text-[0.75rem] font-semibold text-[#E5E5E5]">Solaria Agent</span>
        <span className="text-[0.6rem] text-[#666666] font-mono">
          {isRunning ? 'ejecutando...' : hasFinalStep ? 'completado' : `${steps.length} paso${steps.length !== 1 ? 's' : ''}`}
        </span>
        {steps.length > 0 && (
          <span className="text-[0.5rem] text-[#4a4a4a] font-mono ml-auto mr-1">
            {steps.length}
          </span>
        )}

        {isRunning && (
          <button
            onClick={onStop}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#999999] hover:text-[#ef4444] transition-colors"
            title="Detener agente"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white transition-colors"
          title="Cerrar panel"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Scrollable steps */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}
      >
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
              <span className="text-[0.65rem] font-medium text-[#999999]">Razonando...</span>
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

      {/* Footer */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.04)] px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          <span className="text-[0.55rem] text-[#666666] font-mono truncate" title={workingDirectory || 'No especificado'}>
            {workingDirectory || 'No especificado'}
          </span>
        </div>
        <span className="text-[0.55rem] text-[#4a4a4a] font-mono shrink-0 ml-2">Solaria 0.1.0 beta</span>
      </div>
    </div>
  )
}

function StepCard({
  step, stepIndex, totalSteps, isLast, isRunning, onConfirmTool, autoCollapse,
}: {
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
  const isFinal = step.type === 'final'

  useEffect(() => {
    if (autoCollapse) setCollapsed(true)
  }, [autoCollapse])

  const borderColor = step.type === 'reasoning'
    ? 'border-l-[rgba(220,178,99,0.4)]'
    : step.type === 'tool_call'
      ? 'border-l-[#DCB263]'
      : step.type === 'tool_result'
        ? 'border-l-[#00E5C9]'
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
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className={`border-l-2 ${borderColor} pl-2 py-1 ${isLast && isRunning ? 'animate-[msgFadeIn_0.3s_ease-out]' : ''}`}>
      <div className="flex items-start gap-1.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left pt-0.5"
        >
          {icon}
          <span className="text-[0.65rem] font-medium text-[#999999] truncate">
            {step.type === 'reasoning' && 'Razonando'}
            {step.type === 'tool_call' && step.toolName && (
              <span><span className="text-[#DCB263]">→</span> {step.toolName}</span>
            )}
            {step.type === 'tool_result' && (
              <span>
                <span className="text-[#00E5C9]">✓</span> {step.toolName}
                {step.toolWarning && <span className="text-[#f59e0b] ml-1">⚠</span>}
              </span>
            )}
            {isFinal && 'Respuesta final → Chat central'}
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
              <button
                onClick={() => handleCopy(step.toolArgs!)}
                className="shrink-0 px-1 py-0.5 rounded text-[0.5rem] text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                title="Copiar args"
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>
          )}

          {step.type === 'tool_result' && step.toolResult && (
            <div>
              {step.toolWarning && (
                <div className="text-[0.55rem] text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded px-1.5 py-0.5 mb-1">
                  ⚠ {step.toolWarning}
                  {step.toolArgs && !step.toolResult.startsWith('[PENDIENTE') && (
                    <div className="mt-1 text-[0.5rem] text-[#999999] font-mono bg-[rgba(0,0,0,0.2)] rounded px-1 py-0.5 whitespace-pre-wrap break-all">
                      {formatArgs(step.toolArgs)}
                    </div>
                  )}
                </div>
              )}
              {step.toolResult.startsWith('[PENDIENTE') ? (
                <div>
                  {step.toolArgs && (
                    <div className="text-[0.55rem] text-[#999999] font-mono bg-[rgba(0,0,0,0.25)] rounded px-1.5 py-1 mb-1.5 whitespace-pre-wrap break-all">
                      {formatArgs(step.toolArgs)}
                    </div>
                  )}
                  <div className="flex gap-1.5 mt-1">
                    <button
                      onClick={() => onConfirmTool?.(true)}
                      className="px-2 py-1 rounded text-[0.6rem] font-semibold bg-[rgba(0,229,201,0.12)] border border-[rgba(0,229,201,0.3)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.2)] transition-colors"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => onConfirmTool?.(false)}
                      className="px-2 py-1 rounded text-[0.6rem] font-semibold bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1">
                  <div className="flex-1 text-[0.6rem] text-[#E5E5E5] font-mono bg-[rgba(0,0,0,0.25)] rounded px-1.5 py-1 mt-0.5 whitespace-pre-wrap overflow-x-auto" style={{ maxHeight: showFull ? 'none' : '130px' }}>
                    {showFull ? step.toolResult : (step.toolResult.slice(0, 800) + (step.toolResult.length > 800 ? '\n...' : ''))}
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                    {step.toolResult.length > 800 && (
                      <button
                        onClick={() => setShowFull(!showFull)}
                        className="px-1 py-0.5 rounded text-[0.5rem] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.1)] transition-colors"
                      >
                        {showFull ? '▲' : '▼'}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(step.toolResult!)}
                      className="px-1 py-0.5 rounded text-[0.5rem] text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                      title="Copiar resultado"
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step.type === 'reasoning' && step.content && (
            <div className="text-[0.6875rem] text-[#E5E5E5] leading-[1.5] mt-0.5 whitespace-pre-wrap">
              {step.content}
            </div>
          )}

          {isFinal && (
            <div className="text-[0.6rem] text-[#666666] italic mt-0.5">
              Respuesta visible en el chat central
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatArgs(args: string): string {
  try {
    const parsed = JSON.parse(args)
    return JSON.stringify(parsed, null, 2)
  } catch {
    // Not JSON — format as key:value pairs neatly
    const parts = args.split(', ').filter(Boolean)
    if (parts.length <= 1) return args
    return parts.map(p => `  ${p}`).join('\n')
  }
}
