import { useState, useRef, useEffect, useMemo } from 'react'
import type { Conversation } from '../hooks/useChat'
import type { AppSettings } from '../hooks/useSettings'

interface ProviderInfo {
  id: string
  label: string
  models: string[]
  local: boolean
}

interface ModelPickerProps {
  activeConversation?: Conversation | null
  settings: AppSettings
  providers: ProviderInfo[]
  onUpdateConvModel?: (convId: string, provider: string, model: string) => void
}

export default function ModelPicker({
  activeConversation,
  settings,
  providers,
  onUpdateConvModel,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeProvider = activeConversation?.provider || settings.defaultProvider
  const activeModel = activeConversation?.model || settings.defaultModel

  const activeProviderLabel = useMemo(() => {
    return providers.find(p => p.id === activeProvider)?.label || activeProvider
  }, [providers, activeProvider])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      setQuery('')
      inputRef.current.focus()
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return providers
    return providers
      .map(p => ({
        ...p,
        models: p.models.filter(m => m.toLowerCase().includes(q)),
      }))
      .filter(p => p.models.length > 0 || p.label.toLowerCase().includes(q))
  }, [providers, query])

  const handleSelect = (providerId: string, model: string) => {
    if (activeConversation?.id && onUpdateConvModel) {
      onUpdateConvModel(activeConversation.id, providerId, model)
    }
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-[3px] rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(0,229,201,0.07)] text-[#00E5C9] text-[0.65rem] leading-none hover:bg-[rgba(0,229,201,0.12)] transition-colors cursor-pointer whitespace-nowrap"
      >
        <span className="max-w-[110px] truncate">{activeProviderLabel}</span>
        <span className="text-[0.55rem] opacity-70 max-w-[80px] truncate">{activeModel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-[300px] max-h-[360px] overflow-hidden bg-[#151515] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] z-50 flex flex-col">
          {/* Search */}
          <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.06)] focus-within:border-[rgba(255,255,255,0.08)] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar modelo..."
                className="flex-1 bg-transparent border-none outline-none text-[0.75rem] text-white placeholder-[#555555]"
              />
              {query && (
                <button onClick={() => setQuery('')} className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-[0.65rem] text-[#666666]">Sin resultados</p>
              </div>
            )}
            {filtered.map(p => (
              <div key={p.id}>
                <div className="flex items-center gap-2 px-3 py-1.5 mt-1 first:mt-0">
                  <span className="text-[0.55rem] font-semibold uppercase tracking-[0.06em] text-[#666666]">{p.label}</span>
                  {p.local && <span className="text-[0.45rem] px-1 py-0.5 rounded bg-[rgba(0,229,201,0.1)] text-[#00E5C9]">local</span>}
                </div>
                {p.models.map(m => {
                  const isActive = activeProvider === p.id && activeModel === m
                  return (
                    <button
                      key={m}
                      onClick={() => handleSelect(p.id, m)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-[rgba(0,229,201,0.1)] text-[#00E5C9]'
                          : 'text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)]'
                      }`}
                    >
                      <span className={`text-[0.6875rem] ${isActive ? 'font-medium' : ''}`}>{m}</span>
                      {isActive && (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[rgba(0,229,201,0.15)] text-[#00E5C9]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-[rgba(255,255,255,0.06)]">
            <p className="text-[0.55rem] text-[#555555]">
              {activeProviderLabel} · {activeModel}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
