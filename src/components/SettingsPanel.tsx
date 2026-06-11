import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ApiKeys } from '../hooks/useSettings'
import type { AgentConfig } from '../hooks/useAgent'
import type { Lang } from '../lib/i18n'
import { t } from '../lib/i18n'
import { useMemory, type SearchResult } from '../hooks/useMemory'

interface SettingsPanelProps {
  settings: AppSettings
  initialTab?: 'general' | 'providers' | 'search' | 'skills' | 'memory' | 'audit' | 'mcp' | 'cookbook'
  onClose: () => void
  onUpdate: (updates: Partial<AppSettings>) => void
  onUpdateApiKey: (provider: keyof ApiKeys, key: string) => void
  onUpdateTavilyKey: (key: string) => void
  onUpdateProvider: (provider: AppSettings['defaultProvider'], model: string) => void
  agentConfig?: AgentConfig
  onUpdateAgentConfig?: (updates: Partial<AgentConfig>) => void
}

const PROVIDERS: { id: AppSettings['defaultProvider']; label: string; models: string[]; isLocal: boolean }[] = [
  { id: 'ollama', label: 'Ollama', models: ['qwen3.5', 'llama3.2', 'llama3.1', 'mistral', 'phi3', 'deepseek-r1', 'gemma3', 'gemma4'], isLocal: true },
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-5.5', 'o1', 'o3-mini'], isLocal: false },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-7'], isLocal: false },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'], isLocal: false },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-4-scout-17b-16e-instruct'], isLocal: false },
  { id: 'google', label: 'Google', models: ['gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-pro-preview-03-25'], isLocal: false },
  { id: 'cohere', label: 'Cohere', models: ['command-r7b-12-2024', 'command-r-plus-08-2024'], isLocal: false },
  { id: 'kimi', label: 'Kimi', models: ['kimi-k2.6', 'kimi-k2-0905-preview'], isLocal: false },
  { id: 'glm', label: 'GLM', models: ['glm-4.7', 'glm-4.7-flash', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.5', 'glm-4.5-flash'], isLocal: false },
]

const TABS: { id: 'general' | 'providers' | 'search' | 'skills' | 'memory' | 'audit' | 'mcp' | 'cookbook'; labelKey: string; icon: string }[] = [
  { id: 'general', labelKey: 'settings.general', icon: 'general' },
  { id: 'providers', labelKey: 'settings.providers', icon: 'providers' },
  { id: 'search', labelKey: 'settings.search', icon: 'search' },
  { id: 'skills', labelKey: '', icon: 'skills' },
  { id: 'memory', labelKey: 'settings.memory', icon: 'memory' },
  { id: 'mcp', labelKey: '', icon: 'mcp' },
  { id: 'cookbook', labelKey: 'cookbook.label', icon: 'cookbook' },
  { id: 'audit', labelKey: 'settings.audit', icon: 'audit' },
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
  const [tab, setTab] = useState<'general' | 'providers' | 'search' | 'skills' | 'memory' | 'audit' | 'mcp' | 'cookbook'>(initialTab || 'general')
  const [selectedProvider, setSelectedProvider] = useState<AppSettings['defaultProvider']>('openai')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[760px] h-[88vh] bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0 bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#00E5C9]/10 border border-[#00E5C9]/15 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">{t('settings.title', lang)}</h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-[170px] shrink-0 border-r border-[rgba(255,255,255,0.04)] flex flex-col py-3 bg-[rgba(255,255,255,0.01)]">
            <div className="flex-1 overflow-y-auto px-2.5 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
              {TABS.map(tabKey => (
                <button
                  key={tabKey.id}
                  onClick={() => setTab(tabKey.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-[0.7rem] font-medium transition-all duration-150 ${
                    tab === tabKey.id
                      ? 'bg-[rgba(0,229,201,0.07)] text-[#00E5C9] border border-[rgba(0,229,201,0.15)]'
                      : 'text-[#999999] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#E5E5E5] border border-transparent'
                  }`}
                >
                  <TabIcon name={tabKey.icon} active={tab === tabKey.id} />
                  <span>{tabKey.id === 'skills' ? 'Skills' : tabKey.id === 'mcp' ? 'MCP' : tabKey.id === 'cookbook' ? 'Cookbook' : t(tabKey.labelKey, lang)}</span>
                </button>
              ))}
            </div>
            <div className="px-4 pt-3 mt-2 border-t border-[rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-1.5 text-[0.5rem] text-[#555555]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00E5C9]/40" />
                Solaria v0.8.0
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
            {tab === 'general' && (
              <GeneralTab settings={settings} onUpdate={onUpdate} onUpdateProvider={onUpdateProvider} agentConfig={agentConfig} onUpdateAgentConfig={onUpdateAgentConfig} />
            )}

            {tab === 'providers' && (
              <ProvidersTab settings={settings} onUpdateApiKey={onUpdateApiKey} selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} />
            )}

            {tab === 'search' && (
              <SearchTab settings={settings} onUpdateTavilyKey={onUpdateTavilyKey} />
            )}

            {tab === 'skills' && (
              <SkillsTab workingDirectory={agentConfig?.workingDirectory} />
            )}

            {tab === 'memory' && (
              <MemoryTab />
            )}

            {tab === 'mcp' && (
              <McpTab />
            )}

            {tab === 'cookbook' && (
              <CookbookTab lang={lang} />
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

/* ════════════════════════════════
   TABS — REFACTORED UI
   ════════════════════════════════ */

function GeneralTab({
  settings,
  onUpdate,
  onUpdateProvider,
  agentConfig,
  onUpdateAgentConfig,
}: {
  settings: AppSettings
  onUpdate: (u: Partial<AppSettings>) => void
  onUpdateProvider: (p: AppSettings['defaultProvider'], m: string) => void
  agentConfig?: AgentConfig
  onUpdateAgentConfig?: (u: Partial<AgentConfig>) => void
}) {
  const providerDef = PROVIDERS.find(p => p.id === settings.defaultProvider)

  return (
    <div className="space-y-5">
      {/* Section: Provider & Model */}
              <Section title="Proveedor & Modelo" color="#00E5C9">
        <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-4">
          <div>
            <label className="block text-[0.625rem] font-medium text-[#999999] mb-2">Proveedor por defecto</label>
            <div className="space-y-2">
              <div className="text-[0.55rem] text-[#666666] uppercase tracking-wider font-medium">Local</div>
              <div className="grid grid-cols-3 gap-1.5">
                    {PROVIDERS.filter(p => p.isLocal).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onUpdateProvider(p.id, settings.defaultProvider === p.id ? settings.defaultModel : p.models[0])}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[0.6rem] font-medium transition-all ${
                      settings.defaultProvider === p.id
                        ? 'bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9] shadow-[0_0_12px_rgba(0,229,201,0.06)]'
                        : 'bg-[#222] border border-[rgba(255,255,255,0.04)] text-[#999999] hover:border-[rgba(255,255,255,0.1)] hover:text-[#E5E5E5]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="text-[0.55rem] text-[#666666] uppercase tracking-wider font-medium pt-1">Cloud (BYOK)</div>
              <div className="grid grid-cols-3 gap-1.5">
                {PROVIDERS.filter(p => !p.isLocal).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onUpdateProvider(p.id, settings.defaultProvider === p.id ? settings.defaultModel : p.models[0])}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[0.6rem] font-medium transition-all ${
                      settings.defaultProvider === p.id
                        ? 'bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9] shadow-[0_0_12px_rgba(0,229,201,0.06)]'
                        : 'bg-[#222] border border-[rgba(255,255,255,0.04)] text-[#999999] hover:border-[rgba(255,255,255,0.1)] hover:text-[#E5E5E5]'
                    }`}
                  >
                    
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[0.625rem] font-medium text-[#999999] mb-2">Modelo</label>
            <div className="flex flex-wrap gap-1.5">
              {providerDef?.models.map(m => (
                <button
                  key={m}
                  onClick={() => onUpdate({ defaultModel: m })}
                  className={`px-2.5 py-1 rounded-md text-[0.6rem] font-mono transition-all ${
                    settings.defaultModel === m
                      ? 'bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9]'
                      : 'bg-[#222] border border-[rgba(255,255,255,0.04)] text-[#999999] hover:border-[rgba(255,255,255,0.1)] hover:text-[#E5E5E5]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {settings.defaultProvider === 'ollama' && (
            <div className="pt-2 border-t border-[rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[0.625rem] font-medium text-[#999999]">Ollama host</label>
                <span className="text-[0.5rem] text-[#666666]">(default: http://localhost:11434)</span>
              </div>
              <input
                value={settings.ollamaHost}
                onChange={e => onUpdate({ ollamaHost: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
              />
            </div>
          )}
        </div>
      </Section>

      {/* Section: Model Parameters */}
      <Section title="Parámetros del modelo" color="#DCB263">
        <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-4">
          <SliderControl
            label="Temperatura"
            value={settings.temperature}
            min={0} max={2} step={0.1}
            onChange={v => onUpdate({ temperature: v })}
            descLeft="Preciso" descRight="Creativo"
            color="#DCB263"
          />
          <SliderControl
            label="Top P"
            value={settings.topP}
            min={0} max={1} step={0.05}
            onChange={v => onUpdate({ topP: v })}
            descLeft="Estricto" descRight="Flexible"
            color="#DCB263"
          />
          <SliderControl
            label="Max tokens"
            value={settings.maxTokens}
            min={64} max={8192} step={64}
            onChange={v => onUpdate({ maxTokens: v })}
            descLeft="64" descRight="8192"
            color="#DCB263"
          />
        </div>
      </Section>

      {/* Section: Ollama Model Manager */}
      {settings.defaultProvider === 'ollama' && (
        <Section title="Gestión de modelos" color="#00E5C9">
          <ModelManager />
        </Section>
      )}

      {/* Section: Language */}
      <Section title="Idioma" color="#00E5C9">
        <div className="flex gap-2">
          {([['es', 'Español'], ['en', 'English']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => onUpdate({ language: value })}
              className={`px-4 py-2 rounded-lg text-[0.7rem] font-medium transition-all ${
                settings.language === value
                  ? 'bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.25)] text-[#00E5C9]'
                  : 'bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] text-[#999999] hover:border-[rgba(255,255,255,0.12)] hover:text-[#E5E5E5]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Section: Storage */}
      <Section title="Almacenamiento" color="#DCB263">
        <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
          <p className="text-[0.6rem] text-[#999999] leading-relaxed">
            Las conversaciones se guardan en localStorage. Puedes exportarlas o importarlas desde un archivo JSON.
          </p>
          <div className="flex gap-2 flex-wrap">
            <ActionButton variant="danger" onClick={() => { localStorage.removeItem('solaria-conversations'); window.location.reload() }}>
              <TrashIcon />
              Limpiar historial
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => {
              const data = localStorage.getItem('solaria-conversations')
              if (!data) return
              const blob = new Blob([data], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `solaria-chats-${Date.now()}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}>
              <ExportIcon />
              Exportar
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => {
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
            }}>
              <ImportIcon />
              Importar
            </ActionButton>
          </div>
        </div>
      </Section>

      {/* Section: Agent Mode */}
      {agentConfig && onUpdateAgentConfig && (
        <Section title="Modo Agente" color="#00E5C9">
          <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.7rem] font-medium text-white">Activar agente</div>
                <div className="text-[0.55rem] text-[#999999]">Permite al agente usar herramientas de investigación</div>
              </div>
              <Switch checked={agentConfig.enabled} onChange={v => onUpdateAgentConfig({ enabled: v })} />
            </div>

            <div className="pt-2 border-t border-[rgba(255,255,255,0.04)]">
              <SliderControl
                label="Máximo de iteraciones"
                value={agentConfig.maxIterations}
                min={3} max={25} step={1}
                onChange={v => onUpdateAgentConfig({ maxIterations: v })}
                descLeft="3" descRight="25"
                color="#00E5C9"
              />
            </div>

            <div>
              <label className="block text-[0.625rem] font-medium text-[#999999] mb-1.5">Directorio de trabajo</label>
              <div className="flex gap-1.5">
                <input
                  value={agentConfig.workingDirectory}
                  onChange={e => onUpdateAgentConfig({ workingDirectory: e.target.value })}
                  placeholder="Ej: /home/user/documentos"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
                />
                <ActionButton variant="ghost" small onClick={async () => {
                  try { const { invoke } = await import('@tauri-apps/api/core'); const cwd = await invoke<string>('get_cwd'); onUpdateAgentConfig({ workingDirectory: cwd }) } catch {}
                }}>
                  <FolderIcon />
                </ActionButton>
                <ActionButton variant="ghost" small onClick={async () => {
                  try { const { open } = await import('@tauri-apps/plugin-dialog'); const selected = await open({ directory: true, multiple: false, title: 'Seleccionar directorio' }); if (selected) onUpdateAgentConfig({ workingDirectory: selected as string }) } catch {}
                }}>
                  <SearchFolderIcon />
                </ActionButton>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.7rem] font-medium text-white">Confirmar escrituras</div>
                <div className="text-[0.55rem] text-[#999999]">Pedir confirmación antes de escribir archivos</div>
              </div>
              <Switch checked={agentConfig.confirmWrite} onChange={v => onUpdateAgentConfig({ confirmWrite: v })} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.7rem] font-medium text-white">Auto-activar skills</div>
                <div className="text-[0.55rem] text-[#999999]">Solo inyecta skills relevantes (ahorra tokens)</div>
              </div>
              <Switch checked={agentConfig.autoActivateSkills} onChange={v => onUpdateAgentConfig({ autoActivateSkills: v })} />
            </div>
          </div>
        </Section>
      )}

      {/* Section: Comparador ciego */}
      <Section title="Comparador ciego de modelos" color="#DCB263">
        <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.7rem] font-medium text-white">Activar comparador</div>
              <div className="text-[0.55rem] text-[#999999]">Permite comparar respuestas de modelos lado a lado sin saber cuál es cuál</div>
            </div>
            <Switch checked={settings.comparisonEnabled} onChange={v => onUpdate({ comparisonEnabled: v })} />
          </div>
          {settings.comparisonEnabled && (
            <div className="p-2.5 rounded-lg bg-[rgba(0,229,201,0.04)] border border-[rgba(0,229,201,0.08)]">
              <p className="text-[0.58rem] text-[#999999] leading-relaxed">
                Al activarlo, aparecerá un botón "Comparar" en la barra de herramientas del chat. Podrás seleccionar 2-4 modelos, enviar la misma pregunta a todos, ver las respuestas lado a lado y votar por la mejor sin saber qué modelo la generó.
              </p>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

function ProvidersTab({ settings, onUpdateApiKey, selectedProvider, setSelectedProvider }: {
  settings: AppSettings
  onUpdateApiKey: (provider: keyof ApiKeys, key: string) => void
  selectedProvider: AppSettings['defaultProvider']
  setSelectedProvider: (p: AppSettings['defaultProvider']) => void
}) {
  const active = PROVIDER_DATA.find(p => p.id === selectedProvider) || PROVIDER_DATA[0]
  const isConfigured = selectedProvider !== 'ollama' && settings.apiKeys[selectedProvider as keyof ApiKeys]?.length > 0

  return (
    <div className="space-y-5">
      <SectionHeader title="API Keys" desc="Tus claves se guardan localmente en el keyring del sistema." />

      <div className="flex gap-3 h-full min-h-0">
        <div className="w-[140px] shrink-0 space-y-0.5">
          {PROVIDER_DATA.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProvider(p.id)}
              className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-[0.65rem] transition-all ${
                selectedProvider === p.id
                  ? 'bg-[rgba(0,229,201,0.07)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9]'
                  : 'text-[#999999] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#E5E5E5] border border-transparent'
              }`}
            >
              <ProviderStatusDot configured={settings.apiKeys[p.id]?.length > 0} active={selectedProvider === p.id} />
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 p-4 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <div className="text-[0.75rem] font-semibold text-white">{active.label}</div>
              <div className="flex items-center gap-1.5">
                {isConfigured ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C9]" />
                    <span className="text-[0.55rem] text-[#00E5C9]">Configurada</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#666666]" />
                    <span className="text-[0.55rem] text-[#999999]">Sin configurar</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <label className="block text-[0.625rem] font-medium text-[#999999] mb-1.5">API Key</label>
          <input
            type="password"
            value={settings.apiKeys[active.id]}
            onChange={e => onUpdateApiKey(active.id, e.target.value)}
            placeholder={active.placeholder}
            className="w-full px-3 py-2.5 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
          />

          <div className="mt-3 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
            <p className="text-[0.55rem] text-[#999999] leading-relaxed">
              Tu API key se almacena en el keyring del sistema operativo y solo se envía a la API de {active.label}.
              Nunca se comparte con otros servicios.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SearchTab({ settings, onUpdateTavilyKey }: { settings: AppSettings; onUpdateTavilyKey: (key: string) => void }) {
  const configured = settings.tavilyKey.length > 0

  return (
    <div className="space-y-5">
      <SectionHeader title="Búsqueda web" desc="Configura Tavily para que el agente busque información actualizada en internet." />

      <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[0.75rem] font-semibold text-white">Tavily</h3>
              <span className={`text-[0.5rem] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wide ${
                configured
                  ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border-[rgba(0,229,201,0.25)]'
                  : 'bg-[rgba(255,255,255,0.04)] text-[#999999] border-[rgba(255,255,255,0.08)]'
              }`}>
                {configured ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-[0.6rem] text-[#999999] mt-0.5">
              Motor de búsqueda optimizado para IA. Obtén tu API key en{' '}
              <a href="https://app.tavily.com" target="_blank" className="text-[#00E5C9] hover:underline">app.tavily.com</a>
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[0.625rem] font-medium text-[#999999] mb-1.5">API Key</label>
          <input
            type="password"
            value={settings.tavilyKey}
            onChange={e => onUpdateTavilyKey(e.target.value)}
            placeholder="tvly-..."
            className="w-full px-3 py-2.5 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
          />
          {configured && (
            <div className="flex items-center gap-1.5 mt-2 text-[0.55rem] text-[#00E5C9]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Key configurada correctamente
            </div>
          )}
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
    <div className="space-y-5">
      <SectionHeader title="Auditoría" desc="Registro de todas las herramientas ejecutadas por el agente." />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C9]" />
          <span className="text-[0.6rem] text-[#999999]">
            {totalLines > 0 ? `${totalLines} entradas totales` : 'Sin actividad'}
          </span>
        </div>
        <div className="flex gap-1.5">
          <ActionButton variant="ghost" small onClick={loadLog}>
            <RefreshIcon />
            Recargar
          </ActionButton>
          <ActionButton variant="danger" small onClick={async () => {
            try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('clear_audit_log'); setEntries([]); setTotalLines(0) } catch {}
          }}>
            <TrashIcon />
            Limpiar
          </ActionButton>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <span className="text-[0.65rem] text-[#999999]">Cargando registro...</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <p className="text-[0.7rem] text-[#999999]">Sin actividad del agente aún</p>
          <p className="text-[0.6rem] text-[#666666]">Activa el modo agente y ejecuta herramientas para ver el registro aquí.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => {
            const formatted = formatAuditArgs(e.tool, e.args)
            return (
              <div key={i} className="px-3 py-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)] transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {e.success ? (
                      <span className="w-5 h-5 rounded-full bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[0.65rem] font-semibold ${e.success ? 'text-[#00E5C9]' : 'text-[#ef4444]'}`}>{e.tool}</span>
                      <span className="text-[0.5rem] text-[#666666] font-mono">{e.timestamp}</span>
                    </div>
                    <div className="text-[0.6rem] text-[#999999] truncate mt-0.5 leading-relaxed" title={formatted}>{formatted}</div>
                    {e.error && (
                      <div className="mt-1.5 text-[0.55rem] text-[#ef4444] leading-relaxed">{e.error}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════
   SKILLS TAB (refactored)
   ════════════════════════════════ */

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
    } catch (e) { console.error('Error toggling skill:', e) }
  }

  const projectSkills = skills.filter(s => s.source === 'project')
  const globalSkills = skills.filter(s => s.source === 'global')

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span className="text-[0.65rem] text-[#999999]">Cargando skills...</span>
    </div>
  )

  return (
    <div className="space-y-5">
      <SectionHeader title="Skills" desc="Guías que el agente sigue para realizar tareas específicas. Se inyectan automáticamente en el prompt." />

      <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
        <div className="flex items-center gap-2 text-[0.55rem] text-[#666666] uppercase tracking-wider font-medium">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Instalación
        </div>
        <p className="text-[0.6rem] text-[#999999] leading-relaxed">
          Globales: <code className="text-[#DCB263] px-1 py-0.5 rounded bg-[rgba(220,178,99,0.08)]">npx skills add &lt;repo&gt;@&lt;skill&gt; -g</code>
          <br />
          Proyecto: crea en <code className="text-[#DCB263] px-1 py-0.5 rounded bg-[rgba(220,178,99,0.08)]">.solaria/skills/</code>
        </p>
      </div>

      {projectSkills.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-1 h-3.5 rounded-full bg-[#DCB263]" />
            <h4 className="text-[0.65rem] font-semibold text-[#E5E5E5] uppercase tracking-[0.06em]">Skills del Proyecto</h4>
          </div>
          <div className="space-y-1.5">
            {projectSkills.map((s, i) => (
              <SkillRow key={i} skill={s} onToggle={toggleSkill} />
            ))}
          </div>
        </div>
      )}

      {globalSkills.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-1 h-3.5 rounded-full bg-[#00E5C9]" />
            <h4 className="text-[0.65rem] font-semibold text-[#E5E5E5] uppercase tracking-[0.06em]">Skills Globales</h4>
          </div>
          <div className="space-y-1.5">
            {globalSkills.map((s, i) => (
              <SkillRow key={i} skill={s} onToggle={toggleSkill} />
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <p className="text-[0.7rem] text-[#999999]">No hay skills instaladas</p>
          <p className="text-[0.6rem] text-[#666666]">Instala skills globales o crea skills de proyecto.</p>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════
   MEMORY TAB (unchanged — already polished)
   ════════════════════════════════ */

function MemoryTab() {
  const memory = useMemory()
  const [testQuery, setTestQuery] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<SearchResult[]>([])
  const [indexingProject, setIndexingProject] = useState(false)
  const [lastIndexedCount, setLastIndexedCount] = useState<number | null>(null)

  const handleTest = async () => {
    if (!testQuery.trim() || !memory.config.enabled) return
    setTesting(true)
    try { const results = await memory.search({ query: testQuery }); setTestResults(results) } finally { setTesting(false) }
  }

  const handleIndexProject = async () => {
    setIndexingProject(true)
    setLastIndexedCount(null)
    try {
      const count = await memory.indexProject('', undefined)
      setLastIndexedCount(count)
      memory.refreshStats()
    } catch (e: any) { /* error handled in hook */ } finally { setIndexingProject(false) }
  }

  const PROVIDERS = [
    { id: 'ollama' as const, label: 'Ollama (local)', models: ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm'] },
    { id: 'openai' as const, label: 'OpenAI', models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'] },
    { id: 'custom' as const, label: 'Custom endpoint', models: ['custom'] },
  ]
  const currentProviderDef = PROVIDERS.find(p => p.id === memory.config.provider) || PROVIDERS[0]

  return (
    <div className="space-y-5">
      <SectionHeader
       
        title="Memoria persistente"
        badge={memory.config.enabled ? 'ON' : 'OFF'}
        badgeColor={memory.config.enabled ? '#00E5C9' : '#999999'}
        desc="El agente recuerda conversaciones previas y archivos del proyecto via búsqueda vectorial."
      />

      <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[0.7rem] font-medium text-white">Activar memoria</div>
            <div className="text-[0.55rem] text-[#999999] mt-0.5">SQLite + sqlite-vec · <code className="text-[#DCB263]">~/.solaria/memory.db</code></div>
          </div>
          <Switch checked={memory.config.enabled} onChange={v => memory.updateConfig({ enabled: v })} />
        </div>
      </div>

      {memory.config.enabled && (
        <>
          <Section title="Proveedor" color="#00E5C9">
            <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
              <div>
                <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">Provider</label>
                <select
                  value={memory.config.provider}
                  onChange={e => {
                    const p = e.target.value as 'ollama' | 'openai' | 'custom'
                    const def = PROVIDERS.find(x => x.id === p)
                    memory.updateConfig({ provider: p, model: def?.models[0] || '' })
                  }}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white outline-none focus:border-[#DCB263] transition-colors appearance-none cursor-pointer"
                >
                  {PROVIDERS.map(p => <option key={p.id} value={p.id} className="bg-[#222]">{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">Modelo</label>
                <input
                  type="text" value={memory.config.model}
                  onChange={e => memory.updateConfig({ model: e.target.value })}
                  placeholder={currentProviderDef.models[0]}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {currentProviderDef.models.map(m => (
                    <button
                      key={m}
                      onClick={() => memory.updateConfig({ model: m })}
                      className={`px-1.5 py-0.5 rounded text-[0.5rem] border transition-colors ${
                        memory.config.model === m
                          ? 'bg-[rgba(0,229,201,0.1)] text-[#00E5C9] border-[rgba(0,229,201,0.25)]'
                          : 'bg-[rgba(255,255,255,0.03)] text-[#999999] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                      }`}
                    >{m}</button>
                  ))}
                </div>
              </div>
              {memory.config.provider === 'ollama' && (
                <div>
                  <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">Ollama host</label>
                  <input type="text" value={memory.config.ollamaHost} onChange={e => memory.updateConfig({ ollamaHost: e.target.value })} placeholder="http://localhost:11434" className="w-full px-2.5 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors" />
                </div>
              )}
              {memory.config.provider === 'openai' && (
                <div>
                  <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">OpenAI API key</label>
                  <input type="password" value={memory.config.apiKey} onChange={e => memory.updateConfig({ apiKey: e.target.value })} placeholder="sk-..." className="w-full px-2.5 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors" />
                </div>
              )}
              {memory.config.provider === 'custom' && (
                <>
                  <div>
                    <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">API URL</label>
                    <input type="text" value={memory.config.apiUrl} onChange={e => memory.updateConfig({ apiUrl: e.target.value })} placeholder="https://api.example.com/v1/embeddings" className="w-full px-2.5 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[0.625rem] font-medium text-[#999999] mb-1">API key (opcional)</label>
                    <input type="password" value={memory.config.apiKey} onChange={e => memory.updateConfig({ apiKey: e.target.value })} className="w-full px-2.5 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors" />
                  </div>
                </>
              )}
            </div>
          </Section>

          <Section title="Parámetros" color="#DCB263">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
                <label className="block text-[0.55rem] text-[#999999] mb-1">Top K</label>
                <input type="number" min="1" max="20" value={memory.config.topK} onChange={e => memory.updateConfig({ topK: parseInt(e.target.value) || 5 })} className="w-full px-2 py-1 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.7rem] text-white font-mono outline-none focus:border-[#DCB263] transition-colors" />
                <p className="text-[0.5rem] text-[#666666] mt-1">Chunks inyectados</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
                <label className="block text-[0.55rem] text-[#999999] mb-1">Score mínimo</label>
                <input type="number" min="0" max="1" step="0.05" value={memory.config.minScore} onChange={e => memory.updateConfig({ minScore: parseFloat(e.target.value) || 0.7 })} className="w-full px-2 py-1 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.7rem] text-white font-mono outline-none focus:border-[#DCB263] transition-colors" />
                <p className="text-[0.5rem] text-[#666666] mt-1">Umbral de relevancia</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
                <label className="block text-[0.55rem] text-[#999999] mb-1">Peso recencia</label>
                <input type="number" min="0" max="1" step="0.05" value={memory.config.recencyWeight} onChange={e => memory.updateConfig({ recencyWeight: parseFloat(e.target.value) || 0.3 })} className="w-full px-2 py-1 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.7rem] text-white font-mono outline-none focus:border-[#DCB263] transition-colors" />
                <p className="text-[0.5rem] text-[#666666] mt-1">0 = solo similitud, 1 = solo recencia</p>
              </div>
            </div>
          </Section>

          <Section title="Comportamiento" color="#00E5C9">
            <div className="space-y-1.5">
              <ToggleRow label="Inyección automática" desc="Buscar e inyectar contexto en cada mensaje" checked={memory.config.autoInject} onChange={v => memory.updateConfig({ autoInject: v })} />
              <ToggleRow label="Indexar conversaciones" desc="Guardar mensajes de chat al finalizar" checked={memory.config.indexConversations} onChange={v => memory.updateConfig({ indexConversations: v })} />
              <ToggleRow label="Indexar archivos del proyecto" desc="Incluir archivos del working directory" checked={memory.config.indexProjectFiles} onChange={v => memory.updateConfig({ indexProjectFiles: v })} />
            </div>
          </Section>

          {memory.stats && (
            <Section title="Estadísticas" color="#DCB263">
              <div className="grid grid-cols-3 gap-2">
                <StatCard value={memory.stats.total_chunks} label="chunks" />
                <StatCard value={memory.stats.total_conversations} label="conversaciones" />
                <StatCard value={memory.stats.total_project_files} label="archivos" />
              </div>
              <div className="px-3 py-2 rounded-lg bg-[rgba(0,229,201,0.04)] border border-[rgba(0,229,201,0.1)] flex items-center gap-1.5">
                <FileIcon />
                <span className="text-[0.55rem] text-[#00E5C9] font-mono truncate">{memory.stats.db_path}</span>
              </div>
            </Section>
          )}

          <Section title="Probar búsqueda" color="#DCB263">
            <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
              <div className="flex gap-2">
                <input value={testQuery} onChange={e => setTestQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTest()} placeholder="Escribe una consulta para buscar en memoria..." className="flex-1 px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors" />
                <ActionButton variant="primary" onClick={handleTest} disabled={testing || !testQuery.trim()}>
                  {testing && <Spinner />}
                  {testing ? 'Buscando...' : 'Buscar'}
                </ActionButton>
              </div>
              {testResults.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[0.55rem] text-[#999999] flex items-center gap-1.5"><SearchSmallIcon />{testResults.length} resultado{testResults.length !== 1 ? 's' : ''}</div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {testResults.map((r, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.1)] transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-white border border-[rgba(255,255,255,0.06)]">{(1 - r.distance).toFixed(3)}</span>
                            <span className={`text-[0.5rem] px-1.5 py-0.5 rounded-full border ${r.chunk.source === 'conversation' ? 'bg-[rgba(220,178,99,0.08)] text-[#DCB263] border-[rgba(220,178,99,0.2)]' : 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border-[rgba(0,229,201,0.2)]'}`}>{r.chunk.source}</span>
                          </div>
                          <span className="text-[0.5rem] text-[#666666] truncate max-w-[40%] font-mono">{r.chunk.source_id.split('/').pop()}</span>
                        </div>
                        <div className="text-[0.6rem] text-[#E5E5E5] leading-relaxed line-clamp-3">{r.chunk.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {memory.error && <ErrorToast msg={memory.error} />}
            </div>
          </Section>

          <Section title="Indexar proyecto" color="#00E5C9">
            <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
              <p className="text-[0.6rem] text-[#999999] leading-relaxed">Escanea el directorio de trabajo del agente e indexa archivos compatibles en la memoria vectorial. Extensiones por defecto: .md, .txt, .ts, .tsx, .rs, .py, .json, .yaml, .toml</p>
              <ActionButton variant="primary" onClick={handleIndexProject} disabled={indexingProject || (memory.indexProgress?.phase === 'indexing')}>
                {(indexingProject || memory.indexProgress?.phase === 'indexing') && <Spinner />}
                {memory.indexProgress?.phase === 'indexing' ? 'Indexando...' : indexingProject ? 'Indexando archivos...' : 'Indexar directorio de trabajo'}
              </ActionButton>
              {memory.indexProgress && memory.indexProgress.phase === 'indexing' && memory.indexProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[0.5rem] text-[#999999]">
                    <span className="truncate max-w-[70%]">{memory.indexProgress.file?.split('/').pop()}</span>
                    <span>{memory.indexProgress.current} / {memory.indexProgress.total}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                    <div className="h-full rounded-full bg-[#00E5C9] transition-all duration-200" style={{ width: `${(memory.indexProgress.current / memory.indexProgress.total) * 100}%` }} />
                  </div>
                </div>
              )}
              {lastIndexedCount !== null && memory.indexProgress?.phase !== 'indexing' && (
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[rgba(0,229,201,0.06)] border border-[rgba(0,229,201,0.12)]">
                  <CheckIcon />
                  <span className="text-[0.6rem] text-[#00E5C9]">{lastIndexedCount} chunk{lastIndexedCount !== 1 ? 's' : ''} indexado{lastIndexedCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </Section>

          <Section title="Zona de peligro" color="#ef4444">
            <div className="p-3 rounded-xl bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.12)] space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[0.7rem] font-medium text-[#ef4444]">Borrar toda la memoria</div>
                  <p className="text-[0.55rem] text-[#999999] mt-0.5">Elimina permanentemente todos los chunks de <code className="text-[#ef4444]">memory.db</code>. No se puede deshacer.</p>
                </div>
              </div>
              <ActionButton variant="danger" onClick={memory.clearMemory}>
                <TrashIcon />
                Borrar toda la memoria
              </ActionButton>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

/* ════════════════════════════════
   MCP TAB
   ════════════════════════════════ */

interface McpServerItem {
  name: string
  command: string
  args: string[]
  enabled: boolean
}

interface McpToolItem {
  name: string
  description: string
  server_name: string
  input_schema: any
}

function McpTab() {
  const [servers, setServers] = useState<McpServerItem[]>([])
  const [tools, setTools] = useState<McpToolItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editArgs, setEditArgs] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const [svrs, tls] = await Promise.all([
        invoke<McpServerItem[]>('mcp_list_servers'),
        invoke<McpToolItem[]>('mcp_list_tools'),
      ])
      setServers(svrs)
      setTools(tls)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const persist = async (newServers: McpServerItem[]) => {
    setServers(newServers)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mcp_save_servers', { servers: newServers })
    } catch (e) {
      setError(String(e))
    }
  }

  const startNew = () => {
    setEditingIdx(-1)
    setEditName('')
    setEditCommand('')
    setEditArgs('')
    setEditEnabled(true)
    setError(null)
  }

  const editServer = (idx: number) => {
    const s = servers[idx]
    setEditingIdx(idx)
    setEditName(s.name)
    setEditCommand(s.command)
    setEditArgs(s.args.join(' '))
    setEditEnabled(s.enabled)
  }

  const saveEdit = async () => {
    if (!editName.trim() || !editCommand.trim()) return
    const argsArr = editArgs.trim().split(/\s+/).filter(Boolean)
    const newServer: McpServerItem = { name: editName.trim(), command: editCommand.trim(), args: argsArr, enabled: editEnabled }
    let newServers: McpServerItem[]
    if (editingIdx === null || editingIdx < 0) {
      newServers = [...servers, newServer]
    } else {
      newServers = [...servers]
      newServers[editingIdx] = newServer
    }
    await persist(newServers)
    setEditingIdx(null)
  }

  const removeServer = async (idx: number) => {
    const s = servers[idx]
    const newServers = servers.filter((_, i) => i !== idx)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mcp_stop_server', { name: s.name })
    } catch {}
    await persist(newServers)
    setTimeout(load, 100)
  }

  const toggleEnabled = async (idx: number) => {
    const newServers = [...servers]
    newServers[idx] = { ...newServers[idx], enabled: !newServers[idx].enabled }
    await persist(newServers)
  }

  const startServer = async (idx: number) => {
    const s = servers[idx]
    setActionLoading(s.name)
    setError(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mcp_start_server', { server: s })
      await load()
    } catch (e) {
      setError(String(e))
    }
    setActionLoading(null)
  }

  const stopServer = async (idx: number) => {
    const s = servers[idx]
    setActionLoading(s.name)
    setError(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mcp_stop_server', { name: s.name })
      await load()
    } catch (e) {
      setError(String(e))
    }
    setActionLoading(null)
  }

  const restartAll = async () => {
    setActionLoading('__all__')
    setError(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mcp_restart_all')
      await load()
    } catch (e) {
      setError(String(e))
    }
    setActionLoading(null)
  }

  const isRunning = (name: string) => tools.some(t => t.server_name === name)
  const runningCount = servers.filter(s => isRunning(s.name)).length

  return (
    <div className="space-y-5">
      <SectionHeader title="MCP Servers" desc="Conecta servidores Model Context Protocol para que el agente use herramientas externas (filesystem, GitHub, DBs, etc)." />

      {error && <ErrorToast msg={error} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[0.6rem] text-[#999999]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C9]" />
            {runningCount}/{servers.length} conectado(s)
          </span>
          <span className="text-[#555555]">·</span>
          <span>{tools.length} herramienta(s) disponible(s)</span>
        </div>
        <div className="flex gap-1.5">
          <ActionButton variant="ghost" small onClick={load}><RefreshIcon />Recargar</ActionButton>
          <ActionButton variant="secondary" small onClick={restartAll} disabled={actionLoading === '__all__' || servers.length === 0}>
            {actionLoading === '__all__' ? <Spinner /> : <RefreshIcon />}Reiniciar todos
          </ActionButton>
          <ActionButton variant="primary" small onClick={startNew}>+ Añadir servidor</ActionButton>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Spinner />
          <span className="text-[0.65rem] text-[#999999]">Cargando servidores MCP...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {editingIdx !== null && (
            <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(0,229,201,0.2)] space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[0.65rem] font-semibold text-white uppercase tracking-wider">
                  {editingIdx < 0 ? 'Nuevo servidor MCP' : 'Editar servidor MCP'}
                </span>
                <button onClick={() => { setEditingIdx(null); setError(null) }} className="text-[0.6rem] text-[#666666] hover:text-white transition-colors">Cancelar</button>
              </div>
              <div>
                <label className="block text-[0.6rem] font-medium text-[#999999] mb-1">Nombre único</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="filesystem, github, postgres..."
                  className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[0.6rem] font-medium text-[#999999] mb-1">Comando</label>
                <input
                  value={editCommand}
                  onChange={e => setEditCommand(e.target.value)}
                  placeholder="npx · python · /ruta/al/server"
                  className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-[0.6rem] font-medium text-[#999999] mb-1">Argumentos (separados por espacio)</label>
                <input
                  value={editArgs}
                  onChange={e => setEditArgs(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  className="w-full px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors font-mono"
                />
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                <div>
                  <div className="text-[0.65rem] text-white font-medium">Habilitado</div>
                  <div className="text-[0.5rem] text-[#999999]">Iniciar automáticamente al arrancar</div>
                </div>
                <Switch checked={editEnabled} onChange={setEditEnabled} />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <ActionButton variant="ghost" small onClick={() => { setEditingIdx(null); setError(null) }}>Cancelar</ActionButton>
                <ActionButton variant="primary" small onClick={saveEdit} disabled={!editName.trim() || !editCommand.trim()}>Guardar</ActionButton>
              </div>
            </div>
          )}

          {servers.length === 0 && editingIdx === null && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <p className="text-[0.7rem] text-[#999999]">Sin servidores MCP configurados</p>
              <p className="text-[0.6rem] text-[#666666] max-w-[360px] text-center leading-relaxed">
                MCP (Model Context Protocol) permite al agente usar herramientas externas como sistemas de archivos, GitHub o bases de datos. Añade un servidor para empezar.
              </p>
              <ActionButton variant="primary" small onClick={startNew}>+ Añadir primer servidor</ActionButton>
            </div>
          )}

          {servers.map((s, idx) => {
            const running = isRunning(s.name)
            const serverTools = tools.filter(t => t.server_name === s.name)
            return (
              <div key={s.name + '_' + idx} className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    running
                      ? 'bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.2)]'
                      : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'
                  }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={running ? '#00E5C9' : '#666666'} strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[0.7rem] font-semibold text-white">{s.name}</span>
                      <span className={`text-[0.5rem] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wide ${
                        running
                          ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border-[rgba(0,229,201,0.25)]'
                          : s.enabled
                            ? 'bg-[rgba(255,255,255,0.04)] text-[#999999] border-[rgba(255,255,255,0.08)]'
                            : 'bg-[rgba(255,255,255,0.02)] text-[#666666] border-[rgba(255,255,255,0.04)]'
                      }`}>
                        {running ? 'Conectado' : s.enabled ? 'Detenido' : 'Deshabilitado'}
                      </span>
                    </div>
                    <div className="text-[0.6rem] text-[#999999] font-mono mt-1 truncate" title={`${s.command} ${s.args.join(' ')}`}>
                      {s.command} {s.args.join(' ')}
                    </div>
                    {serverTools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {serverTools.map(t => (
                          <span key={t.name} className="text-[0.5rem] px-1.5 py-0.5 rounded-md bg-[rgba(0,229,201,0.06)] text-[#00E5C9] border border-[rgba(0,229,201,0.15)] font-mono" title={t.description}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Switch checked={s.enabled} onChange={() => toggleEnabled(idx)} />
                </div>
                <div className="flex gap-1.5 justify-end pt-1 border-t border-[rgba(255,255,255,0.04)]">
                  <ActionButton variant="ghost" small onClick={() => editServer(idx)}>Editar</ActionButton>
                  {running ? (
                    <ActionButton variant="secondary" small onClick={() => stopServer(idx)} disabled={actionLoading === s.name}>
                      {actionLoading === s.name ? <Spinner /> : null}Detener
                    </ActionButton>
                  ) : (
                    <ActionButton variant="primary" small onClick={() => startServer(idx)} disabled={!s.enabled || actionLoading === s.name}>
                      {actionLoading === s.name ? <Spinner /> : null}Iniciar
                    </ActionButton>
                  )}
                  <ActionButton variant="danger" small onClick={() => removeServer(idx)}>Eliminar</ActionButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════
   REUSABLE COMPONENTS
   ════════════════════════════════ */

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#00E5C9]/30 ${checked ? 'bg-[#00E5C9]' : 'bg-[#666666]/40'}`}>
      <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-1 h-3.5 rounded-full" style={{ backgroundColor: color }} />
        <h4 className="text-[0.65rem] font-semibold text-[#E5E5E5] uppercase tracking-[0.06em]">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function SectionHeader({ icon, title, desc, badge, badgeColor }: { icon?: React.ReactNode; title: string; desc: string; badge?: string; badgeColor?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[#00E5C9]/10 border border-[#00E5C9]/15 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[0.8rem] font-semibold text-[#E5E5E5]">{title}</h3>
          {badge && (
            <span className={`text-[0.5rem] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wide ${
              badgeColor === '#00E5C9'
                ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border-[rgba(0,229,201,0.25)]'
                : 'bg-[rgba(255,255,255,0.04)] text-[#999999] border-[rgba(255,255,255,0.08)]'
            }`}>{badge}</span>
          )}
        </div>
        <p className="text-[0.625rem] text-[#999999] mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
      <div>
        <div className="text-[0.65rem] text-white font-medium">{label}</div>
        <div className="text-[0.5rem] text-[#999999]">{desc}</div>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] text-center">
      <div className="text-[0.9rem] text-[#00E5C9] font-mono font-bold">{value}</div>
      <div className="text-[0.55rem] text-[#999999] mt-0.5">{label}</div>
    </div>
  )
}

function SliderControl({ label, value, min, max, step, onChange, descLeft, descRight, color }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
  descLeft: string; descRight: string; color: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[0.625rem] font-medium text-[#999999]">{label}</label>
        <span className="text-[0.65rem] font-mono font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="relative">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`
          }}
        />
      </div>
      <div className="flex justify-between text-[0.5rem] text-[#666666] mt-1">
        <span>{descLeft}</span>
        <span>{descRight}</span>
      </div>
    </div>
  )
}

function ActionButton({ variant, small, onClick, disabled, children }: {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost'
  small?: boolean
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const styles = {
    primary: 'bg-[#00E5C9]/10 border-[#00E5C9]/25 text-[#00E5C9] hover:bg-[#00E5C9]/20 hover:border-[#00E5C9]/40',
    secondary: 'bg-[#2A2A2A] border-[rgba(255,255,255,0.08)] text-[#E5E5E5] hover:border-[rgba(255,255,255,0.15)] hover:bg-[#333]',
    danger: 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.18)] hover:border-[rgba(239,68,68,0.5)]',
    ghost: 'bg-transparent border-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white hover:border-[rgba(255,255,255,0.12)]'
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${small ? 'px-2.5 py-1.5 text-[0.6rem]' : 'px-3 py-2 text-[0.65rem]'} rounded-lg border font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${styles[variant]}`}>
      {children}
    </button>
  )
}

function ErrorToast({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span className="text-[0.6rem] text-[#ef4444]">{msg}</span>
    </div>
  )
}

function ProviderStatusDot({ configured, active }: { configured: boolean; active: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${configured ? 'bg-[#00E5C9]' : active ? 'bg-[#666666]' : 'bg-[#444]'}`} />
}

function SkillRow({ skill, onToggle, alwaysEnabled }: { skill: { name: string; description: string; enabled: boolean; path: string; source: string }; onToggle?: (name: string, enabled: boolean) => void; alwaysEnabled?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.1)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${skill.enabled ? 'bg-[#00E5C9]' : 'bg-[#666666]'}`} />
          <span className="text-[0.75rem] font-medium text-white truncate">{skill.name}</span>
          {alwaysEnabled && <span className="text-[0.45rem] px-1 py-0.5 rounded bg-[rgba(220,178,99,0.1)] text-[#DCB263] uppercase tracking-[0.05em]">Proyecto</span>}
        </div>
        {skill.description && <div className="text-[0.6rem] text-[#999999] mt-0.5 line-clamp-2">{skill.description}</div>}
      </div>
      {!alwaysEnabled && onToggle && (
        <Switch checked={skill.enabled} onChange={v => onToggle(skill.name, v)} />
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
    setLoading(true); setError(null)
    try { const { invoke } = await import('@tauri-apps/api/core'); const list = await invoke<string[]>('ollama_models'); setModels(list) }
    catch (e: any) { setError(e?.toString() || 'Error') }
    setLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const handlePull = useCallback(async () => {
    const name = pullName.trim(); if (!name) return
    setPulling(true); setMessage(null)
    try { const { invoke } = await import('@tauri-apps/api/core'); const result = await invoke<string>('ollama_pull_model', { modelName: name }); setMessage(result); setPullName(''); loadModels() }
    catch (e: any) { setMessage(`Error: ${e?.toString() || 'Error'}`) }
    setPulling(false)
  }, [pullName, loadModels])

  const handleDelete = useCallback(async (name: string) => {
    try { const { invoke } = await import('@tauri-apps/api/core'); const result = await invoke<string>('ollama_delete_model', { modelName: name }); setMessage(result); loadModels() }
    catch (e: any) { setMessage(`Error: ${e?.toString() || 'Error'}`) }
  }, [loadModels])

  return (
    <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] space-y-3">
      <div>
        <label className="block text-[0.625rem] font-medium text-[#999999] mb-1.5">Modelos instalados</label>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[0.65rem] text-[#666666]"><Spinner /> Cargando...</div>
        ) : error ? (
          <div className="text-[0.65rem] text-[#ef4444] py-2">{error}</div>
        ) : models.length === 0 ? (
          <div className="text-[0.65rem] text-[#666666] py-2">No hay modelos instalados</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {models.map(m => (
              <div key={m} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.04)]">
                <span className="text-[0.6rem] text-[#E5E5E5] font-mono">{m}</span>
                <button onClick={() => handleDelete(m)} className="flex items-center justify-center w-4 h-4 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#666666] hover:text-[#ef4444] transition-colors">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input value={pullName} onChange={e => setPullName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePull()} placeholder="Ej: qwen3.5, llama3.2..." disabled={pulling}
          className="flex-1 px-3 py-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors disabled:opacity-50" />
        <ActionButton variant="primary" onClick={handlePull} disabled={pulling || !pullName.trim()}>
          {pulling && <Spinner />}
          {pulling ? 'Descargando...' : 'Descargar'}
        </ActionButton>
      </div>
      {message && <div className={`text-[0.6rem] ${message.startsWith('Error') ? 'text-[#ef4444]' : 'text-[#00E5C9]'}`}>{message}</div>}
    </div>
  )
}

/* ════════════════════════════════
   COOKBOOK TAB
   ════════════════════════════════ */

interface CookbookModel {
  id: string
  name: string
  description: string
  descriptionEs: string
  category: string
  tags: string[]
  sizeGb: number
  vramRequiredGb: number
  contextWindow: number
  quantization: string
  hfRepo: string
  hfFile: string
  license: string
  languages: string[]
  benchmarkMmlu: number | null
  benchmarkHumaneval: number | null
  benchmarkGsm8k: number | null
}

interface CookbookHardware {
  cpu: { name: string; cores: number; threads: number }
  ram: { totalGb: number; availableGb: number }
  gpus: { name: string; vramGb: number; vendor: string }[]
  disks: { mountPoint: string; totalGb: number; availableGb: number }[]
}

interface CookbookDownloaded {
  id: string
  name: string
  filePath: string
  sizeBytes: number
  downloadedAt: string
  ollamaModel: string | null
  status: string
}

function CookbookTab({ lang }: { lang: Lang }) {
  const [hw, setHw] = useState<CookbookHardware | null>(null)
  const [hwLoading, setHwLoading] = useState(false)
  const [catalog, setCatalog] = useState<CookbookModel[]>([])
  const [downloaded, setDownloaded] = useState<CookbookDownloaded[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{
    downloaded: number; total: number; speedMbps: number; etaSecs: number; status: string
  } | null>(null)
  const [loadingOllama, setLoadingOllama] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const models = await invoke<CookbookModel[]>('cookbook_list_models', 
        categoryFilter ? { category: categoryFilter } : {})
      setCatalog(models)
    } catch (e) {
      setActionMessage({ type: 'error', text: String(e) })
    }
    setCatalogLoading(false)
  }, [categoryFilter])

  const loadDownloaded = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<CookbookDownloaded[]>('cookbook_list_downloaded')
      setDownloaded(list)
    } catch {}
  }, [])

  const scanHardware = useCallback(async () => {
    setHwLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const info = await invoke<CookbookHardware>('cookbook_scan_hardware')
      setHw(info)
    } catch (e) {
      setActionMessage({ type: 'error', text: String(e) })
    }
    setHwLoading(false)
  }, [])

  useEffect(() => { loadCatalog(); loadDownloaded(); scanHardware() }, [loadCatalog, loadDownloaded, scanHardware])

  // Listen for download progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{
        streamId: string; modelId: string; downloaded: number; total: number
        speedMbps: number; etaSecs: number; status: string
      }>('cookbook://progress', (event) => {
        setDownloadProgress(event.payload)
        if (event.payload.status === 'complete' || event.payload.status === 'cancelled') {
          setDownloadingId(null)
          setDownloadProgress(null)
          loadDownloaded()
          if (event.payload.status === 'complete') {
            setActionMessage({ type: 'success', text: 'Descarga completada' })
          }
        }
      }).then(fn => { unlisten = fn })
    })
    return () => { unlisten?.() }
  }, [loadDownloaded])

  const handleDownload = async (modelId: string) => {
    if (downloadingId) return
    setDownloadingId(modelId)
    setDownloadProgress(null)
    setActionMessage(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('cookbook_download_model', { 
        streamId: `cookbook-${modelId}`, 
        modelId 
      })
    } catch (e) {
      setActionMessage({ type: 'error', text: String(e) })
      setDownloadingId(null)
      setDownloadProgress(null)
    }
  }

  const handleCancelDownload = async () => {
    if (!downloadingId) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('cookbook_cancel_download', { streamId: `cookbook-${downloadingId}` })
    } catch {}
  }

  const handleServe = async (modelId: string) => {
    setLoadingOllama(modelId)
    setActionMessage(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('cookbook_create_ollama_model', { modelId })
      setActionMessage({ type: 'success', text: result })
      loadDownloaded()
    } catch (e) {
      setActionMessage({ type: 'error', text: String(e) })
    }
    setLoadingOllama(null)
  }

  const handleDelete = async (modelId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('cookbook_delete_model', { modelId })
      loadDownloaded()
    } catch (e) {
      setActionMessage({ type: 'error', text: String(e) })
    }
  }

  const filteredCatalog = catalog.filter(m => {
    if (filter && !m.name.toLowerCase().includes(filter.toLowerCase()) && 
        !m.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))) return false
    return true
  })

  const isDownloaded = (id: string) => downloaded.some(d => d.id === id)
  const getDownloadedStatus = (id: string) => downloaded.find(d => d.id === id)?.status
  const hasGpu = hw?.gpus && hw.gpus.length > 0 && hw.gpus.some(g => g.vramGb > 0)
  const maxVram = hw?.gpus ? Math.max(...hw.gpus.map(g => g.vramGb), 0) : 0

  const formatSize = (gb: number) => gb >= 1 ? `${gb.toFixed(1)} GB` : `${(gb * 1024).toFixed(0)} MB`
  const formatBytes = (bytes: number) => bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`

  const canRun = (vramReq: number) => vramReq <= 0.5 || !hasGpu || vramReq <= maxVram

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
        title={t('cookbook.title', lang)}
        desc={lang === 'es' 
          ? 'Descubre, descarga y sirve modelos GGUF optimizados para tu hardware. Integración directa con Ollama.'
          : 'Discover, download and serve GGUF models optimized for your hardware. Direct Ollama integration.'}
      />

      {actionMessage && (
        <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border ${
          actionMessage.type === 'success' 
            ? 'bg-[rgba(0,229,201,0.06)] border-[rgba(0,229,201,0.15)]' 
            : 'bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.15)]'
        }`}>
          {actionMessage.type === 'success' ? <CheckIcon /> : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          <span className={`text-[0.6rem] ${actionMessage.type === 'success' ? 'text-[#00E5C9]' : 'text-[#ef4444]'}`}>
            {actionMessage.text}
          </span>
        </div>
      )}

      {/* Hardware summary */}
      {hw && (
        <div className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.55rem] text-[#999999] uppercase tracking-wider">{t('cookbook.hardware', lang)}</span>
            <button onClick={scanHardware} disabled={hwLoading} className="text-[0.55rem] text-[#666666] hover:text-white transition-colors">
              {hwLoading ? <Spinner /> : <RefreshIcon />}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.04)] text-center">
              <div className="text-[0.5rem] text-[#999999]">{t('cookbook.cpu', lang)}</div>
              <div className="text-[0.65rem] text-white font-mono mt-0.5">{hw.cpu.cores}c/{hw.cpu.threads}t</div>
              <div className="text-[0.45rem] text-[#666666] truncate">{hw.cpu.name.split('@')[0].trim().slice(0, 18)}</div>
            </div>
            <div className="p-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.04)] text-center">
              <div className="text-[0.5rem] text-[#999999]">{t('cookbook.ram', lang)}</div>
              <div className="text-[0.65rem] text-white font-mono mt-0.5">{hw.ram.totalGb.toFixed(1)} GB</div>
              <div className="text-[0.45rem] text-[#666666]">{hw.ram.availableGb.toFixed(1)} GB libre</div>
            </div>
            <div className="p-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.04)] text-center">
              <div className="text-[0.5rem] text-[#999999]">{t('cookbook.gpu', lang)}</div>
              {hw.gpus.length > 0 ? (
                <>
                  <div className="text-[0.65rem] text-[#00E5C9] font-mono mt-0.5">{hw.gpus[0].vramGb > 0 ? `${hw.gpus[0].vramGb.toFixed(1)} GB` : 'N/A'}</div>
                  <div className="text-[0.45rem] text-[#666666] truncate">{hw.gpus[0].name.slice(0, 18)}</div>
                </>
              ) : (
                <div className="text-[0.5rem] text-[#666666] mt-0.5">No detectada</div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-[#222] border border-[rgba(255,255,255,0.04)] text-center">
              <div className="text-[0.5rem] text-[#999999]">{t('cookbook.disk', lang)}</div>
              {hw.disks.length > 0 ? (
                <>
                  <div className="text-[0.65rem] text-white font-mono mt-0.5">{hw.disks[0].availableGb.toFixed(0)} GB</div>
                  <div className="text-[0.45rem] text-[#666666]">libre</div>
                </>
              ) : (
                <div className="text-[0.5rem] text-[#666666] mt-0.5">N/A</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Download progress */}
      {downloadingId && downloadProgress && (
        <div className="p-3 rounded-xl bg-[rgba(0,229,201,0.04)] border border-[rgba(0,229,201,0.12)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.6rem] text-[#00E5C9] font-medium">
              {t('cookbook.downloading', lang)}: {catalog.find(m => m.id === downloadingId)?.name || downloadingId}
            </span>
            <button onClick={handleCancelDownload} className="text-[0.55rem] text-[#999999] hover:text-white transition-colors">
              {t('cookbook.cancel', lang)}
            </button>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00E5C9] transition-all duration-300"
              style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.downloaded / downloadProgress.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[0.5rem] text-[#999999]">
            <span>
              {formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}
            </span>
            <span>
              {downloadProgress.speedMbps > 0 ? `${downloadProgress.speedMbps} MB/s` : ''}
              {downloadProgress.etaSecs > 0 ? ` · ${Math.ceil(downloadProgress.etaSecs / 60)} min` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Downloaded models */}
      {downloaded.length > 0 && (
        <Section title={t('cookbook.downloaded_models', lang)} color="#DCB263">
          <div className="space-y-1.5">
            {downloaded.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'serving' ? 'bg-[#00E5C9]' : 'bg-[#DCB263]'}`} />
                    <span className="text-[0.7rem] font-medium text-white truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[0.5rem] text-[#999999]">{formatBytes(m.sizeBytes)}</span>
                    {m.ollamaModel && <span className="text-[0.5rem] text-[#00E5C9] font-mono">ollama:{m.ollamaModel}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {m.status !== 'serving' && (
                    <ActionButton variant="ghost" small onClick={() => handleServe(m.id)} disabled={loadingOllama === m.id}>
                      {loadingOllama === m.id ? <Spinner /> : null}
                      {t('cookbook.serve', lang)}
                    </ActionButton>
                  )}
                  <ActionButton variant="ghost" small onClick={() => handleDelete(m.id)}>
                    <TrashIcon />
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Model catalog filters */}
      <Section title={t('cookbook.catalog', lang)} color="#00E5C9">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={t('cookbook.search_models', lang)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <select
              value={categoryFilter || ''}
              onChange={e => setCategoryFilter(e.target.value || null)}
              className="px-2.5 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] text-[0.6rem] text-white outline-none focus:border-[#DCB263] transition-colors appearance-none cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="chat">Chat</option>
              <option value="code">Código</option>
              <option value="reasoning">Razonamiento</option>
              <option value="embedding">Embedding</option>
            </select>
          </div>

          {/* Catalog grid */}
          {catalogLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Spinner />
              <span className="text-[0.6rem] text-[#999999]">{lang === 'es' ? 'Cargando catálogo...' : 'Loading catalog...'}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredCatalog.map(m => {
                const dled = isDownloaded(m.id)
                const dledStatus = getDownloadedStatus(m.id)
                const willRun = canRun(m.vramRequiredGb)
                return (
                  <div key={m.id} className="p-3 rounded-xl bg-[#2A2A2A] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[0.7rem] font-semibold text-white">{m.name}</span>
                          <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.04)] text-[#999999] border border-[rgba(255,255,255,0.06)]">{m.quantization}</span>
                          {m.tags.includes('recommended') && (
                            <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border border-[rgba(0,229,201,0.15)]">★ {t('cookbook.recommended', lang)}</span>
                          )}
                          {m.vramRequiredGb <= 0.5 && (
                            <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[rgba(220,178,99,0.08)] text-[#DCB263] border border-[rgba(220,178,99,0.15)]">CPU</span>
                          )}
                          {dledStatus === 'serving' && (
                            <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border border-[rgba(0,229,201,0.25)] uppercase tracking-wide">{t('cookbook.serving', lang)}</span>
                          )}
                        </div>
                        <div className="text-[0.6rem] text-[#999999] mt-1 leading-relaxed line-clamp-2">
                          {lang === 'es' ? m.descriptionEs : m.description}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[0.5rem] text-[#666666]">{formatSize(m.sizeGb)}</span>
                          <span className="text-[#444]">·</span>
                          <span className={`text-[0.5rem] ${willRun ? 'text-[#00E5C9]' : 'text-[rgba(239,68,68,0.6)]'}`}>{t('cookbook.vram_req', lang)}: {formatSize(m.vramRequiredGb)}</span>
                          <span className="text-[#444]">·</span>
                          <span className="text-[0.5rem] text-[#666666]">{((m.contextWindow / 1024) as number).toFixed(0)}K {t('cookbook.ctx', lang)}</span>
                          {m.hfRepo && <><span className="text-[#444]">·</span><span className="text-[0.5rem] text-[#666666]">{m.license}</span></>}
                        </div>
                        {m.benchmarkMmlu && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[0.45rem] text-[#666666]">MMLU: {m.benchmarkMmlu}%</span>
                            {m.benchmarkHumaneval && <span className="text-[0.45rem] text-[#666666]">HumanEval: {m.benchmarkHumaneval}%</span>}
                            {m.benchmarkGsm8k && <span className="text-[0.45rem] text-[#666666]">GSM8K: {m.benchmarkGsm8k}%</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {dledStatus === 'serving' ? (
                          <span className="px-2 py-1.5 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9] text-[0.55rem] font-medium">{t('cookbook.serving', lang)}</span>
                        ) : dled ? (
                          <ActionButton variant="ghost" small onClick={() => handleServe(m.id)} disabled={loadingOllama === m.id}>
                            {loadingOllama === m.id ? <Spinner /> : null}
                            {t('cookbook.serve', lang)}
                          </ActionButton>
                        ) : m.hfRepo ? (
                          <ActionButton
                            variant="primary"
                            small
                            onClick={() => handleDownload(m.id)}
                            disabled={downloadingId === m.id || (downloadingId !== null)}
                          >
                            {downloadingId === m.id ? <Spinner /> : null}
                            {downloadingId === m.id ? t('cookbook.downloading', lang) : t('cookbook.download', lang)}
                          </ActionButton>
                        ) : (
                          <span className="text-[0.55rem] text-[#666666] px-2 py-1.5">Ollama pull</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

/* ════════════════════════════════
   UTILITIES
   ════════════════════════════════ */

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

/* ════════════════════════════════
   ICONS (inline SVG)
   ════════════════════════════════ */

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const c = active ? '#00E5C9' : '#999999'
  const icons: Record<string, React.ReactNode> = {
    general: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    providers: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    skills: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
    memory: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18"/></svg>,
    mcp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    cookbook: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    audit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  }
  return <span className="shrink-0">{icons[name]}</span>
}

function FolderIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> }
function SearchFolderIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg> }
function TrashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> }
function ExportIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function ImportIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> }
function RefreshIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> }
function CheckIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> }
function SearchSmallIcon() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function FileIcon() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg> }
function Spinner() { return <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> }
