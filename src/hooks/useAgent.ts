import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { ProviderConfig } from './useChat'
import type { ToolDefinition } from '../lib/tools'

export interface AgentConfig {
  enabled: boolean
  maxIterations: number
  allowedTools: string[]
  confirmWrite: boolean
  workingDirectory: string
  autoActivateSkills: boolean
}

const STORAGE_KEY = 'solaria-agent-config'

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  maxIterations: 10,
  allowedTools: ['read_file', 'write_file', 'glob', 'grep', 'web_search', 'fetch_url'],
  confirmWrite: false,
  workingDirectory: '',
  autoActivateSkills: true,
}

function loadAgentConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(raw) }
    }
  } catch {}
  return DEFAULT_AGENT_CONFIG
}

export interface AgentStep {
  id: string
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'final' | 'chat_update'
  content: string
  toolName?: string
  toolArgs?: string
  toolResult?: string
  toolWarning?: string
  timestamp: number
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
}

const AGENT_SYSTEM_PROMPT = `Eres Solaria Agent, un asistente de investigación y análisis. Tu función es ayudar al usuario a investigar, analizar y procesar información.

Tus herramientas disponibles son:
- read_file: Lee archivos (documentos, reportes, datos)
- write_file: Escribe reportes, resúmenes y documentos
- glob: Busca archivos por patrón
- grep: Busca texto dentro de archivos
- web_search: Busca información en internet
- fetch_url: Obtiene contenido de páginas web

Para usar una herramienta, pon SOLO esto al final de tu respuesta:

<tool_call>
{"name": "web_search", "arguments": {"query": "tu búsqueda"}}
</tool_call>

SIEMPRE incluye "arguments": {}, incluso si la herramienta no necesita parámetros.

REGLAS ESTRICTAS:
1. **PROHIBIDO preguntar al usuario.** Nunca digas "¿quieres que profundice?", "¿necesitas algo más?", "si deseas...", "¿te gustaría...?". Simplemente entrega los resultados completos y termina.
2. **PROHIBIDO pedir confirmación.** No digas "¿es correcto?", "¿procedo?", "¿quieres que guarde...?". Si el prompt es razonable, actúa directamente.
3. Después de web_search, DEBES hacer fetch_url en al menos 1 fuente. Saltar el deep dive no está permitido.
4. Si fetch_url falla, usa el snippet de búsqueda para esa fuente y pasa a la siguiente.
5. Límite: máximo 3 fetch_url por sesión. Luego sintetiza con lo que tengas.
6. Si no encuentras datos, sé honesto. NO fabriques información.
7. Al terminar, da la respuesta final SIN tool_calls. Incluye fuentes numeradas al final. NO ofrezcas más ayuda ni preguntes si el usuario quiere algo adicional.
8. Las skills activas contienen guías que DEBES seguir para cada tipo de tarea.
9. Responde en el mismo idioma que el usuario (español → español, inglés → inglés).`

function buildToolSystemPrompt(config: AgentConfig): string {
  return `${AGENT_SYSTEM_PROMPT}

DIRECTORIO DE TRABAJO: ${config.workingDirectory || 'No especificado (usa rutas absolutas)'}

HERRAMIENTAS DISPONIBLES:
${getToolDescriptions(config.allowedTools)}
`
}

