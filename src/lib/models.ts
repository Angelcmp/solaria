/**
 * Registro central de proveedores y modelos.
 *
 * Única fuente de verdad para las listas de modelos y sus capacidades. La UI
 * (selector de modelo, ajustes, comparador) y el agente leen de aquí, en vez
 * de mantener copias por componente. Los proveedores definidos por el usuario
 * se añaden dinámicamente en `App` a partir de `settings.customProviders`.
 */

export type ApiType = 'openai' | 'anthropic' | 'google' | 'cohere'

export interface ModelInfo {
  id: string
  label?: string
  /** Ventana de contexto en tokens (aprox.). */
  context?: number
  /** Soporta function calling nativo. */
  tools?: boolean
  /** Soporta entrada de imágenes. */
  vision?: boolean
  /** Modelo de razonamiento (thinking). */
  reasoning?: boolean
}

export interface ProviderInfo {
  id: string
  label: string
  local: boolean
  apiType: ApiType
  /** Pista del formato de la API key para la UI. */
  keyPlaceholder?: string
  models: ModelInfo[]
}

/** Vista mínima que consumen el selector de modelo y el comparador. */
export interface ProviderOption {
  id: string
  label: string
  models: string[]
  local: boolean
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'ollama',
    label: 'Ollama',
    local: true,
    apiType: 'openai',
    models: [
      { id: 'qwen3', tools: true, context: 32768 },
      { id: 'llama3.2', tools: true, context: 131072 },
      { id: 'llama3.1', tools: true, context: 131072 },
      { id: 'mistral', tools: true, context: 32768 },
      { id: 'phi3', tools: false, context: 4096 },
      { id: 'deepseek-r1', tools: false, reasoning: true, context: 65536 },
      { id: 'gemma3', tools: true, vision: true, context: 131072 },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    local: false,
    apiType: 'openai',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'gpt-5.5', tools: true, vision: true, context: 400000 },
      { id: 'gpt-5-mini', tools: true, vision: true, context: 400000 },
      { id: 'gpt-4.1-mini', tools: true, vision: true, context: 1000000 },
      { id: 'gpt-4o-mini', tools: true, vision: true, context: 128000 },
      { id: 'gpt-4o', tools: true, vision: true, context: 128000 },
      { id: 'gpt-4-turbo', tools: true, vision: true, context: 128000 },
      { id: 'o1', tools: true, reasoning: true, context: 200000 },
      { id: 'o3-mini', tools: true, reasoning: true, context: 200000 },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    local: false,
    apiType: 'anthropic',
    keyPlaceholder: 'sk-ant-...',
    models: [
      { id: 'claude-sonnet-5', tools: true, vision: true, context: 200000 },
      { id: 'claude-opus-4-8', tools: true, vision: true, context: 200000 },
      { id: 'claude-haiku-4-5-20251001', tools: true, vision: true, context: 200000 },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    local: false,
    apiType: 'openai',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'deepseek-chat', tools: true, context: 128000 },
      { id: 'deepseek-reasoner', tools: false, reasoning: true, context: 128000 },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    local: false,
    apiType: 'openai',
    keyPlaceholder: 'gsk_...',
    models: [
      { id: 'llama-3.3-70b-versatile', tools: true, context: 131072 },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', tools: true, context: 131072 },
      { id: 'llama-3.1-8b-instant', tools: true, context: 131072 },
      { id: 'openai/gpt-oss-20b', tools: true, context: 131072 },
    ],
  },
  {
    id: 'google',
    label: 'Google (Gemini)',
    local: false,
    apiType: 'google',
    keyPlaceholder: 'AIza...',
    models: [
      { id: 'gemini-3.6-flash', tools: true, vision: true, context: 1000000 },
      { id: 'gemini-3.5-flash', tools: true, vision: true, context: 1000000 },
      { id: 'gemini-3.5-flash-lite', tools: true, vision: true, context: 1000000 },
      { id: 'gemini-2.5-flash', tools: true, vision: true, context: 1000000 },
      { id: 'gemini-1.5-flash', tools: true, vision: true, context: 1000000 },
      { id: 'gemini-1.5-pro', tools: true, vision: true, context: 2000000 },
    ],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    local: false,
    apiType: 'cohere',
    keyPlaceholder: '...',
    models: [
      { id: 'command-a-03-2025', tools: true, context: 256000 },
      { id: 'command-r-plus', tools: true, context: 128000 },
      { id: 'command-r7b-12-2024', tools: true, context: 128000 },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    local: false,
    apiType: 'openai',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'moonshot-v1-8k', tools: true, context: 8192 },
      { id: 'moonshot-v1-32k', tools: true, context: 32768 },
      { id: 'moonshot-v1-128k', tools: true, context: 131072 },
    ],
  },
  {
    id: 'glm',
    label: 'GLM (Z.ai)',
    local: false,
    apiType: 'openai',
    keyPlaceholder: '...',
    models: [
      { id: 'glm-4-plus', tools: true, context: 128000 },
      { id: 'glm-4-air', tools: true, context: 128000 },
      { id: 'glm-4-flash', tools: true, context: 128000 },
    ],
  },
]

/** Lista plana para componentes que solo necesitan `{id, label, models[], local}`. */
export const PROVIDER_OPTIONS: ProviderOption[] = PROVIDERS.map(p => ({
  id: p.id,
  label: p.label,
  models: p.models.map(m => m.id),
  local: p.local,
}))

/** Proveedores cloud con API key (para la pestaña de Proveedores). */
export const API_PROVIDERS: ProviderInfo[] = PROVIDERS.filter(p => !p.local)

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find(p => p.id === id)
}

export function getProviderLabel(id: string): string {
  return getProvider(id)?.label ?? id
}

export function providerModelIds(id: string): string[] {
  return getProvider(id)?.models.map(m => m.id) ?? []
}

export function getModel(providerId: string, modelId: string): ModelInfo | undefined {
  return getProvider(providerId)?.models.find(m => m.id === modelId)
}

/** ¿El proveedor soporta function calling nativo (a nivel de proveedor)? */
export function providerSupportsTools(providerId: string): boolean {
  const provider = getProvider(providerId)
  if (!provider) return true
  return provider.models.some(m => m.tools)
}

/** ¿El modelo concreto soporta function calling nativo? */
export function modelSupportsTools(providerId: string, modelId: string): boolean {
  const model = getModel(providerId, modelId)
  if (!model) return providerSupportsTools(providerId)
  return model.tools === true
}
