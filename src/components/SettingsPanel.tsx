import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ApiKeys } from '../hooks/useSettings'
import type { AgentConfig } from '../hooks/useAgent'
import type { Lang } from '../lib/i18n'
import { t } from '../lib/i18n'

interface SettingsPanelProps {
  settings: AppSettings
  initialTab?: 'general' | 'providers' | 'search' | 'skills' | 'audit'
  onClose: () => void
  onUpdate: (updates: Partial<AppSettings>) => void
  onUpdateApiKey: (provider: keyof ApiKeys, key: string) => void
  onUpdateTavilyKey: (key: string) => void
  onUpdateProvider: (provider: AppSettings['defaultProvider'], model: string) => void
  agentConfig?: AgentConfig
  onUpdateAgentConfig?: (updates: Partial<AgentConfig>) => void
}

const PROVIDERS: { id: AppSettings['defaultProvider']; label: string; models: string[]; isLocal: boolean }[] = [
  { id: 'ollama', label: 'Ollama (Local)', models: ['qwen3.5', 'llama3.2', 'llama3.1', 'mistral', 'phi3', 'deepseek-r1', 'gemma3', 'gemma4'], isLocal: true },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-5.5', 'o1', 'o3-mini'], isLocal: false },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-7'], isLocal: false },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'], isLocal: false },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-4-scout-17b-16e-instruct'], isLocal: false },
  { id: 'google', label: 'Google', models: ['gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-pro-preview-03-25'], isLocal: false },
  { id: 'cohere', label: 'Cohere', models: ['command-r7b-12-2024', 'command-r-plus-08-2024'], isLocal: false },
  { id: 'kimi', label: 'Kimi (Moonshot)', models: ['kimi-k2.6', 'kimi-k2-0905-preview'], isLocal: false },
  { id: 'glm', label: 'GLM (Z.AI)', models: ['glm-4.7', 'glm-4.7-flash', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.5', 'glm-4.5-flash'], isLocal: false },
]

const TAB_ICONS: Record<string, string> = {
  general: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  providers: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M11 8v3m0 4h.01"/></svg>',
  skills: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  audit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
}

const TABS: { id: 'general' | 'providers' | 'search' | 'skills' | 'audit'; labelKey: string }[] = [
  { id: 'general', labelKey: 'settings.general' },
  { id: 'providers', labelKey: 'settings.providers' },
  { id: 'search', labelKey: 'settings.search' },
  { id: 'skills', labelKey: '' },
  { id: 'audit', labelKey: 'settings.audit' },
]

export default function SettingsPanel({
  settings,
  initialTab,
  onClose,
  onUpdate,
  onUpdateApiKey,
  onUpdateTavilyKey,
  onUpdateProvider,
  agentConfig,
  onUpdateAgentConfig,
}: SettingsPanelProps) {
  const lang = settings.language as Lang
  const [tab, setTab] = useState<'general' | 'providers' | 'search' | 'skills' | 'audit'>(initialTab || 'general')
  const [selectedProvider, setSelectedProvider] = useState<AppSettings['defaultProvider']>('openai')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[720px] h-[85vh] bg-[#1C1B1B] border border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <h2 className="text-sm font-semibold text-white">{t('settings.title', lang)}</h2>
          <button onClick={onClose} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-[150px] shrink-0 border-r border-[rgba(255,255,255,0.06)] flex flex-col py-2">
            <div className="text-[0.55rem] text-[#666666] uppercase tracking-[0.06em] px-4 pb-2 border-b border-[rgba(255,255,255,0.04)] mb-1">Navegación</div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
              {TABS.map(tabKey => (
                <button
                  key={tabKey.id}
                  onClick={() => setTab(tabKey.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[0.6875rem] font-medium transition-all duration-150 ${
                    tab === tabKey.id
                      ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border border-[rgba(0,229,201,0.2)]'
                      : 'text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#E5E5E5] border border-transparent'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: (TAB_ICONS[tabKey.id] || '').replace('width="16"', 'width="14"').replace('height="16"', 'height="14"') +
                      '<span>' + (tabKey.id === 'skills' ? 'Skills' : t(tabKey.labelKey, lang)) + '</span>'
                  }}
                />
              ))}
            </div>
            <div className="px-4 pt-2 mt-1 border-t border-[rgba(255,255,255,0.04)]">
              <div className="text-[0.5rem] text-[#4a4a4a]">Solaria Agent v0.3.0</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
            {tab === 'general' && (
              <>
                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1.5 uppercase tracking-[0.05em]">Proveedor por defecto</label>
                  <p className="text-[0.625rem] text-[#666666] mb-2">Ollama usa modelos locales descargados en tu PC. Los demás proveedores requieren tu API key (BYOK).</p>

                  <div className="text-[0.625rem] text-[#00E5C9] font-medium mb-1.5">Local</div>
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {PROVIDERS.filter(p => p.isLocal).map(p => (
                      <button
                        key={p.id}
                        onClick={() => onUpdateProvider(p.id, settings.defaultProvider === p.id ? settings.defaultModel : p.models[0])}
                        className={`px-2 py-1.5 rounded-md text-[0.6875rem] font-medium transition-colors ${
                          settings.defaultProvider === p.id
                            ? 'bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9]'
                            : 'bg-[#2A2A2A] border border-transparent text-[#E5E5E5] hover:bg-[#353535]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-[0.625rem] text-[#DCB263] font-medium mb-1.5">Cloud (BYOK)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PROVIDERS.filter(p => !p.isLocal).map(p => (
                      <button
                        key={p.id}
                        onClick={() => onUpdateProvider(p.id, settings.defaultProvider === p.id ? settings.defaultModel : p.models[0])}
                        className={`px-2 py-1.5 rounded-md text-[0.6875rem] font-medium transition-colors ${
                          settings.defaultProvider === p.id
                            ? 'bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9]'
                            : 'bg-[#2A2A2A] border border-transparent text-[#E5E5E5] hover:bg-[#353535]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1.5 uppercase tracking-[0.05em]">Modelo por defecto</label>
                  <div className="flex flex-wrap gap-1">
                    {PROVIDERS.find(p => p.id === settings.defaultProvider)?.models.map(m => (
                      <button
                        key={m}
                        onClick={() => onUpdate({ defaultModel: m })}
                        className={`px-2 py-1 rounded-md text-[0.6875rem] font-mono transition-colors ${
                          settings.defaultModel === m
                            ? 'bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9]'
                            : 'bg-[#2A2A2A] border border-transparent text-[#E5E5E5] hover:bg-[#353535]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <label className="block text-[0.6875rem] font-medium text-[#00E5C9] mb-2 uppercase tracking-[0.05em]">Parámetros del modelo</label>

                  <div className="mb-3">
                    <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1">
                      Temperatura: {settings.temperature.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={settings.temperature}
                      onChange={(e) => onUpdate({ temperature: Number(e.target.value) })}
                      className="w-full accent-[#DCB263]"
                    />
                    <div className="flex justify-between text-[0.55rem] text-[#666666]">
                      <span>Preciso (0)</span>
                      <span>Creativo (2)</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1">
                      Top P: {settings.topP.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.topP}
                      onChange={(e) => onUpdate({ topP: Number(e.target.value) })}
                      className="w-full accent-[#DCB263]"
                    />
                    <div className="flex justify-between text-[0.55rem] text-[#666666]">
                      <span>Estricto (0)</span>
                      <span>Flexible (1)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1">
                      Max tokens: {settings.maxTokens}
                    </label>
                    <input
                      type="range"
                      min={64}
                      max={8192}
                      step={64}
                      value={settings.maxTokens}
                      onChange={(e) => onUpdate({ maxTokens: Number(e.target.value) })}
                      className="w-full accent-[#DCB263]"
                    />
                    <div className="flex justify-between text-[0.55rem] text-[#666666]">
                      <span>64</span>
                      <span>8192</span>
                    </div>
                  </div>
                </div>

                {settings.defaultProvider === 'ollama' && (
                  <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                    <label className="block text-[0.6875rem] font-medium text-[#00E5C9] mb-2 uppercase tracking-[0.05em]">Gestión de modelos Ollama</label>
                    <ModelManager />
                  </div>
                )}

                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1.5 uppercase tracking-[0.05em]">Idioma</label>
                  <div className="flex gap-2">
                    {([['es', 'Español'], ['en', 'English']] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => onUpdate({ language: value })}
                        className={`px-3 py-1.5 rounded-md text-[0.75rem] font-medium transition-colors ${
                          settings.language === value
                            ? 'bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9]'
                            : 'bg-[#2A2A2A] border border-transparent text-[#E5E5E5] hover:bg-[#353535]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">Ollama Host</label>
                  <input
                    value={settings.ollamaHost}
                    onChange={(e) => onUpdate({ ollamaHost: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-white outline-none focus:border-[#DCB263] transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1.5 uppercase tracking-[0.05em]">Almacenamiento</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        localStorage.removeItem('solaria-conversations')
                        window.location.reload()
                      }}
                      className="px-3 py-1.5 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[0.75rem] text-[#ef4444] font-medium hover:bg-[rgba(239,68,68,0.2)] transition-colors"
                    >
                      Limpiar historial
                    </button>
                    <button
                      onClick={async () => {
                        const data = localStorage.getItem('solaria-conversations')
                        if (!data) return
                        const blob = new Blob([data], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `solaria-chats-${Date.now()}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="px-3 py-1.5 rounded-md bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-[#E5E5E5] font-medium hover:bg-[#353535] transition-colors"
                    >
                      Exportar conversaciones
                    </button>
                    <button
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = '.json'
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (!file) return
                          try {
                            const text = await file.text()
                            const parsed = JSON.parse(text)
                            if (!Array.isArray(parsed)) throw new Error('Formato inválido')
                            const existing = localStorage.getItem('solaria-conversations')
                            const existingArr = existing ? JSON.parse(existing) : []
                            localStorage.setItem('solaria-conversations', JSON.stringify([...parsed, ...existingArr]))
                            window.location.reload()
                          } catch {
                            alert('Error: archivo JSON inválido')
                          }
                        }
                        input.click()
                      }}
                      className="px-3 py-1.5 rounded-md bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-[#E5E5E5] font-medium hover:bg-[#353535] transition-colors"
                    >
                      Importar conversaciones
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <label className="block text-[0.6875rem] font-medium text-[#00E5C9] mb-2 uppercase tracking-[0.05em]">Modo Agente</label>
                  {agentConfig && onUpdateAgentConfig && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                        <div>
                          <div className="text-[0.75rem] font-medium text-white">Activar agente</div>
                          <div className="text-[0.625rem] text-[#999999]">Permite al agente usar herramientas de investigación</div>
                        </div>
                        <button
                          onClick={() => onUpdateAgentConfig({ enabled: !agentConfig.enabled })}
                          className={`relative w-10 h-5 rounded-full transition-colors ${agentConfig.enabled ? 'bg-[#00E5C9]' : 'bg-[#666666]'}`}
                        >
                          <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${agentConfig.enabled ? 'left-5' : 'left-[2px]'}`} />
                        </button>
                      </div>

                      <div>
                        <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">
                          Máximo de iteraciones: {agentConfig.maxIterations}
                        </label>
                        <input
                          type="range"
                          min={3}
                          max={25}
                          value={agentConfig.maxIterations}
                          onChange={(e) => onUpdateAgentConfig({ maxIterations: Number(e.target.value) })}
                          className="w-full accent-[#00E5C9]"
                        />
                        <div className="flex justify-between text-[0.625rem] text-[#666666]">
                          <span>3</span>
                          <span>25</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">Directorio de trabajo</label>
                        <div className="flex gap-1.5">
                          <input
                            value={agentConfig.workingDirectory}
                            onChange={(e) => onUpdateAgentConfig({ workingDirectory: e.target.value })}
                            placeholder="Ej: /home/user/documentos"
                            className="flex-1 px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
                          />
                          <button
                            onClick={async () => {
                              try {
                                const { invoke } = await import('@tauri-apps/api/core')
                                const cwd = await invoke<string>('get_cwd')
                                onUpdateAgentConfig({ workingDirectory: cwd })
                              } catch {}
                            }}
                            className="shrink-0 px-2.5 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.65rem] text-[#999999] hover:text-white hover:border-[#DCB263] transition-colors"
                            title="Usar directorio actual"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const { open } = await import('@tauri-apps/plugin-dialog')
                                const selected = await open({ directory: true, multiple: false, title: 'Seleccionar directorio de trabajo' })
                                if (selected) onUpdateAgentConfig({ workingDirectory: selected as string })
                              } catch {}
                            }}
                            className="shrink-0 px-2.5 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.65rem] text-[#00E5C9] hover:text-white hover:border-[#00E5C9] transition-colors"
                            title="Explorar y seleccionar carpeta"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                        <div>
                          <div className="text-[0.75rem] font-medium text-white">Confirmar escrituras</div>
                          <div className="text-[0.625rem] text-[#999999]">Pedir confirmación antes de escribir archivos</div>
                        </div>
                        <button
                          onClick={() => onUpdateAgentConfig({ confirmWrite: !agentConfig.confirmWrite })}
                          className={`relative w-10 h-5 rounded-full transition-colors ${agentConfig.confirmWrite ? 'bg-[#00E5C9]' : 'bg-[#666666]'}`}
                        >
                          <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${agentConfig.confirmWrite ? 'left-5' : 'left-[2px]'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                        <div>
                          <div className="text-[0.75rem] font-medium text-white">Auto-activar skills</div>
                          <div className="text-[0.625rem] text-[#999999]">Solo inyecta skills relevantes al mensaje del usuario (ahorra tokens)</div>
                        </div>
                        <button
                          onClick={() => onUpdateAgentConfig({ autoActivateSkills: !agentConfig.autoActivateSkills })}
                          className={`relative w-10 h-5 rounded-full transition-colors ${agentConfig.autoActivateSkills ? 'bg-[#00E5C9]' : 'bg-[#666666]'}`}
                        >
                          <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${agentConfig.autoActivateSkills ? 'left-5' : 'left-[2px]'}`} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'providers' && (
              <ProvidersTab
                settings={settings}
                onUpdateApiKey={onUpdateApiKey}
                selectedProvider={selectedProvider}
                setSelectedProvider={setSelectedProvider}
              />
            )}

            {tab === 'search' && (
              <>
                <p className="text-[0.6875rem] text-[#666666] mb-3">Configura Tavily para búsqueda web. Obtén tu API key en <a href="https://app.tavily.com" target="_blank" className="text-[#00E5C9] hover:underline">app.tavily.com</a></p>
                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">Tavily API Key</label>
                  <input
                    type="password"
                    value={settings.tavilyKey}
                    onChange={(e) => onUpdateTavilyKey(e.target.value)}
                    placeholder="tvly-..."
                    className="w-full px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
                  />
                </div>
              </>
            )}

            {tab === 'skills' && (
              <SkillsTab workingDirectory={agentConfig?.workingDirectory} />
            )}

            {tab === 'audit' && (
              <AuditTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Provider icons ──
const PROVIDER_ICONS: Record<string, string> = {
  openai: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5"/><path d="M9 13.5c.83 0 1.5-.67 1.5-1.5S9.83 10.5 9 10.5 7.5 11.17 7.5 12s.67 1.5 1.5 1.5zm6 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S13.5 11.17 13.5 12s.67 1.5 1.5 1.5zM12 18c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" fill="currentColor"/></svg>',
  anthropic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M6 8l6-6 6 6M6 16l6 6 6-6"/></svg>',
  deepseek: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>',
  groq: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="3"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/></svg>',
  google: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M6 12l4 4 8-8"/></svg>',
  cohere: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 12h8M12 8v8"/></svg>',
  kimi: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>',
  glm: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16"/></svg>',
}

const PROVIDER_DATA: { id: keyof ApiKeys; label: string; placeholder: string }[] = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
  { id: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...' },
  { id: 'google', label: 'Google (Gemini)', placeholder: 'AIza...' },
  { id: 'cohere', label: 'Cohere', placeholder: '...' },
  { id: 'kimi', label: 'Kimi (Moonshot)', placeholder: 'sk-...' },
  { id: 'glm', label: 'GLM (Z.AI)', placeholder: '...' },
]

function ProvidersTab({
  settings,
  onUpdateApiKey,
  selectedProvider,
  setSelectedProvider,
}: {
  settings: AppSettings
  onUpdateApiKey: (provider: keyof ApiKeys, key: string) => void
  selectedProvider: AppSettings['defaultProvider']
  setSelectedProvider: (p: AppSettings['defaultProvider']) => void
}) {
  const activeProvider = PROVIDER_DATA.find(p => p.id === selectedProvider) || PROVIDER_DATA[0]

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-[130px] shrink-0 space-y-0.5 border-r border-[rgba(255,255,255,0.06)] pr-2">
        <p className="text-[0.55rem] text-[#666666] uppercase tracking-[0.06em] px-1.5 mb-1.5">Proveedores</p>
        {PROVIDER_DATA.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProvider(p.id)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[0.6875rem] transition-colors ${
              selectedProvider === p.id
                ? 'bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.2)] text-[#00E5C9]'
                : 'text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#E5E5E5] border border-transparent'
            }`}
          >
            <span className="shrink-0" dangerouslySetInnerHTML={{ __html: (PROVIDER_ICONS[p.id] || '').replace(/width="20"/g, 'width="14"').replace(/height="20"/g, 'height="14"').replace('stroke="currentColor"', `stroke="${selectedProvider === p.id ? '#00E5C9' : '#999999'}"`) }} />
            <span className="truncate">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <span dangerouslySetInnerHTML={{ __html: PROVIDER_ICONS[activeProvider.id] || '' }} />
          <div>
            <div className="text-[0.75rem] font-semibold text-white">{activeProvider.label}</div>
            <div className="text-[0.55rem] text-[#666666]">API Key — guardada localmente</div>
          </div>
        </div>

        <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">API Key</label>
        <input
          type="password"
          value={settings.apiKeys[activeProvider.id]}
          onChange={(e) => onUpdateApiKey(activeProvider.id, e.target.value)}
          placeholder={activeProvider.placeholder}
          className="w-full px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
        />

        {settings.apiKeys[activeProvider.id] && (
          <div className="mt-2 flex items-center gap-1.5 text-[0.6rem] text-[#00E5C9]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Key configurada
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)]">
          <p className="text-[0.5625rem] text-[#666666] leading-relaxed">
            Tu API key se almacena localmente en el keyring de tu sistema operativo y solo se envía a la API de {activeProvider.label}. Nunca se comparte con otros servicios.
          </p>
        </div>
      </div>
    </div>
  )
}

function AuditTab() {
  const [entries, setEntries] = useState<{ timestamp: string; tool: string; args: string; success: boolean; error: string | null; working_dir: string | null }[]>([])
  const [totalLines, setTotalLines] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadLog = useCallback(async () => {
    setLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<{ entries: any[]; total_lines: number }>('read_audit_log', { maxLines: 50 })
      setEntries(result.entries.reverse())
      setTotalLines(result.total_lines)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadLog() }, [loadLog])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[0.6875rem] text-[#666666]">Registro de todas las herramientas ejecutadas por el agente.</p>
          {totalLines > 0 && (
            <p className="text-[0.55rem] text-[#4a4a4a] mt-0.5">{totalLines} entradas en total (mostrando últimas 50)</p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={loadLog}
            className="px-2 py-1 rounded-md bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.65rem] text-[#999999] hover:text-white transition-colors"
          >
            Recargar
          </button>
          <button
            onClick={async () => {
              try {
                const { invoke } = await import('@tauri-apps/api/core')
                await invoke('clear_audit_log')
                setEntries([])
                setTotalLines(0)
              } catch {}
            }}
            className="px-2 py-1 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[0.65rem] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[0.6875rem] text-[#666666]">Cargando...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[0.75rem] text-[#666666]">Sin actividad del agente aún</p>
          <p className="text-[0.625rem] text-[#666666] opacity-70 mt-1">Activa el modo agente y ejecuta algunas herramientas para ver el registro aquí.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((e, i) => {
            const formatted = formatAuditArgs(e.tool, e.args)
            return (
              <div
                key={i}
                className={`px-2 py-1.5 rounded-md border text-[0.6rem] font-mono ${
                  e.success
                    ? 'bg-[rgba(0,229,201,0.04)] border-[rgba(0,229,201,0.08)]'
                    : 'bg-[rgba(239,68,68,0.04)] border-[rgba(239,68,68,0.08)]'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  <span className="text-[#4a4a4a] shrink-0 mt-[1px]">{e.timestamp}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 font-semibold ${e.success ? 'text-[#00E5C9]' : 'text-[#ef4444]'}`}>
                        {e.tool}
                      </span>
                      <span className={`shrink-0 text-[0.5rem] px-1 rounded ${
                        e.success
                          ? 'bg-[rgba(0,229,201,0.1)] text-[#00E5C9]'
                          : 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]'
                      }`}>
                        {e.success ? 'OK' : 'FAIL'}
                      </span>
                    </div>
                    <div className="text-[#b0b0b0] truncate mt-0.5 leading-[1.4]" title={formatted}>
                      {formatted}
                    </div>
                  </div>
                </div>
                {e.error && (
                  <div className="text-[#ef4444] mt-0.5 ml-[80px] truncate text-[0.55rem]">{e.error}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatAuditArgs(_tool: string, args: string): string {
  try {
    const parsed = JSON.parse(args)
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.command) return parsed.command
      if (parsed.path) return parsed.path
      if (parsed.pattern) return parsed.pattern
      return Object.values(parsed).filter(v => typeof v === 'string').join(' ') || args
    }
  } catch {}
  return args
}

function SkillsTab({ workingDirectory }: { workingDirectory?: string }) {
  const [skills, setSkills] = useState<Array<{ name: string; description: string; enabled: boolean; path: string; source: string }>>([])
  const [loading, setLoading] = useState(true)

  const loadSkills = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<Array<{ name: string; description: string; enabled: boolean; path: string; source: string }>>('list_skills', { workingDir: workingDirectory || null })
      setSkills(list)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadSkills() }, [workingDirectory])

  const toggleSkill = async (name: string, enabled: boolean) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('toggle_skill', { name, enabled })
      await loadSkills()
    } catch (e) {
      console.error('Error toggling skill:', e)
    }
  }

  const projectSkills = skills.filter(s => s.source === 'project')
  const globalSkills = skills.filter(s => s.source === 'global')

  if (loading) return <div className="text-[0.6875rem] text-[#666666]">Cargando skills...</div>

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-[0.75rem] font-semibold text-[#E5E5E5]">Skills</h3>
        <p className="text-[0.625rem] text-[#666666]">
          Las skills son guías que el agente sigue para realizar tareas específicas.
          Las skills globales se instalan con <code className="text-[#DCB263]">npx skills add &lt;repo&gt;@&lt;skill&gt; -g</code>.
          Las skills del proyecto viven en <code className="text-[#DCB263]">.solaria/skills/</code>.
        </p>
      </div>

      {projectSkills.length > 0 && (
        <div className="mb-3">
          <h4 className="text-[0.65rem] font-semibold text-[#DCB263] mb-1.5 uppercase tracking-[0.05em]">Skills del Proyecto</h4>
          <div className="space-y-1.5">
            {projectSkills.map((s, i) => (
              <SkillRow key={i} skill={s} onToggle={toggleSkill} />
            ))}
          </div>
        </div>
      )}

      {globalSkills.length > 0 && (
        <div>
          {projectSkills.length > 0 && (
            <h4 className="text-[0.65rem] font-semibold text-[#00E5C9] mb-1.5 uppercase tracking-[0.05em]">Skills Globales</h4>
          )}
          <div className="space-y-1.5">
            {globalSkills.map((s, i) => (
              <SkillRow key={i} skill={s} onToggle={toggleSkill} />
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-[0.65rem] text-[#666666] py-4 text-center">
          No hay skills instaladas. Instala skills globales con <code className="text-[#DCB263]">npx skills add &lt;repo&gt;@&lt;skill&gt; -g</code> o crea skills de proyecto en <code className="text-[#DCB263]">.solaria/skills/</code>.
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
        <p className="text-[0.55rem] text-[#666666]">
          Las skills se inyectan automáticamente en el prompt del agente.
          Skills del proyecto tienen prioridad sobre las globales con el mismo nombre.
        </p>
      </div>
    </div>
  )
}

function SkillRow({ skill, onToggle, alwaysEnabled }: { skill: { name: string; description: string; enabled: boolean; path: string; source: string }; onToggle?: (name: string, enabled: boolean) => void; alwaysEnabled?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${skill.enabled ? 'bg-[#00E5C9]' : 'bg-[#666666]'}`} />
          <span className="text-[0.75rem] font-medium text-white truncate">{skill.name}</span>
          {alwaysEnabled && (
            <span className="text-[0.45rem] px-1 py-0.5 rounded bg-[rgba(220,178,99,0.1)] text-[#DCB263] uppercase tracking-[0.05em]">Proyecto</span>
          )}
        </div>
        {skill.description && (
          <div className="text-[0.6rem] text-[#999999] mt-0.5 line-clamp-2">{skill.description}</div>
        )}
      </div>
      {!alwaysEnabled && onToggle && (
        <button
          onClick={() => onToggle(skill.name, !skill.enabled)}
          className={`relative w-10 h-5 rounded-full shrink-0 ml-2 transition-colors ${skill.enabled ? 'bg-[#00E5C9]' : 'bg-[#666666]'}`}
        >
          <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${skill.enabled ? 'left-5' : 'left-[2px]'}`} />
        </button>
      )}
    </div>
  )
}

function ModelManager() {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pullName, setPullName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadModels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<string[]>('ollama_models')
      setModels(list)
    } catch (e: any) {
      setError(e?.toString() || 'Error cargando modelos')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const handlePull = useCallback(async () => {
    const name = pullName.trim()
    if (!name) return
    setPulling(true)
    setMessage(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('ollama_pull_model', { modelName: name })
      setMessage(result)
      setPullName('')
      loadModels()
    } catch (e: any) {
      setMessage(`Error: ${e?.toString() || 'Error desconocido'}`)
    }
    setPulling(false)
  }, [pullName, loadModels])

  const handleDelete = useCallback(async (name: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('ollama_delete_model', { modelName: name })
      setMessage(result)
      loadModels()
    } catch (e: any) {
      setMessage(`Error: ${e?.toString() || 'Error desconocido'}`)
    }
  }, [loadModels])

  return (
    <div>
      <div className="mb-2">
        <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">Modelos instalados</label>
        {loading ? (
          <div className="text-[0.65rem] text-[#666666]">Cargando...</div>
        ) : error ? (
          <div className="text-[0.65rem] text-[#ef4444]">{error}</div>
        ) : models.length === 0 ? (
          <div className="text-[0.65rem] text-[#666666]">No hay modelos instalados</div>
        ) : (
          <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {models.map(m => (
              <div key={m} className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
                <span className="text-[0.6rem] text-[#E5E5E5] font-mono">{m}</span>
                <button
                  onClick={() => handleDelete(m)}
                  className="flex items-center justify-center w-3.5 h-3.5 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#666666] hover:text-[#ef4444] transition-colors"
                  title="Eliminar modelo"
                >
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        <input
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePull()}
          placeholder="Ej: qwen3.5, llama3.2, mistral..."
          disabled={pulling}
          className="flex-1 px-2 py-1.5 rounded-md bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors disabled:opacity-50"
        />
        <button
          onClick={handlePull}
          disabled={pulling || !pullName.trim()}
          className="shrink-0 px-2.5 py-1.5 rounded-md bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.65rem] text-[#00E5C9] font-medium hover:bg-[rgba(0,229,201,0.1)] hover:border-[rgba(0,229,201,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pulling ? 'Descargando...' : 'Descargar'}
        </button>
      </div>

      {message && (
        <div className={`mt-1 text-[0.6rem] ${message.startsWith('Error') ? 'text-[#ef4444]' : 'text-[#00E5C9]'}`}>
          {message}
        </div>
      )}
    </div>
  )
}