function getToolDescriptions(allowedTools: string[]): string {
  const tools: ToolDefinition[] = [
    {
      name: 'read_file',
      description: 'Lee y muestra el contenido de un archivo.',
      parameters: [
        { name: 'path', param_type: 'string', description: 'Ruta absoluta al archivo', required: true },
      ],
    },
    {
      name: 'write_file',
      description: 'ESCRIBE o SOBREESCRIBE contenido en un archivo. Crea directorios si es necesario.',
      parameters: [
        { name: 'path', param_type: 'string', description: 'Ruta absoluta', required: true },
        { name: 'content', param_type: 'string', description: 'Contenido a escribir', required: true },
      ],
    },
    {
      name: 'glob',
      description: 'Busca archivos por patrón glob. Ej: "**/*.md", "docs/**/*.txt"',
      parameters: [
        { name: 'pattern', param_type: 'string', description: 'Patrón glob', required: true },
      ],
    },
    {
      name: 'grep',
      description: 'Busca texto en archivos usando regex.',
      parameters: [
        { name: 'pattern', param_type: 'string', description: 'Regex a buscar (requerido)', required: true },
        { name: 'path', param_type: 'string', description: 'Directorio donde buscar (opcional, por defecto .)', required: false },
      ],
    },
    {
      name: 'web_search',
      description: 'Busca información en internet usando Tavily. Devuelve resultados con resumen.',
      parameters: [
        { name: 'query', param_type: 'string', description: 'Términos de búsqueda', required: true },
      ],
    },
    {
      name: 'fetch_url',
      description: 'Obtiene el contenido de una URL y lo devuelve como texto.',
      parameters: [
        { name: 'url', param_type: 'string', description: 'URL completa', required: true },
      ],
    },
  ]

  return tools
    .filter(t => allowedTools.includes(t.name))
    .map(t => {
      const params = t.parameters.map(p => `  - ${p.name} (${p.param_type}${p.required ? '' : ', opcional'}): ${p.description}`).join('\n')
      return `### ${t.name}
${t.description}
Parámetros:
${params}`
    })
    .join('\n\n')
}

function extractToolCall(text: string): { name: string; arguments: Record<string, string> } | null {
  return extractToolCallFromNormalized(normalizeToolTags(text))
}

function tryFixJson(raw: string): string {
  try { JSON.parse(raw); return raw } catch {}

  let fixed = raw

  fixed = fixed.replace(/"(read_file|write_file|glob|grep|web_search|fetch_url|mcp__[\w_]+__[\w_]+)"\s*"(arguments|parametros)"/g, '"$1", "$2"')

  fixed = fixed.replace(/"name"\s*:\s*"[^"]+"\s+"(arguments|parametros)"/g, (m) => {
    const before = m.substring(0, m.lastIndexOf('" '))
    return before + '", "arguments"'
  })

  try { JSON.parse(fixed); return fixed } catch {}

  fixed = raw.replace(/"\s*"\s*"arguments"/g, '", "arguments"')
  try { JSON.parse(fixed); return fixed } catch {}

  fixed = raw.replace(/""/g, '"')
  try { JSON.parse(fixed); return fixed } catch {}

  fixed = raw.replace(/"url"\s*:\s*(https?:\/\/[^\s,}";]+)/g, '"url": "$1"')
  fixed = fixed.replace(/"url"\s*:\s*"(https?:\/\/[^"]+?)"?"?\s*([,}])/g, (_, url, closer) => {
    const cleanUrl = url.replace(/["';\s]+$/, '')
    return `"url": "${cleanUrl}"${closer}`
  })
  fixed = fixed.replace(/;"?\s*\}\s*$/g, '"}')
  fixed = fixed.replace(/"name"\s*:\s*([a-z_]+)/g, '"name": "$1"')
  fixed = fixed.replace(/"query"\s*:\s*([a-zA-Z0-9\s?]+)(?=[",\s}])/g, (m) => {
    const idx = m.indexOf(':') + 1
    const val = m.substring(idx).trim()
    if (!val.startsWith('"')) return `"query": "${val}"`
    return m
  })
  try { JSON.parse(fixed); return fixed } catch {}

  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace > 0) {
    const trimmed = raw.substring(0, lastBrace + 1)
    try { JSON.parse(trimmed); return trimmed } catch {}
  }

  return raw
}

