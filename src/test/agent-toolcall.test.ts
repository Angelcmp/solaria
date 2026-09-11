import { describe, it, expect } from 'vitest'
import { extractToolCall, toOpenAiTools } from '../hooks/useAgent'
import { normalizeToolTags, stripToolCallsForDisplay } from '../lib/toolCallText'

describe('extractToolCall — reparación de tool_calls malformados', () => {
  it('repara el caso de DeepSeek (coma faltante + espacio en el nombre)', () => {
    const raw =
      'Ahora voy a leer styles.css.\n\n' +
      '<tool_call> {"name": "read_file "arguments": {"path": "/home/angel/Documentos/preguntacita/styles.css"}} </tool_call>'
    const call = extractToolCall(raw)
    expect(call).not.toBeNull()
    expect(call!.name).toBe('read_file')
    expect(call!.arguments.path).toBe('/home/angel/Documentos/preguntacita/styles.css')
  })

  it('repara el caso de GPT-4o (<tool> + cierre "tool_call>" + "name "glob")', () => {
    const raw = '<tool> {"name "glob", "arguments": {"pattern": "**/*"}} tool_call>'
    const call = extractToolCall(raw)
    expect(call).not.toBeNull()
    expect(call!.name).toBe('glob')
    expect(call!.arguments.pattern).toBe('**/*')
  })

  it('acepta JSON bien formado', () => {
    const call = extractToolCall('<tool_call>{"name": "glob", "arguments": {"pattern": "**/*"}}</tool_call>')
    expect(call).toEqual({ name: 'glob', arguments: { pattern: '**/*' } })
  })

  it('repara la coma faltante conservando las comillas', () => {
    const call = extractToolCall('<tool_call>{"name": "grep" "arguments": {"pattern": "foo"}}</tool_call>')
    expect(call?.name).toBe('grep')
    expect(call?.arguments.pattern).toBe('foo')
  })

  it('repara arguments sin comilla de apertura', () => {
    const call = extractToolCall('<tool_call>{"name": "read_file" arguments: {"path": "a.txt"}}</tool_call>')
    expect(call?.name).toBe('read_file')
    expect(call?.arguments.path).toBe('a.txt')
  })

  it('devuelve null cuando no hay tool_call', () => {
    expect(extractToolCall('hola, sin herramientas')).toBeNull()
  })
})

describe('stripToolCallsForDisplay', () => {
  it('oculta el JSON crudo incluso con etiquetas corruptas', () => {
    const raw =
      'ya lo tengo.\n\n<tool> {"name "glob", "arguments": {"pattern": "**/*"}} tool_call>\n\nReviso la carpeta.'
    const clean = stripToolCallsForDisplay(raw)
    expect(clean).not.toContain('glob')
    expect(clean).toContain('ya lo tengo.')
  })

  it('oculta un tool_call a medio streamear', () => {
    const clean = stripToolCallsForDisplay('pensando… <tool_call> {"name": "read_file", "argum')
    expect(clean).toBe('pensando…')
  })
})

describe('normalizeToolTags', () => {
  it('normaliza <tool> y cierres sin ángulo', () => {
    const out = normalizeToolTags('<tool> {} tool_call>')
    expect(out).toBe('<tool_call> {} </tool_call>')
  })
})

describe('toOpenAiTools — esquema de function calling', () => {
  it('convierte las herramientas permitidas al formato de OpenAI', () => {
    const tools = toOpenAiTools(['read_file', 'write_file']) as Array<{
      type: string
      function: { name: string; parameters: { properties: Record<string, unknown>; required: string[] } }
    }>
    expect(tools).toHaveLength(2)
    const read = tools.find(t => t.function.name === 'read_file')!
    expect(read.type).toBe('function')
    expect(read.function.parameters.properties).toHaveProperty('path')
    expect(read.function.parameters.required).toEqual(['path'])
  })

  it('respeta el filtro de herramientas permitidas', () => {
    const tools = toOpenAiTools(['glob']) as Array<{ function: { name: string } }>
    expect(tools.map(t => t.function.name)).toEqual(['glob'])
  })
})
