import { describe, it, expect } from 'vitest'
import {
  denialMessage,
  requiresPreConfirmation,
  type PendingConfirmation,
} from '../agent/permissions'

describe('permissions primitive', () => {
  it('only pre-confirms write_file when confirmWrite is on', () => {
    expect(requiresPreConfirmation('write_file', true)).toBe(true)
    expect(requiresPreConfirmation('write_file', false)).toBe(false)
    expect(requiresPreConfirmation('read_file', true)).toBe(false)
    expect(requiresPreConfirmation('shell', true)).toBe(false)
  })

  it('builds a denial message that names the tool', () => {
    expect(denialMessage('write_file')).toContain('write_file')
    expect(denialMessage('shell')).toContain('shell')
  })

  it('keeps a stable shape for a pending confirmation', () => {
    const pending: PendingConfirmation = {
      id: 'confirm_abc',
      toolName: 'write_file',
      args: { path: 'a.txt', content: 'hi' },
      warning: 'Escribir archivo - requiere confirmación',
    }
    expect(pending.id).toBe('confirm_abc')
    expect(pending.args.path).toBe('a.txt')
    expect(pending.warning.length).toBeGreaterThan(0)
  })
})
