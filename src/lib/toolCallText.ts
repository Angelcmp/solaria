/**
 * Utilidades de texto para el protocolo de tool_calls basado en etiquetas.
 *
 * Los modelos (DeepSeek, GPT-4o, etc.) a veces emiten variantes corruptas de
 * las etiquetas y del JSON. Estas funciones normalizan las etiquetas y limpian
 * el texto para que nunca se muestre el JSON crudo en la UI.
 */

/**
 * Normaliza cualquier variante de etiqueta a `<tool_call>…</tool_call>`.
 * Cubre: `<tool>`, `< tool_call >`, `</tool>`, cierres sin `<`/`/` (`tool_call>`),
 * aperturas con `{`/`[`/`(` delante, etc.
 */
export function normalizeToolTags(text: string): string {
  return text
    .replace(/TOOL\s*:\s*/gi, 'TOOL:')
    // Formas con ángulos: <tool>, <tool_call>, </tool>, </tool_call>...
    .replace(
      /[{\[\(]*<\s*\/?\s*[Tt]ool(?:_?\s*[Cc]all)?\s*>/g,
      (m) => (m.includes('/') ? '</tool_call>' : '<tool_call>'),
    )
    // Apertura precedida de llave/corchete/parentesis: {tool_call], [tool_call) ...
    .replace(/[{\[\(]+\s*tool_?\s*call\s*[>\]\)]/gi, '<tool_call>')
    // Apertura sin `>` al final de línea: {tool_call
    .replace(/[{\[\(]+\s*tool_?\s*call\s*$/gim, '<tool_call>')
    // Cierre sin `<` ni `/`: "tool_call>" tras el JSON
    .replace(/(^|[^<\/{\w])tool_?\s*call\s*>/gi, '$1</tool_call>')
}

/** Elimina bloques `<tool_call>` (incluido uno a medio streamear) para no
 *  mostrar el JSON crudo en la UI (p. ej. el bloque "Thinking"). */
export function stripToolCallsForDisplay(text: string): string {
  return normalizeToolTags(text)
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .replace(/<tool_call>[\s\S]*$/g, '')
    .replace(/<\/?tool_call>/g, '')
    .trim()
}

/** Devuelve el primer objeto `{…}` balanceado de `text` (respetando strings),
 *  o `null` si no hay. Útil para rescatar `arguments` de un JSON roto. */
export function firstBalancedObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