function tryFindToolJson(text: string): string | null {
  let jsonMatch = text.match(/\{[\s\S]*?"name"[\s\S]*?"arguments"[\s\S]*?\}/)
  let candidate = jsonMatch?.[0]

  if (!candidate) {
    const nameOnly = text.match(/\{\s*"(?:name|nombre)"\s*:\s*"(read_file|write_file|glob|grep|web_search|fetch_url|mcp__[\w_]+__[\w_]+)"(\s*,\s*"(?:arguments|parametros)"\s*:\s*\{\}\s*)?\s*\}/)
    if (nameOnly) {
      candidate = nameOnly[0]
    }
  }

  if (!candidate) {
    const brokenMatch = text.match(/("name"\s*:\s*"[^"]+"[\s\S]*?"arguments"\s*:\s*\{[\s\S]*?\}\s*\})/)
    if (brokenMatch) {
      candidate = '{' + brokenMatch[1]
    }
  }

  if (!candidate) return null

  try {
    const parsed = JSON.parse(candidate)
    if (parsed.name) return candidate
  } catch {
    const fixed = tryFixJson(candidate)
    if (fixed !== candidate) {
      try {
        const parsed = JSON.parse(fixed)
        if (parsed.name) return fixed
      } catch {}
    }
  }
  return null
}

function normalizeToolTags(text: string): string {
  let result = text
    .replace(/TOOL\s*:\s*/gi, 'TOOL:')

  result = result
    .replace(/[{\[\(]*<\/?[Tt]ool[_-]?[Cc]all>/g, (m) => m.includes('/') ? '</tool_call>' : '<tool_call>')
    .replace(/"?\s*[{\[\(]+tool_call[>\]\)]/gi, '<tool_call>')
    .replace(/\{(tool_call|TOOL)\s*>/g, '<$1>')
    .replace(/\{(tool_call|TOOL)\s*$/gim, '<$1>')

  return result
}

function cleanToolCalls(text: string): string {
  const normalized = normalizeToolTags(text)

  let cleaned = normalized.replace(/TOOL:\s*\{[\s\S]*?\}\s*/g, '').trim()

  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/g, '').trim()

  cleaned = cleaned.replace(/\{\s*"name"\s*:\s*"[^"]+"[\s\S]*?"arguments"[\s\S]*?\}\s*\}/g, '').trim()

  return cleaned
}

function extractArgsFromTopLevel(parsed: Record<string, any>): Record<string, string> {
  const knownKeys = new Set(['name', 'nombre', 'arguments', 'parametros'])
  const args: Record<string, string> = {}
  for (const [key, val] of Object.entries(parsed)) {
    if (!knownKeys.has(key) && typeof val === 'string') {
      args[key] = val
    }
  }
  return args
}

function extractToolCallFromNormalized(text: string): { name: string; arguments: Record<string, string> } | null {
  const toolMatch = text.match(/TOOL:\s*(\{[\s\S]*?\})/)
  if (toolMatch) {
    try {
      const parsed = JSON.parse(toolMatch[1])
      if (parsed.name) {
        return {
          name: parsed.name,
          arguments: parsed.arguments || parsed.parametros || extractArgsFromTopLevel(parsed),
        }
      }
    } catch {}
  }

  const match = text.match(/<tool_call>\s*({[\s\S]*?})\s*<\/tool_call>/)
  const jsonStr = match ? match[1] : tryFindToolJson(text)
  if (!jsonStr) return null

  try {
    const parsed = JSON.parse(jsonStr)
    if (!parsed.name) return null
    return {
      name: parsed.name,
      arguments: parsed.arguments || parsed.parametros || extractArgsFromTopLevel(parsed),
    }
  } catch {
    const fixed = tryFixJson(jsonStr)
    if (fixed !== jsonStr) {
      try {
        const parsed = JSON.parse(fixed)
        if (parsed.name) return {
          name: parsed.name,
          arguments: parsed.arguments || parsed.parametros || extractArgsFromTopLevel(parsed),
        }
      } catch {}
    }
    return null
  }
}

export function useAgent() {
  const [isRunning, setIsRunning] = useState(false)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(loadAgentConfig)
  const [liveThinking, setLiveThinking] = useState('')
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agentConfig))
  }, [agentConfig])
  useEffect(() => {
    if (!agentConfig.workingDirectory) {
      invoke<string>('get_cwd').then(cwd => {
        setAgentConfig(prev => ({ ...prev, workingDirectory: cwd }))
      }).catch(() => {})
    }
  }, [])
  const abortRef = useRef(false)
  const messageHistoryRef = useRef<AgentMessage[]>([])
  const pendingConfirmRef = useRef<{ resolve: (value: boolean) => void } | null>(null)
  const unlistenRef = useRef<UnlistenFn[]>([])
  const streamIdRef = useRef<string | null>(null)

  const waitForConfirmation = useCallback((): Promise<boolean> => {
    return new Promise(resolve => {
      pendingConfirmRef.current = { resolve }
    })
  }, [])

  const confirmTool = useCallback((allow: boolean) => {
    pendingConfirmRef.current?.resolve(allow)
    pendingConfirmRef.current = null
  }, [])

  const cleanupStreamListeners = useCallback(() => {
    for (const unlisten of unlistenRef.current) {
      unlisten()
    }
    unlistenRef.current = []
  }, [])

  const streamLLM = useCallback(async (
    messages: AgentMessage[],
    systemPrompt: string,
    provider: ProviderConfig,
    onToken: (token: string) => void,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const streamId = crypto.randomUUID()
      streamIdRef.current = streamId
      let fullContent = ''
      let settled = false

      const setup = async () => {
        const unlistenToken = await listen<{ stream_id: string; token: string }>('stream://token', (event) => {
          if (event.payload.stream_id !== streamId) return
          fullContent += event.payload.token
          onToken(event.payload.token)
        })
        unlistenRef.current.push(unlistenToken)

        const clearTimeoutFn = () => clearTimeout(timeoutId)

        const unlistenDone = await listen<{ stream_id: string; full_content: string; cancelled: boolean }>('stream://done', async (event) => {
          if (event.payload.stream_id !== streamId) return
          if (settled) return
          settled = true
          clearTimeoutFn()
          cleanupStreamListeners()
          streamIdRef.current = null
          await new Promise(r => setTimeout(r, 100))
          const finalContent = fullContent.length > event.payload.full_content.length
            ? fullContent : event.payload.full_content
          resolve(finalContent)
        })
        unlistenRef.current.push(unlistenDone)

        const unlistenError = await listen<{ stream_id: string; error: string }>('stream://error', (event) => {
          if (event.payload.stream_id !== streamId) return
          if (settled) return
          settled = true
          clearTimeoutFn()
          cleanupStreamListeners()
          streamIdRef.current = null
          reject(new Error(event.payload.error))
        })
        unlistenRef.current.push(unlistenError)

        const timeoutId = setTimeout(() => {
          if (settled) return
          settled = true
          invoke('stop_stream', { streamId }).catch(() => {})
          cleanupStreamListeners()
          streamIdRef.current = null
          if (fullContent.trim()) {
            resolve(fullContent.trim())
          } else {
            reject(new Error('Tiempo de espera agotado (30s). El modelo no generó respuesta.'))
          }
        }, 60000)

        const historyMessages = messages.map(m => ({
          role: m.role === 'tool' ? 'user' as const : m.role,
          content: m.content,
        }))

        try {
          if (provider.type === 'ollama') {
            await invoke('ollama_chat_stream', {
              streamId,
              model: provider.model,
              messages: JSON.stringify(historyMessages),
              systemPrompt: systemPrompt,
              temperature: provider.temperature ?? null,
              topP: provider.topP ?? null,
              maxTokens: provider.maxTokens ?? null,
            })
          } else {
            await invoke('provider_chat_stream', {
              streamId,
              provider: provider.type,
              model: provider.model,
              apiKey: provider.apiKey || '',
              messages: JSON.stringify(historyMessages),
              systemPrompt: systemPrompt,
              temperature: provider.temperature ?? null,
              topP: provider.topP ?? null,
              maxTokens: provider.maxTokens ?? null,
            })
          }
        } catch (error: any) {
          if (settled) return
          settled = true
          clearTimeoutFn()
          cleanupStreamListeners()
          streamIdRef.current = null
          reject(error)
        }
      }

      setup()
    })
  }, [cleanupStreamListeners])

  const executeToolCall = useCallback(async (
    name: string,
    args: Record<string, string>,
    workingDir: string,
    confirmed: boolean,
    restrictToWorkDir: boolean,
  ): Promise<import('../lib/tools').ToolResult> => {
    return invoke<import('../lib/tools').ToolResult>('execute_tool', {
      name,
      args: JSON.stringify(args),
      workingDir: workingDir || null,
      confirmed,
      restrictToWorkdir: restrictToWorkDir,
    })
  }, [])

  const makeStep = useCallback((type: AgentStep['type'], content: string, extra?: Partial<AgentStep>): AgentStep => ({
    id: crypto.randomUUID(),
    type,
    content,
    timestamp: Date.now(),
    ...extra,
  }), [])

  const callComplete = useCallback((
    onComplete: ((content: string) => void) | undefined,
    finalContent: string,
    onStep: (step: AgentStep) => void,
    userInput?: string,
  ) => {
    onStep(makeStep('final', finalContent))
    onComplete?.(finalContent)
    if (userInput && finalContent) {
      messageHistoryRef.current = [
        { role: 'user' as const, content: userInput },
        { role: 'assistant' as const, content: finalContent },
      ]
    }
  }, [makeStep])

  const runAgent = useCallback(async (
    userInput: string,
    provider: ProviderConfig,
    onStep: (step: AgentStep) => void,
    onComplete?: (content: string) => void,
  ) => {
    abortRef.current = false
    setIsRunning(true)

    onStep(makeStep('reasoning', 'Iniciando agente...'))

    let skillsPrompt = ''
    try {
      const params: Record<string, unknown> = { workingDir: agentConfig.workingDirectory || null }
      if (agentConfig.autoActivateSkills) {
        params.query = userInput
      }
      skillsPrompt = await invoke<string>('get_skills_prompt', params)
    } catch {}

    const systemPrompt = buildToolSystemPrompt(agentConfig) + skillsPrompt
    const messages: AgentMessage[] = [
      ...messageHistoryRef.current,
      { role: 'user', content: userInput },
    ]

    let iteration = 0
    let fullAssistantContent = ''
    let lastAssistantText = ''
    const updateChatMsg = (content: string) => {
      onStep(makeStep('chat_update', content))
    }

    try {
      while (iteration < agentConfig.maxIterations && !abortRef.current) {
        iteration++

        let currentThinking = ''
        setLiveThinking('')

        const response = await streamLLM(messages, systemPrompt, provider, (token) => {
          currentThinking += token
          setLiveThinking(currentThinking)
        })

        setLiveThinking('')

        const toolCall = extractToolCall(response)
        const cleanedResponse = cleanToolCalls(response)
        const pureText = cleanedResponse || response.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim()
        if (pureText) lastAssistantText = pureText

        if (toolCall) {
          if (cleanedResponse) {
            fullAssistantContent = fullAssistantContent
              ? fullAssistantContent + '\n\n' + cleanedResponse
              : cleanedResponse
            onStep(makeStep('reasoning', cleanedResponse))
          } else {
            const progressLine = `*→ ${toolCall.name}*`
            fullAssistantContent = fullAssistantContent
              ? fullAssistantContent + '\n' + progressLine
              : progressLine
            onStep(makeStep('reasoning', progressLine))
          }
          updateChatMsg(fullAssistantContent)
        }

        if (!toolCall) {
          const responseHasToolTags = response.includes('<tool_call>')
          if (responseHasToolTags) {
            const noToolMsg = 'No se pudo parsear el tool_call. Asegúrate de usar JSON válido: {"name": "tool_name", "arguments": {...}}. Termina con la etiqueta </tool_call>.'
            messages.push({ role: 'assistant', content: cleanedResponse || response })
            messages.push({ role: 'tool', content: noToolMsg })
            continue
          }
          const finalText = cleanedResponse || response
          fullAssistantContent = fullAssistantContent
            ? fullAssistantContent + '\n\n' + finalText
            : finalText
          messages.push({ role: 'assistant', content: fullAssistantContent })
          onStep(makeStep('reasoning', finalText))
          updateChatMsg(fullAssistantContent)
          callComplete(onComplete, fullAssistantContent, onStep, userInput)
          break
        }

        if (!agentConfig.allowedTools.includes(toolCall.name)) {
          messages.push({
            role: 'assistant',
            content: `La herramienta "${toolCall.name}" no está permitida. Herramientas disponibles: ${agentConfig.allowedTools.join(', ')}.`,
          })
          continue
        }

        const argsJson = JSON.stringify(toolCall.arguments, null, 2)

        onStep(makeStep('tool_call', toolCall.name, {
          toolName: toolCall.name,
          toolArgs: argsJson,
        }))

        let toolResult = await executeToolCall(toolCall.name, toolCall.arguments, agentConfig.workingDirectory, false, false)
        const needsConfirm = toolResult.requires_confirmation ||
          (toolCall.name === 'write_file' && agentConfig.confirmWrite)

        if (needsConfirm) {
          const confirmWarning = toolCall.name === 'write_file' && !toolResult.requires_confirmation
            ? 'Escribir archivo - requiere confirmación'
            : toolResult.preview || 'Requiere confirmación'

          onStep(makeStep('tool_result', toolCall.name, {
            toolName: toolCall.name,
            toolWarning: confirmWarning,
            toolResult: '[PENDIENTE - esperando confirmación del usuario]',
          }))

          const allowed = await waitForConfirmation()

          if (!allowed) {
            const deniedMsg = `El usuario denegó la ejecución de ${toolCall.name} por seguridad`
            onStep(makeStep('tool_result', toolCall.name, {
              toolName: toolCall.name,
              toolResult: deniedMsg,
            }))
            messages.push({ role: 'assistant', content: response })
            messages.push({ role: 'tool', content: deniedMsg })
            continue
          }

          toolResult = await executeToolCall(toolCall.name, toolCall.arguments, agentConfig.workingDirectory, true, false)
        }

        const isWriteFile = toolCall.name === 'write_file' && toolResult.success
        let reportPreview = ''
        let reportForLLM = ''

        let _writeFileName = ''
        if (isWriteFile) {
          const filePath = toolCall.arguments.path || ''
          const fileContent = toolCall.arguments.content || ''
          _writeFileName = filePath.split('/').pop() || filePath
          reportPreview = `📄 \`${_writeFileName}\` guardado correctamente`
          reportForLLM = `Resultado de write_file (${filePath}): ${fileContent.length} caracteres.\nPrimeros 500:\n\`\`\`\n${fileContent.slice(0, 500)}\n\`\`\`\nEl archivo completo fue escrito en disco.`
        }

        onStep(makeStep('tool_result', toolCall.name, {
          toolName: toolCall.name,
          toolWarning: toolResult.preview || undefined,
          toolResult: isWriteFile
            ? reportPreview
            : (toolResult.success
              ? toolResult.output.slice(0, 2000) + (toolResult.output.length > 2000 ? '\n...(truncado)' : '')
              : `ERROR: ${toolResult.error || 'Error desconocido'}`),
        }))

        const resultContent = isWriteFile
          ? reportForLLM
          : (toolResult.success
            ? `Resultado de ${toolCall.name}:\n\`\`\`\n${toolResult.output.slice(0, 5000)}\n\`\`\`${toolResult.output.length > 5000 ? '\n...(resultado truncado)' : ''}`
            : `Error ejecutando ${toolCall.name}: ${toolResult.error || 'Error desconocido'}`)

        messages.push({ role: 'assistant', content: cleanedResponse || response })
        messages.push({ role: 'tool', content: resultContent })

        if (isWriteFile) {
          const confirmMsg = `✅ Archivo guardado: \`${_writeFileName}\``
          fullAssistantContent = fullAssistantContent
            ? fullAssistantContent + '\n\n' + confirmMsg
            : confirmMsg
          updateChatMsg(fullAssistantContent)
        }
      }

      if (iteration >= agentConfig.maxIterations) {
        const fallback = fullAssistantContent || lastAssistantText || `Máximo de iteraciones alcanzado (${agentConfig.maxIterations}). La tarea puede estar incompleta.`
        callComplete(onComplete, fallback, onStep, userInput)
      } else if (abortRef.current) {
        callComplete(onComplete, 'Agente detenido por el usuario.', onStep, userInput)
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error desconocido'
      callComplete(onComplete, `Error: ${errMsg}`, onStep, userInput)
    }

    messageHistoryRef.current = messages.filter(m => m.role !== 'tool')
    setIsRunning(false)
  }, [agentConfig, streamLLM, executeToolCall, makeStep, callComplete, waitForConfirmation])

  const stopAgent = useCallback(() => {
    abortRef.current = true
    const sid = streamIdRef.current
    if (sid) {
      invoke('stop_stream', { streamId: sid }).catch(() => {})
      streamIdRef.current = null
    }
    cleanupStreamListeners()
    setIsRunning(false)
    setLiveThinking('')
  }, [cleanupStreamListeners])

  const updateAgentConfig = useCallback((updates: Partial<AgentConfig>) => {
    setAgentConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const resetAgent = useCallback(() => {
    messageHistoryRef.current = []
  }, [])

  return {
    isRunning,
    agentConfig,
    liveThinking,
    updateAgentConfig,
    runAgent,
    stopAgent,
    resetAgent,
    confirmTool,
  }
}
