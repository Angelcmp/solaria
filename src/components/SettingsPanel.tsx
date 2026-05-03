import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ApiKeys } from '../hooks/useSettings'
import type { AgentConfig } from '../hooks/useAgent'

interface SettingsPanelProps {
  settings: AppSettings
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
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'], isLocal: false },
  { id: 'anthropic', label: 'Anthropic', models: ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-7'], isLocal: false },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'], isLocal: false },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-4-scout-17b-16e-instruct'], isLocal: false },
  { id: 'google', label: 'Google', models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-pro-preview-03-25'], isLocal: false },
  { id: 'cohere', label: 'Cohere', models: ['command-r7b-12-2024', 'command-r-plus-08-2024'], isLocal: false },
  { id: 'kimi', label: 'Kimi (Moonshot)', models: ['kimi-k2.6', 'kimi-k2-0905-preview'], isLocal: false },
  { id: 'glm', label: 'GLM (Z.AI)', models: ['glm-4.7', 'glm-4.7-flash', 'glm-4.5', 'glm-4.5-flash'], isLocal: false },
]

const AVAILABLE_TOOLS = [
  { id: 'shell', label: 'Shell', desc: 'Ejecutar comandos en terminal' },
  { id: 'read_file', label: 'Leer archivos', desc: 'Leer contenido de archivos' },
  { id: 'write_file', label: 'Escribir archivos', desc: 'Crear/modificar archivos' },
  { id: 'glob', label: 'Glob', desc: 'Buscar archivos por patrón' },
  { id: 'grep', label: 'Grep', desc: 'Buscar texto en archivos' },
]

