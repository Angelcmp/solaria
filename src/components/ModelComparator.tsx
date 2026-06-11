import { useState, useRef, useEffect } from 'react'
import { estimateTokens, estimateCost, formatCost } from '../lib/pricing'
import type { ComparisonRound } from '../hooks/useComparison'
import Markdown from '../lib/Markdown'

interface ModelComparatorProps {
  models: { id: string; label: string; models: string[]; local: boolean }[]
  apiKeys: Record<string, string>
  temperature: number
  topP: number
  maxTokens: number
  onClose: () => void
  onStartComparison: (
    prompt: string,
    models: { providerId: string; modelName: string; apiKey?: string }[],
    temperature: number,
    topP: number,
    maxTokens: number,
  ) => void
  currentRound: ComparisonRound | null
  isStreaming: boolean
  onVote: (label: string) => void
  onReveal: () => void
}

export default function ModelComparator({
  models: providerList,
  apiKeys,
  temperature,
  topP,
  maxTokens,
  onClose,
  onStartComparison,
  currentRound,
  isStreaming,
  onVote,
  onReveal,
}: ModelComparatorProps) {
  const [selectedModels, setSelectedModels] = useState<{ providerId: string; modelName: string }[]>([])
  const [prompt, setPrompt] = useState('')
  const [started, setStarted] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isStreaming && started && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isStreaming, started])

  const toggleModel = (providerId: string, modelName: string) => {
    setSelectedModels(prev => {
      const existing = prev.findIndex(m => m.providerId === providerId && m.modelName === modelName)
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing)
      }
      if (prev.length >= 4) return prev
      return [...prev, { providerId, modelName }]
    })
  }

  const isSelected = (providerId: string, modelName: string) =>
    selectedModels.some(m => m.providerId === providerId && m.modelName === modelName)

  const handleStart = () => {
    if (!prompt.trim() || selectedModels.length < 2 || isStreaming) return
    setStarted(true)
    const modelsWithKeys = selectedModels.map(m => ({
      providerId: m.providerId,
      modelName: m.modelName,
      apiKey: m.providerId !== 'ollama' ? apiKeys[m.providerId] || '' : undefined,
    }))
    onStartComparison(prompt.trim(), modelsWithKeys, temperature, topP, maxTokens)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming && !started) {
      e.preventDefault()
      handleStart()
    }
  }

  const getProviderLabel = (id: string) => providerList.find(p => p.id === id)?.label || id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[860px] h-[88vh] bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[rgba(255,255,255,0.06)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><line x1="16" y1="5" x2="18" y2="7"/><line x1="17" y1="4" x2="18" y2="5"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">Comparador ciego de modelos</h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
          {!started ? (
            <>
              <div className="p-3 rounded-xl bg-[rgba(0,229,201,0.04)] border border-[rgba(0,229,201,0.1)]">
                <p className="text-[0.6875rem] text-[#999999] leading-relaxed">
                  Las respuestas se etiquetan como "Modelo A" y "Modelo B" sin revelar cuál es cuál. Responde la misma pregunta a todos los modelos, compara los resultados y solo después descubre qué modelo generó cada respuesta.
                </p>
              </div>

              <div>
                <label className="block text-[0.65rem] font-medium text-[#999999] mb-2">
                  Selecciona 2-4 modelos para comparar
                  {selectedModels.length > 0 && <span className="ml-1 text-[#00E5C9]">({selectedModels.length})</span>}
                </label>
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
                  {providerList.map(provider => (
                    <div key={provider.id}>
                      <div className="text-[0.55rem] text-[#555555] uppercase tracking-[0.05em] font-medium mb-1.5 flex items-center gap-1.5">
                        {provider.label}
                        {provider.local && <span className="text-[0.45rem] px-1 rounded bg-[rgba(0,229,201,0.08)] text-[#00E5C9]">local</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {provider.models.map(model => {
                          const sel = isSelected(provider.id, model)
                          return (
                            <button
                              key={`${provider.id}/${model}`}
                              onClick={() => toggleModel(provider.id, model)}
                              className={`px-2.5 py-1 rounded-md text-[0.6rem] font-mono transition-all border ${
                                sel
                                  ? 'bg-[rgba(0,229,201,0.1)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]'
                                  : 'bg-[#222] border-[rgba(255,255,255,0.04)] text-[#999999] hover:border-[rgba(255,255,255,0.1)] hover:text-[#E5E5E5]'
                              }`}
                            >
                              {model}
                              {sel && <span className="ml-1 text-[0.5rem]">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[0.65rem] font-medium text-[#999999] mb-2">Escribe tu pregunta</label>
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe la misma pregunta que se enviará a todos los modelos..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.75rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors resize-none"
                  style={{ fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif" }}
                  autoFocus
                />
              </div>

              <button
                onClick={handleStart}
                disabled={prompt.trim().length === 0 || selectedModels.length < 2}
                className="w-full py-2.5 rounded-lg font-medium text-[0.75rem] transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[linear-gradient(135deg,#00E5C9,#DCB263)] text-[#131313] hover:shadow-[0_0_20px_rgba(0,229,201,0.3),0_0_6px_rgba(220,178,99,0.2)] hover:scale-[1.01] active:scale-[0.99]"
              >
                Comparar ({selectedModels.length} modelos)
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Prompt display */}
              <div className="p-3 rounded-xl bg-[rgba(220,178,99,0.06)] border border-[rgba(220,178,99,0.12)]">
                <div className="text-[0.55rem] text-[#DCB263] uppercase tracking-[0.05em] font-medium mb-1">Pregunta</div>
                <div className="text-[0.6875rem] text-[#E5E5E5]">{currentRound?.prompt}</div>
              </div>

              {currentRound && (
                <>
                  {/* Response cards side by side */}
                  <div className={`grid gap-3 ${currentRound.responses.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                    {currentRound.responses.map((resp, i) => (
                      <div key={resp.blindLabel} className="flex flex-col rounded-xl bg-[#222] border border-[rgba(255,255,255,0.06)] overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,255,255,0.04)] bg-[#1A1A1A]">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[0.55rem] font-bold uppercase tracking-[0.05em] ${
                              i === 0 ? 'bg-[rgba(0,229,201,0.1)] text-[#00E5C9]' : 'bg-[rgba(220,178,99,0.1)] text-[#DCB263]'
                            }`}>
                              {resp.blindLabel}
                            </span>
                            {isStreaming && resp.content === '' && (
                              <div className="flex gap-[3px]">
                                {[0, 0.2, 0.4].map(delay => (
                                  <div key={delay} className="w-1 h-1 bg-[#DCB263] rounded-full animate-[typingDot_1.4s_ease-in-out_infinite]" style={{ animationDelay: delay + 's' }} />
                                ))}
                              </div>
                            )}
                            {!isStreaming && resp.error && (
                              <span className="text-[0.5rem] text-[#ef4444]">Error</span>
                            )}
                          </div>
                          {!isStreaming && resp.latencyMs > 0 && (
                            <span className="text-[0.5rem] text-[#555555] font-mono">
                              {resp.latencyMs < 1000 ? `${resp.latencyMs}ms` : `${(resp.latencyMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto max-h-[400px]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
                          {resp.content ? (
                            resp.error ? (
                              <div className="text-[0.7rem] text-[#ef4444]">{resp.content}</div>
                            ) : (
                              <Markdown content={resp.content} compact />
                            )
                          ) : isStreaming ? (
                            <span className="text-[0.7rem] text-[#555555] italic">Esperando respuesta...</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Voting (when done streaming, not revealed, not voted) */}
                  {!isStreaming && !currentRound.revealed && !currentRound.voted && !currentRound.responses.some(r => r.error) && (
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <span className="text-[0.65rem] text-[#999999]">¿Cuál respuesta prefieres?</span>
                      {currentRound.responses.map(resp => (
                        <button
                          key={resp.blindLabel}
                          onClick={() => onVote(resp.blindLabel)}
                          className="px-3 py-1.5 rounded-lg text-[0.7rem] font-medium bg-[#222] border border-[rgba(255,255,255,0.08)] text-[#E5E5E5] hover:bg-[rgba(0,229,201,0.08)] hover:border-[rgba(0,229,201,0.25)] hover:text-[#00E5C9] transition-all"
                        >
                          👍 {resp.blindLabel}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* After voting / reveal */}
                  {currentRound.voted && !currentRound.revealed && (
                    <div className="flex items-center justify-center pt-1">
                      <button
                        onClick={onReveal}
                        className="px-4 py-2 rounded-lg text-[0.7rem] font-medium bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.2)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.15)] transition-all"
                      >
                        🔍 Revelar identidades
                      </button>
                    </div>
                  )}

                  {/* Revealed results */}
                  {currentRound.revealed && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-[rgba(0,229,201,0.04)] border border-[rgba(0,229,201,0.1)]">
                        <div className="text-[0.55rem] text-[#00E5C9] uppercase tracking-[0.05em] font-medium mb-2">Resultado</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[0.65rem]">
                            <thead>
                              <tr className="text-[#999999] text-left border-b border-[rgba(255,255,255,0.06)]">
                                <th className="pb-2 font-medium">Etiqueta</th>
                                <th className="pb-2 font-medium">Modelo real</th>
                                <th className="pb-2 font-medium">Tokens</th>
                                <th className="pb-2 font-medium">Latencia</th>
                                <th className="pb-2 font-medium">Costo</th>
                                <th className="pb-2 font-medium">Voto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentRound.responses.map(resp => {
                                const info = currentRound.blindMap.find(bm => bm.label === resp.blindLabel)
                                const realModel = info ? `${getProviderLabel(info.providerId)} / ${info.modelName}` : '—'
                                const tokens = estimateTokens(resp.content)
                                const cost = info ? estimateCost(info.modelName, 0, tokens) : null
                                const costStr = cost ? formatCost(cost.totalCost) : 'local'
                                const won = currentRound.voted === resp.blindLabel
                                return (
                                  <tr key={resp.blindLabel} className={`border-b border-[rgba(255,255,255,0.03)] ${won ? 'text-[#DCB263]' : 'text-[#E5E5E5]'}`}>
                                    <td className="py-2.5 font-bold">{resp.blindLabel}</td>
                                    <td className="py-2.5 font-mono text-[0.6rem]">{realModel}</td>
                                    <td className="py-2.5 font-mono text-[#999999]">~{tokens}</td>
                                    <td className="py-2.5 font-mono text-[#999999]">{resp.latencyMs < 1000 ? `${resp.latencyMs}ms` : `${(resp.latencyMs / 1000).toFixed(1)}s`}</td>
                                    <td className="py-2.5 font-mono text-[#999999]">{costStr}</td>
                                    <td className="py-2.5">{won ? '🏆 Ganador' : resp.error ? '❌ Error' : '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* New round button */}
                  {!isStreaming && currentRound.revealed && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          setStarted(false)
                          setPrompt('')
                          setSelectedModels([])
                        }}
                        className="px-4 py-2 rounded-lg text-[0.7rem] font-medium bg-[#222] border border-[rgba(255,255,255,0.08)] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] transition-all"
                      >
                        🔄 Nueva comparación
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
