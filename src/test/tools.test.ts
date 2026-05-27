import { describe, it, expect } from 'vitest'
import type { ToolDefinition, ToolResult } from '../lib/tools'

describe('Tool definitions type contract', () => {
  it('validates ToolDefinition structure', () => {
    const tool: ToolDefinition = {
      name: 'shell',
      description: 'Run a shell command',
      parameters: [{
        name: 'command',
        param_type: 'string',
        description: 'The command to execute',
        required: true,
      }],
    }

    expect(tool.name).toBe('shell')
    expect(tool.parameters).toHaveLength(1)
    expect(tool.parameters[0].required).toBe(true)
  })

  it('validates ToolResult structure', () => {
    const successResult: ToolResult = {
      success: true,
      output: 'test output',
      error: null,
      requires_confirmation: false,
      preview: null,
    }

    expect(successResult.success).toBe(true)
    expect(successResult.error).toBeNull()

    const errorResult: ToolResult = {
      success: false,
      output: '',
      error: 'something went wrong',
    }

    expect(errorResult.success).toBe(false)
    expect(errorResult.error).toBe('something went wrong')
  })

  it('ToolResult can have optional fields', () => {
    const minimal: ToolResult = {
      success: true,
      output: 'ok',
      error: null,
    }
    expect(minimal.requires_confirmation).toBeUndefined()
    expect(minimal.preview).toBeUndefined()
  })

  it('ToolDefinition with multiple parameters', () => {
    const writeFile: ToolDefinition = {
      name: 'write_file',
      description: 'Write content to a file',
      parameters: [
        { name: 'path', param_type: 'string', description: 'File path', required: true },
        { name: 'content', param_type: 'string', description: 'File content', required: true },
      ],
    }

    expect(writeFile.parameters).toHaveLength(2)
    expect(writeFile.parameters.every(p => p.required)).toBe(true)
  })
})
