import { describe, it, expect } from 'vitest'
import { t } from '../lib/i18n'

describe('i18n', () => {
  it('returns Spanish translation', () => {
    expect(t('chat.welcome.title', 'es')).toBe('Bienvenido a Solaria')
    expect(t('settings.title', 'es')).toBe('Configuración')
    expect(t('sidebar.new', 'es')).toBe('Nueva conversación')
  })

  it('returns English translation', () => {
    expect(t('chat.welcome.title', 'en')).toBe('Welcome to Solaria')
    expect(t('settings.title', 'en')).toBe('Settings')
    expect(t('sidebar.new', 'en')).toBe('New conversation')
  })

  it('returns the key for unknown translations', () => {
    expect(t('nonexistent.key', 'es')).toBe('nonexistent.key')
    expect(t('nonexistent.key', 'en')).toBe('nonexistent.key')
  })
})
