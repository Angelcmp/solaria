import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { ProviderConfig } from './useChat'
import type { ToolDefinition } from '../lib/tools'

export interface AgentConfig {
  enabled: boolean
  maxIterations: number
  allowedTools: string[]
  autoConfirm: boolean
  confirmWrite: boolean
  restrictToWorkDir: boolean
  rateLimit: number
  useAllowlist: boolean
  commandAllowlist: string
  sessionTimeout: number
  workingDirectory: string
  sandboxEnabled: boolean
  sandboxImage: string
}

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  maxIterations: 10,
  allowedTools: ['shell', 'read_file', 'write_file', 'glob', 'grep', 'web_search', 'fetch_url'],
  autoConfirm: false,
  confirmWrite: false,
  restrictToWorkDir: false,
  rateLimit: 30,
  useAllowlist: false,
  commandAllowlist: 'ls,cat,echo,pwd,find,grep,head,tail,wc,date,whoami,uname,git,npm,cargo,node,python3',
  sessionTimeout: 0,
  workingDirectory: '',
  sandboxEnabled: false,
  sandboxImage: 'ubuntu:latest',
}

export interface AgentStep {
  id: string
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'final'
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

const AGENT_SYSTEM_PROMPT = `Eres Solaria Agent, un asistente de IA que puede ejecutar herramientas para ayudar al usuario.

Tienes acceso a las siguientes herramientas. Cuando necesites usar una herramienta, responde EXCLUSIVAMENTE con este formato:

<tool_call>
{"name": "shell", "arguments": {"command": "el comando aquí"}}
</tool_call>

REGLAS IMPORTANTES:
1. Solo puedes llamar UNA herramienta a la vez. Espera el resultado antes de continuar.
2. Lee el resultado de la herramienta y decide el siguiente paso.
3. Cuando hayas completado la tarea, da una respuesta final clara sin tool_calls.
4. Si un comando falla, intenta una alternativa.
5. Para operaciones de escritura, muestra siempre confirmación del contenido.
6. Trabaja en el directorio de trabajo especificado a menos que se indique lo contrario.
7. Analiza los resultados de herramientas y explica lo que encontraste.
8. Si necesitas más información del usuario, pregúntala directamente.`

async function discoverPlugins(): Promise<ToolDefinition[]> {
  try {
    const plugins = await invoke<{ name: string; description: string; parameters: { name: string; param_type: string; description: string; required: boolean }[] }[]>('list_plugins')
    return plugins.map(p => ({
      name: p.name,
      description: p.description,
      parameters: p.parameters.map((pp: any) => ({
        name: pp.name,
        param_type: pp.param_type,
        description: pp.description,
        required: pp.required,
      })),
    }))
  } catch {
    return []
  }
}

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
      name: 'shell',
      description: 'Ejecuta comandos shell (bash, sh, zsh). Útil para: sistema de archivos, git, npm, cargo, docker, etc.',
      parameters: [
        { name: 'command', param_type: 'string', description: 'Comando a ejecutar', required: true },
      ],
    },
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
      description: 'Busca archivos por patrón glob. Ej: "**/*.ts", "src/**/*.rs"',
      parameters: [
        { name: 'pattern', param_type: 'string', description: 'Patrón glob', required: true },
      ],
    },
    {
      name: 'grep',
      description: 'Busca texto en archivos usando regex.',
      parameters: [
        { name: 'pattern', param_type: 'string', description: 'Regex a buscar', required: true },
        { name: 'path', param_type: 'string', description: 'Directorio (opcional)', required: false },
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
  const match = text.match(/<tool_call>\s*({[\s\S]*?})\s*<\/tool_call>/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1])
    if (!parsed.name || !parsed.arguments) return null
    return { name: parsed.name, arguments: parsed.arguments }
  } catch {
    return null
  }
}

function cleanToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/g, '').trim()
}

