import { describe, it, expect } from 'vitest'
import { extractToolCall } from '../hooks/useAgent'

describe('extractToolCall — reparación de tool_calls malformados', () => {
  it('repara el caso real de DeepSeek (coma faltante + espacio en el nombre)', () => {
    const raw =
      'Ahora voy a leer styles.css.\n\n' +
      '<tool_call> {"name": "read_file "arguments": {"path": "/home/angel/Documentos/preguntacita/styles.css"}} </tool_call>'
    const call = extractToolCall(raw)
    expect(call).not.toBeNull()
    expect(call!.name).toBe('read_file')
    expect(call!.arguments.path).toBe('/home/angel/Documentos/preguntacita/styles.css')
  })

  it('acepta JSON bien formado', () => {
    const call = extractToolCall('<tool_call>{"name": "glob", "arguments": {"pattern": "**/*.md"}}</tool_call>')
    expect(call).toEqual({ name: 'glob', arguments: { pattern: '**/*.md' } })
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
