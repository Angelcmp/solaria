import { describe, it, expect } from 'vitest'
import { t, useTranslation } from '../lib/i18n'

describe('i18n integration', () => {
  it('covers all translation keys for both languages', () => {
    const keys = [
      'chat.welcome.title', 'chat.welcome.agent', 'chat.welcome.morning',
      'chat.welcome.afternoon', 'chat.welcome.evening', 'chat.welcome.ask',
      'chat.welcome.desc', 'chat.welcome.agent_desc',
      'chat.suggest.summarize',
      'chat.placeholder', 'chat.placeholder.agent', 'chat.templates',
      'chat.search_web', 'chat.search_web.off', 'chat.copy', 'chat.regenerate',
      'chat.tokens', 'chat.error', 'chat.session_locked', 'chat.resume',
      'chat.clear', 'chat.settings', 'chat.drop_files', 'chat.attach_file',
      'chat.ollama_free', 'chat.quick_actions', 'chat.scroll_down', 'chat.scroll_up',
      'chat.injection_warn', 'chat.agent',
      'sidebar.new', 'sidebar.search', 'sidebar.no_results', 'sidebar.empty',
      'sidebar.pinned', 'sidebar.today', 'sidebar.yesterday', 'sidebar.older',
      'sidebar.pin', 'sidebar.unpin', 'sidebar.delete', 'sidebar.collapse', 'sidebar.expand',
      'settings.title', 'settings.general', 'settings.providers', 'settings.search',
      'settings.agent', 'settings.audit', 'settings.default_provider', 'settings.default_model',
      'settings.language', 'settings.llm_params', 'settings.temperature', 'settings.top_p',
      'settings.max_tokens', 'settings.storage', 'settings.clear_history', 'settings.export',
      'settings.import', 'settings.tavily_key', 'settings.agent_desc',
      'agent.running', 'agent.completed', 'agent.steps', 'agent.reasoning',
      'agent.reasoning_ellipsis', 'agent.final', 'agent.stop', 'agent.close', 'agent.init',
      'action.learn', 'action.summarize', 'action.translate', 'action.analyze',
      'action.write', 'action.ideas', 'action.improve', 'action.data',
    ]

    for (const key of keys) {
      const es = t(key, 'es')
      const en = t(key, 'en')
      expect(es).not.toBe(key)
      expect(en).not.toBe(key)
      expect(typeof es).toBe('string')
      expect(typeof en).toBe('string')
      expect(es.length).toBeGreaterThan(0)
      expect(en.length).toBeGreaterThan(0)
    }
  })

  it('useTranslation creates a bound function', () => {
    const tEs = useTranslation('es')
    const tEn = useTranslation('en')

    expect(tEs('chat.welcome.title')).toBe('Bienvenido a Solaria')
    expect(tEn('chat.welcome.title')).toBe('Welcome to Solaria')
  })

  it('returns key for missing nested translations', () => {
    expect(t('completely.fake.key.path', 'es')).toBe('completely.fake.key.path')
    expect(t('completely.fake.key.path', 'en')).toBe('completely.fake.key.path')
  })

  it('handles empty key gracefully', () => {
    expect(t('', 'es')).toBe('')
  })
})