export default function SettingsPanel({
  settings,
  onClose,
  onUpdate,
  onUpdateApiKey,
  onUpdateTavilyKey,
  onUpdateProvider,
  agentConfig,
  onUpdateAgentConfig,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<'general' | 'providers' | 'search' | 'agent' | 'audit'>('general')

  // Auto-fill working directory from CLI --working-dir if empty
  useEffect(() => {
    if (!agentConfig?.workingDirectory) {
      const load = async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const cwd = await invoke<string | null>('get_launch_cwd')
          if (cwd) onUpdateAgentConfig?.({ workingDirectory: cwd })
        } catch {}
      }
      load()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[480px] max-h-[80vh] bg-[#1C1B1B] border border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-sm font-semibold text-white">Configuración</h2>
          <button onClick={onClose} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-4 border-b border-[rgba(255,255,255,0.06)]">
          {(['general', 'providers', 'search', 'agent', 'audit'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[0.6875rem] font-medium uppercase tracking-[0.05em] border-b-2 transition-colors ${
                tab === t
                  ? 'text-[#00E5C9] border-[#00E5C9]'
                  : 'text-[#666666] border-transparent hover:text-[#E5E5E5]'
              }`}
            >
              {t === 'general' ? 'General' : t === 'providers' ? 'API Keys' : t === 'search' ? 'Búsqueda' : t === 'agent' ? 'Agente' : 'Auditoría'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
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
                <div className="flex gap-2">
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
                </div>
              </div>
            </>
          )}

          {tab === 'providers' && (
            <>
              <p className="text-[0.6875rem] text-[#666666] mb-3">Configura tus API keys para usar modelos en la nube. Las keys se guardan localmente en tu equipo.</p>
              {([
                ['openai', 'OpenAI', 'sk-...'],
                ['anthropic', 'Anthropic (Claude)', 'sk-ant-...'],
                ['deepseek', 'DeepSeek', 'sk-...'],
                ['groq', 'Groq', 'gsk_...'],
                ['google', 'Google (Gemini)', 'AIza...'],
                ['cohere', 'Cohere', '...'],
                ['kimi', 'Kimi (Moonshot)', 'sk-...'],
                ['glm', 'GLM (Z.AI)', '...'],
              ] as [keyof ApiKeys, string, string][]).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">{label}</label>
                  <input
                    type="password"
                    value={settings.apiKeys[key]}
                    onChange={(e) => onUpdateApiKey(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors"
                  />
                </div>
              ))}
            </>
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

          {tab === 'agent' && agentConfig && onUpdateAgentConfig && (
            <>
              <p className="text-[0.6875rem] text-[#666666] mb-3">Configura el comportamiento del agente de IA. El agente puede ejecutar herramientas en tu sistema para automatizar tareas.</p>

              {/* Tool Toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                <div>
                  <div className="text-[0.75rem] font-medium text-white">Modo Agente</div>
                  <div className="text-[0.625rem] text-[#999999]">Permite al modelo ejecutar herramientas</div>
                </div>
                <button
                  onClick={() => onUpdateAgentConfig({ enabled: !agentConfig.enabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    agentConfig.enabled ? 'bg-[#00E5C9]' : 'bg-[#666666]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                    agentConfig.enabled ? 'left-5' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {/* Max Iterations */}
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

              {/* Working Directory */}
              <div>
                <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">Directorio de trabajo</label>
                <div className="flex gap-1.5">
                  <input
                    value={agentConfig.workingDirectory}
                    onChange={(e) => onUpdateAgentConfig({ workingDirectory: e.target.value })}
                    placeholder="Ej: /home/user/proyecto"
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
                    title="Usar directorio actual de la terminal"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <p className="text-[0.55rem] text-[#666666] mt-0.5">
                  Si lanzas Solaria desde una terminal, la carpeta actual se detecta automáticamente.
                </p>
              </div>

              {/* Allowed Tools */}
              <div>
                <label className="block text-[0.6875rem] font-medium text-[#999999] mb-2 uppercase tracking-[0.05em]">Herramientas permitidas</label>
                <div className="space-y-1.5">
                  {AVAILABLE_TOOLS.map(tool => (
                    <label
                      key={tool.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={agentConfig.allowedTools.includes(tool.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onUpdateAgentConfig({ allowedTools: [...agentConfig.allowedTools, tool.id] })
                          } else {
                            onUpdateAgentConfig({ allowedTools: agentConfig.allowedTools.filter(t => t !== tool.id) })
                          }
                        }}
                        className="accent-[#00E5C9]"
                      />
                      <div>
                        <div className="text-[0.75rem] text-white font-medium">{tool.label}</div>
                        <div className="text-[0.625rem] text-[#999999]">{tool.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Auto Confirm */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                <div>
                  <div className="text-[0.75rem] font-medium text-white">Auto-ejecutar</div>
                  <div className="text-[0.625rem] text-[#999999]">Ejecuta herramientas sin confirmación</div>
                </div>
                <button
                  onClick={() => onUpdateAgentConfig({ autoConfirm: !agentConfig.autoConfirm })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    agentConfig.autoConfirm ? 'bg-[#00E5C9]' : 'bg-[#666666]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                    agentConfig.autoConfirm ? 'left-5' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {/* Confirm write toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                <div>
                  <div className="text-[0.75rem] font-medium text-white">Confirmar escrituras</div>
                  <div className="text-[0.625rem] text-[#999999]">Pedir confirmación antes de escribir archivos</div>
                </div>
                <button
                  onClick={() => onUpdateAgentConfig({ confirmWrite: !agentConfig.confirmWrite })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    agentConfig.confirmWrite ? 'bg-[#00E5C9]' : 'bg-[#666666]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                    agentConfig.confirmWrite ? 'left-5' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {/* Restrict to workdir toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                <div>
                  <div className="text-[0.75rem] font-medium text-white">Restringir al directorio</div>
                  <div className="text-[0.625rem] text-[#999999]">Bloquear acceso a archivos fuera del directorio de trabajo</div>
                </div>
                <button
                  onClick={() => onUpdateAgentConfig({ restrictToWorkDir: !agentConfig.restrictToWorkDir })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    agentConfig.restrictToWorkDir ? 'bg-[#00E5C9]' : 'bg-[#666666]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                    agentConfig.restrictToWorkDir ? 'left-5' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {/* Rate limit */}
              <div>
                <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">
                  Límite de herramientas: {agentConfig.rateLimit} / minuto
                </label>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={agentConfig.rateLimit}
                  onChange={(e) => onUpdateAgentConfig({ rateLimit: Number(e.target.value) })}
                  className="w-full accent-[#00E5C9]"
                />
                <div className="flex justify-between text-[0.625rem] text-[#666666]">
                  <span>5</span>
                  <span>120</span>
                </div>
              </div>

              {/* Allowlist toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                <div>
                  <div className="text-[0.75rem] font-medium text-white">Lista blanca de comandos</div>
                  <div className="text-[0.625rem] text-[#999999]">Solo permite ejecutar los comandos de la lista</div>
                </div>
                <button
                  onClick={() => onUpdateAgentConfig({ useAllowlist: !agentConfig.useAllowlist })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    agentConfig.useAllowlist ? 'bg-[#00E5C9]' : 'bg-[#666666]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                    agentConfig.useAllowlist ? 'left-5' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {agentConfig.useAllowlist && (
                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">Comandos permitidos</label>
                  <textarea
                    value={agentConfig.commandAllowlist}
                    onChange={(e) => onUpdateAgentConfig({ commandAllowlist: e.target.value })}
                    placeholder="ls,cat,echo,pwd,find,git,npm"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)] text-[0.75rem] text-white placeholder-[#666666] outline-none focus:border-[#DCB263] transition-colors font-mono resize-none"
                  />
                  <p className="text-[0.55rem] text-[#666666] mt-0.5">
                    Separados por comas. El agente solo podrá ejecutar comandos que empiecen con alguna de estas palabras.
                    Ej: <code className="text-[#DCB263]">ls</code>, <code className="text-[#DCB263]">git</code>, <code className="text-[#DCB263]">npm</code>
                  </p>
                </div>
              )}

              {/* Session timeout toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2A2A2A] border border-[rgba(255,255,255,0.08)]">
                <div>
                  <div className="text-[0.75rem] font-medium text-white">Bloqueo por inactividad</div>
                  <div className="text-[0.625rem] text-[#999999]">Bloquea el agente tras X minutos sin actividad</div>
                </div>
                <button
                  onClick={() => onUpdateAgentConfig({ sessionTimeout: agentConfig.sessionTimeout > 0 ? 0 : 5 })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    agentConfig.sessionTimeout > 0 ? 'bg-[#00E5C9]' : 'bg-[#666666]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                    agentConfig.sessionTimeout > 0 ? 'left-5' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {agentConfig.sessionTimeout > 0 && (
                <div>
                  <label className="block text-[0.6875rem] font-medium text-[#999999] mb-1 uppercase tracking-[0.05em]">
                    Tiempo de inactividad: {agentConfig.sessionTimeout} min
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={agentConfig.sessionTimeout}
                    onChange={(e) => onUpdateAgentConfig({ sessionTimeout: Number(e.target.value) })}
                    className="w-full accent-[#00E5C9]"
                  />
                  <div className="flex justify-between text-[0.625rem] text-[#666666]">
                    <span>1 min</span>
                    <span>30 min</span>
                  </div>
                </div>
              )}

              <div className="text-[0.625rem] text-[#666666] italic pt-1 border-t border-[rgba(255,255,255,0.06)]">
                Recomendado para agentes locales: Qwen2.5 o DeepSeek (vía Ollama). Para cloud: Claude Sonnet o DeepSeek V4.
              </div>
            </>
          )}

          {tab === 'audit' && (
            <AuditTab />
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
