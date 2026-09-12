import { describe, it, expect } from 'vitest'
import {
  PROVIDERS,
  PROVIDER_OPTIONS,
  API_PROVIDERS,
  getProvider,
  getProviderLabel,
  getModel,
  providerModelIds,
  modelSupportsTools,
  providerSupportsTools,
} from '../lib/models'

describe('central model registry', () => {
  it('has no duplicated provider ids', () => {
    const ids = PROVIDERS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no duplicated model ids within a provider', () => {
    for (const provider of PROVIDERS) {
      const ids = provider.models.map(m => m.id)
      expect(new Set(ids).size, `${provider.id} tiene modelos repetidos`).toBe(ids.length)
    }
  })

  it('exposes a flat options view consistent with the registry', () => {
    expect(PROVIDER_OPTIONS).toHaveLength(PROVIDERS.length)
    const ollama = PROVIDER_OPTIONS.find(p => p.id === 'ollama')
    expect(ollama?.local).toBe(true)
    expect(ollama?.models).toContain('qwen3')
  })

  it('keeps only cloud providers in API_PROVIDERS', () => {
    expect(API_PROVIDERS.some(p => p.local)).toBe(false)
    expect(API_PROVIDERS.map(p => p.id)).toContain('anthropic')
    expect(API_PROVIDERS.map(p => p.id)).not.toContain('ollama')
  })

  it('reports tool capabilities per model', () => {
    expect(modelSupportsTools('deepseek', 'deepseek-chat')).toBe(true)
    expect(modelSupportsTools('deepseek', 'deepseek-reasoner')).toBe(false)
    expect(providerSupportsTools('anthropic')).toBe(true)
  })

  it('falls back sensibly for unknown providers/models', () => {
    expect(modelSupportsTools('mi-endpoint', 'cualquiera')).toBe(true)
    expect(getProviderLabel('mi-endpoint')).toBe('mi-endpoint')
    expect(providerModelIds('mi-endpoint')).toEqual([])
  })

  it('exposes lookup helpers', () => {
    expect(getProvider('openai')?.apiType).toBe('openai')
    expect(getModel('google', 'gemini-2.5-flash')?.vision).toBe(true)
  })
})