export function useAgent() {
  const [isRunning, setIsRunning] = useState(false)
  const [sessionLocked, setSessionLocked] = useState(false)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [liveThinking, setLiveThinking] = useState('')
  const abortRef = useRef(false)
  const messageHistoryRef = useRef<AgentMessage[]>([])
  const pendingConfirmRef = useRef<{ resolve: (value: boolean) => void } | null>(null)
  const lastActivityRef = useRef(Date.now())
  const unlistenRef = useRef<UnlistenFn[]>([])
  const streamIdRef = useRef<string | null>(null)

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (agentConfig.sessionTimeout <= 0 || !agentConfig.enabled) {
      setSessionLocked(false)
      return
    }

    setSessionLocked(false)
    const ms = agentConfig.sessionTimeout * 60 * 1000
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > ms) {
        setSessionLocked(true)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [agentConfig.sessionTimeout, agentConfig.enabled])

  const resumeSession = useCallback(() => {
    lastActivityRef.current = Date.now()
    setSessionLocked(false)
  }, [])

  const waitForConfirmation = useCallback((): Promise<boolean> => {
    return new Promise(resolve => {
      pendingConfirmRef.current = { resolve }
    })
  }, [])

  const confirmTool = useCallback((allow: boolean) => {
    pendingConfirmRef.current?.resolve(allow)
    pendingConfirmRef.current = null
    touchActivity()
  }, [touchActivity])

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

        const unlistenDone = await listen<{ stream_id: string; full_content: string; cancelled: boolean }>('stream://done', async (event) => {
          if (event.payload.stream_id !== streamId) return
          if (settled) return
          settled = true
          cleanupStreamListeners()
          streamIdRef.current = null
          // Use the accumulated content, not the event's full_content
          // (the event fires before the last token is processed)
          await new Promise(r => setTimeout(r, 50))
          resolve(fullContent)
        })
        unlistenRef.current.push(unlistenDone)

        const unlistenError = await listen<{ stream_id: string; error: string }>('stream://error', (event) => {
          if (event.payload.stream_id !== streamId) return
          if (settled) return
          settled = true
          cleanupStreamListeners()
          streamIdRef.current = null
          reject(new Error(event.payload.error))
        })
        unlistenRef.current.push(unlistenError)

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
    rateLimit: number,
    useAllowlist: boolean,
    commandAllowlist: string,
    sandboxEnabled?: boolean,
    sandboxImage?: string,
  ): Promise<import('../lib/tools').ToolResult> => {
    return invoke<import('../lib/tools').ToolResult>('execute_tool', {
      name,
      args: JSON.stringify(args),
      workingDir: workingDir || null,
      confirmed,
      restrictToWorkdir: restrictToWorkDir,
      rateLimit,
      useAllowlist,
      commandAllowlist,
      sandboxEnabled: sandboxEnabled ?? false,
      sandboxImage: sandboxImage || null,
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
  ) => {
    onStep(makeStep('final', finalContent))
    onComplete?.(finalContent)
  }, [makeStep])

  const runAgent = useCallback(async (
    userInput: string,
    provider: ProviderConfig,
    onStep: (step: AgentStep) => void,
    onComplete?: (content: string) => void,
  ) => {
    abortRef.current = false
    setIsRunning(true)
    touchActivity()

    onStep(makeStep('reasoning', 'Iniciando agente...'))

    const plugins = await discoverPlugins()
    const pluginLines = plugins.length > 0
      ? `\n\nPLUGINS PERSONALIZADOS DISPONIBLES:\n${plugins.map(p => {
          const params = p.parameters.map(pp => `  - ${pp.name} (${pp.param_type}): ${pp.description}`).join('\n')
          return `### ${p.name}\n${p.description}\nParámetros:\n${params}`
        }).join('\n\n')}`
      : ''
    const systemPrompt = buildToolSystemPrompt(agentConfig) + pluginLines
    const messages: AgentMessage[] = [
      ...messageHistoryRef.current,
      { role: 'user', content: userInput },
    ]

    let iteration = 0

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

        if (cleanedResponse && toolCall) {
          onStep(makeStep('reasoning', cleanedResponse))
        }

        if (!toolCall) {
          const finalContent = cleanedResponse || response
          messages.push({ role: 'assistant', content: finalContent })
          callComplete(onComplete, finalContent, onStep)
          break
        }

        if (!agentConfig.allowedTools.includes(toolCall.name)) {
          messages.push({
            role: 'assistant',
            content: `La herramienta "${toolCall.name}" no está permitida. Herramientas disponibles: ${agentConfig.allowedTools.join(', ')}.`,
          })
          continue
        }

        const argsStr = Object.entries(toolCall.arguments)
          .map(([k, v]) => `${k}: ${v.slice(0, 200)}${v.length > 200 ? '...' : ''}`)
          .join(', ')

        onStep(makeStep('tool_call', toolCall.name, {
          toolName: toolCall.name,
          toolArgs: argsStr,
        }))

        let toolResult = await executeToolCall(toolCall.name, toolCall.arguments, agentConfig.workingDirectory, false, agentConfig.restrictToWorkDir, agentConfig.rateLimit, agentConfig.useAllowlist, agentConfig.commandAllowlist, agentConfig.sandboxEnabled, agentConfig.sandboxImage)
        touchActivity()

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

          const allowed = agentConfig.autoConfirm || await waitForConfirmation()

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

          toolResult = await executeToolCall(toolCall.name, toolCall.arguments, agentConfig.workingDirectory, true, agentConfig.restrictToWorkDir, agentConfig.rateLimit, agentConfig.useAllowlist, agentConfig.commandAllowlist, agentConfig.sandboxEnabled, agentConfig.sandboxImage)
          touchActivity()
        }

        onStep(makeStep('tool_result', toolCall.name, {
          toolName: toolCall.name,
          toolWarning: toolResult.preview || undefined,
          toolResult: toolResult.success
            ? toolResult.output.slice(0, 2000) + (toolResult.output.length > 2000 ? '\n...(truncado)' : '')
            : `ERROR: ${toolResult.error || 'Error desconocido'}`,
        }))

        const resultContent = toolResult.success
          ? `Resultado de ${toolCall.name}:\n\`\`\`\n${toolResult.output.slice(0, 5000)}\n\`\`\`${toolResult.output.length > 5000 ? '\n...(resultado truncado)' : ''}`
          : `Error ejecutando ${toolCall.name}: ${toolResult.error || 'Error desconocido'}`

        messages.push({ role: 'assistant', content: response })
        messages.push({ role: 'tool', content: resultContent })
      }

      if (iteration >= agentConfig.maxIterations) {
        callComplete(onComplete, `Máximo de iteraciones alcanzado (${agentConfig.maxIterations}). La tarea puede estar incompleta.`, onStep)
      }
    } catch (error: any) {
      setLiveThinking('')
      if (abortRef.current) {
        callComplete(onComplete, 'Agente detenido por el usuario.', onStep)
      } else {
        callComplete(onComplete, `Error: ${error?.message || error?.toString() || 'Error desconocido'}`, onStep)
      }
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
    sessionLocked,
    agentConfig,
    liveThinking,
    updateAgentConfig,
    runAgent,
    stopAgent,
    resetAgent,
    confirmTool,
    resumeSession,
  }
}
