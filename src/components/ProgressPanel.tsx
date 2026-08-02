import { useState, useEffect, useMemo, useCallback } from 'react'
import type { AgentStep } from '../hooks/useAgent'
import { DocumentIcon, WarningIcon } from './Icons'

interface ProgressPanelProps {
  steps: AgentStep[]
  isRunning: boolean
  onClose: () => void
  onStop?: () => void
  onConfirmTool?: (allow: boolean) => void
  projectName?: string
  workingDirectory?: string
  personaPrompt?: string
  onOpenDocument?: (file: { name: string; path: string; content: string }) => void
}

interface SourceItem {
  url: string
  title: string
  status: 'pending' | 'fetched' | 'error'
}

interface FileItem {
  path: string
  action: 'read' | 'write'
  content?: string
  written?: boolean
  isMd: boolean
}

function extractFiles(steps: AgentStep[]): FileItem[] {
  const files: FileItem[] = []
  const seen = new Set<string>()
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.type !== 'tool_call' || !step.toolArgs) continue
    try {
      const args = JSON.parse(step.toolArgs)
      if (step.toolName === 'write_file' && args.path) {
        const key = `write:${args.path}`
        if (!seen.has(key)) {
          seen.add(key)
          const next = steps[i + 1]
          const written = next?.type === 'tool_result' && next.toolName === 'write_file'
            ? !next.toolResult?.startsWith('ERROR')
            : false
          files.push({
            path: args.path,
            action: 'write',
            content: step.toolContent ?? args.content ?? '',
            written,
            isMd: /\.md$/i.test(args.path),
          })
        }
      } else if (step.toolName === 'read_file' && args.path) {
        const key = `read:${args.path}`
        if (!seen.has(key)) {
          seen.add(key)
          files.push({ path: args.path, action: 'read', isMd: /\.md$/i.test(args.path) })
        }
      }
    } catch {}
  }
  return files
}

function extractSources(steps: AgentStep[]): SourceItem[] {
  const sources: SourceItem[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    if (step.type === 'tool_call' && step.toolArgs) {
      try {
        const args = JSON.parse(step.toolArgs)
        if (step.toolName === 'web_search' && args.query) {
          const key = `search:${args.query}`
          if (!seen.has(key)) {
            seen.add(key)
            sources.push({ url: '', title: `Búsqueda: ${args.query.slice(0, 60)}`, status: 'pending' })
          }
        }
        if (step.toolName === 'fetch_url' && args.url && !seen.has(args.url)) {
          seen.add(args.url)
          const title = args.url.replace(/https?:\/\//, '').split('/')[0] || args.url
          sources.push({ url: args.url, title, status: 'pending' })
        }
      } catch {}
    }
  }
  for (const step of steps) {
    if (step.type === 'tool_result' && step.toolName === 'fetch_url' && step.toolResult) {
      for (const s of sources) {
        if (s.url && step.toolResult?.includes(s.url.replace(/https?:\/\//, '').split('/')[0])) {
          s.status = step.toolResult.startsWith('ERROR') ? 'error' : 'fetched'
        }
      }
    }
  }
  return sources
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function fileName(path: string): string {
  return path.split('/').pop() || path
}

interface ToolGroup {
  toolName: string
  count: number
  done: number
  hasError: boolean
  hasPending: boolean
  warning?: string
}

function groupSteps(toolSteps: AgentStep[]): ToolGroup[] {
  const groups = new Map<string, ToolGroup>()
  for (const step of toolSteps) {
    if (!step.toolName) continue
    const g = groups.get(step.toolName) || { toolName: step.toolName, count: 0, done: 0, hasError: false, hasPending: false, warning: undefined }
    if (step.type === 'tool_call') {
      g.count++
    } else if (step.type === 'tool_result') {
      if (step.toolResult?.startsWith('ERROR')) g.hasError = true
      else if (step.toolResult?.startsWith('[PENDIENTE')) g.hasPending = true
      else g.done++
    }
    if (step.toolWarning) g.warning = step.toolWarning
    groups.set(step.toolName, g)
  }
  return Array.from(groups.values())
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">{title}</span>
      <div className="flex-1 h-px bg-[rgba(255,255,255,0.04)]" />
      {right}
    </div>
  )
}

function ProgressPanel(props: ProgressPanelProps) {
  const { steps, isRunning, onClose, onStop, onConfirmTool, projectName, workingDirectory, personaPrompt, onOpenDocument } = props
  const [collapsed, setCollapsed] = useState(false)
  const [skills, setSkills] = useState<string[]>([])

  const toolSteps = useMemo(() => steps.filter(s => s.type !== 'reasoning' && s.type !== 'chat_update'), [steps])
  const toolGroups = useMemo(() => groupSteps(toolSteps), [toolSteps])
  const files = useMemo(() => extractFiles(steps), [steps])
  const sources = useMemo(() => extractSources(steps), [steps])
  const mdDocs = useMemo(() => files.filter(f => f.action === 'write' && f.isMd), [files])
  const writes = files.filter(f => f.action === 'write')
  const reads = files.filter(f => f.action === 'read')

  const doneCount = toolSteps.filter(s => s.type === 'tool_result' && !s.toolResult?.startsWith('ERROR')).length
  const totalCount = toolSteps.filter(s => s.type === 'tool_call').length

  const loadSkills = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<Array<{ name: string; enabled: boolean }>>('list_skills', {
        workingDir: workingDirectory || null,
        autoActivate: true,
      })
      setSkills(list.filter(s => s.enabled).map(s => s.name))
    } catch {}
  }, [workingDirectory])

  useEffect(() => { loadSkills() }, [loadSkills])

  const handleShowInFolder = async (path: string) => {
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(path)
    } catch {}
  }

  return (
    <div
      className="flex flex-col bg-[#1C1B1B] border-l border-[rgba(255,255,255,0.04)] shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: collapsed ? 36 : 400 }}
    >
      {/* Collapsed strip */}
      <div className={collapsed ? 'flex flex-col items-center w-[36px] shrink-0' : 'hidden'}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center w-6 h-6 mt-2 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors"
          title="Expandir panel"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className={`w-1.5 h-1.5 rounded-full mt-2 ${isRunning ? 'bg-[#00E5C9] animate-pulse' : 'bg-[#666666]'}`} />
      </div>

      {/* Expanded content */}
      <div className={collapsed ? 'hidden' : 'flex flex-col w-[400px] shrink-0'}>
      {/* Header */}
      <div className="flex items-center px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${isRunning ? 'bg-[#00E5C9] animate-pulse' : 'bg-[#666666]'}`} />
        <span className="text-[0.7rem] font-medium text-[#E5E5E5]">Solaria</span>
        {projectName && <span className="ml-2 text-[0.6rem] text-[#999999] truncate">{projectName}</span>}
        <div className="flex-1" />
        {isRunning && onStop && (
          <button onClick={onStop} className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#999999] hover:text-[#ef4444] transition-colors mr-1" title="Detener">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
        )}
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors mr-1"
          title="Colapsar panel"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors mr-1"
          title="Cerrar panel"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {/* Progress */}
        <SectionHeader title="Progress" />
        <div className="px-3 py-1">
          <div className="flex items-center gap-2 text-[0.6rem] text-[#999999]">
            <span className="font-mono text-[#E5E5E5]">{doneCount} of {Math.max(totalCount, doneCount)}</span>
            <span className="flex-1 h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
              <div className="h-full bg-[rgba(255,255,255,0.35)] transition-all duration-300" style={{ width: totalCount > 0 ? `${(doneCount / Math.max(totalCount, 1)) * 100}%` : '0%' }} />
            </span>
          </div>
        </div>
        <div className="px-3 py-1 space-y-0.5">
          {toolSteps.length === 0 && (
            <p className="text-[0.6rem] text-[#666666] py-2">
              {isRunning ? 'Razonando… la actividad aparecerá aquí' : 'Sin actividad en esta tarea.'}
            </p>
          )}
          {toolGroups.map(group => (
            <CompactToolRow key={group.toolName} group={group} isRunning={isRunning} onConfirmTool={onConfirmTool} />
          ))}
        </div>

        {/* Project */}
        <SectionHeader title="Project" />
        <div className="px-3 py-1 space-y-1">
          {!projectName && !workingDirectory && (
            <p className="text-[0.6rem] text-[#666666]">Sin proyecto activo.</p>
          )}
          {projectName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span className="text-[0.7rem] text-[#E5E5E5] truncate">{projectName}</span>
            </div>
          )}
          {workingDirectory && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="1.5"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <span className="text-[0.6rem] text-[#999999] font-mono truncate" title={workingDirectory}>{workingDirectory}</span>
            </div>
          )}
        </div>

        {/* Files */}
        {(reads.length > 0 || writes.length > 0) && (
          <>
            <SectionHeader
              title="Archivos"
              right={<span className="text-[0.55rem] text-[#666666] font-mono">{reads.length + writes.length}</span>}
            />
            <div className="px-3 py-1 space-y-0.5">
              {writes.map((f, i) => (
                <FileRow key={`w-${f.path}-${i}`} file={f} onShowInFolder={handleShowInFolder} onOpen={onOpenDocument} />
              ))}
              {reads.map((f, i) => (
                <FileRow key={`r-${f.path}-${i}`} file={f} onShowInFolder={handleShowInFolder} onOpen={onOpenDocument} />
              ))}
            </div>
          </>
        )}

        {/* Documents (solo .md generados en el chat central) */}
        {mdDocs.length > 0 && (
          <>
            <SectionHeader title="Documentos" />
            <div className="px-3 py-1 space-y-0.5">
              {mdDocs.map((f, i) => (
                <button
                  key={i}
                  onClick={() => onOpenDocument?.({ name: fileName(f.path), path: f.path, content: f.content || '' })}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.06)] transition-colors text-left"
                >
                  <DocumentIcon size={12} color="#999999" />
                  <span className="text-[0.65rem] text-[#E5E5E5] truncate flex-1">{fileName(f.path)}</span>
                  <span className="text-[0.55rem] text-[#00E5C9]">Abrir</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Instructions */}
        <SectionHeader title="Instrucciones" />
        <div className="px-3 py-1">
          {personaPrompt ? (
            <div className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] text-[0.65rem] text-[#B5B5B5] whitespace-pre-wrap max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {personaPrompt}
            </div>
          ) : (
            <p className="text-[0.6rem] text-[#666666] px-1">Sin instrucciones para esta tarea.</p>
          )}
        </div>

        {/* Context */}
        <SectionHeader title="Contexto" />
        <div className="px-3 py-1 space-y-1">
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.06)] text-[0.55rem] text-[#999999]">{s}</span>
              ))}
            </div>
          )}
          {sources.length > 0 && (
            <div className="space-y-0.5">
              {sources.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'fetched' ? 'bg-[#C9C9C9]' : s.status === 'error' ? 'bg-[#ef4444]' : 'bg-[#888888] animate-pulse'}`} />
                  <span className="text-[0.6rem] text-[#B5B5B5] truncate flex-1">{s.title}</span>
                  {s.url && <span className="text-[0.5rem] text-[#666666] shrink-0">{extractDomain(s.url)}</span>}
                </div>
              ))}
            </div>
          )}
          {skills.length === 0 && sources.length === 0 && (
            <p className="text-[0.6rem] text-[#666666] px-1">Sin contexto activo.</p>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

function CompactToolRow({ group, isRunning, onConfirmTool }: {
  group: ToolGroup
  isRunning: boolean
  onConfirmTool?: (allow: boolean) => void
}) {
  const { toolName, count, done, hasError, hasPending, warning } = group
  const allDone = count > 0 && !hasError && done >= count && !hasPending

  const circle = hasError
    ? 'bg-[#ef4444]'
    : allDone
      ? 'bg-[#DCB263]'
      : `bg-[#888888] ${isRunning || count === 0 ? 'animate-pulse' : ''}`

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors">
      <span className={`w-2 h-2 rounded-full shrink-0 ${circle}`} />
      <span className="text-[0.65rem] text-[#E5E5E5] font-mono truncate flex-1">{toolName}</span>
      {count > 0 && <span className="text-[0.55rem] text-[#666666] font-mono shrink-0">×{count}</span>}
      {warning && (
        <span title={warning} className="flex items-center shrink-0">
          <WarningIcon size={10} color="#f59e0b" />
        </span>
      )}
      {hasPending && onConfirmTool && (
        <span className="flex gap-1 shrink-0">
          <button onClick={() => onConfirmTool(true)} className="px-1.5 py-0.5 rounded text-[0.55rem] font-semibold bg-[rgba(0,229,201,0.12)] border border-[rgba(255,255,255,0.08)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.2)] transition-colors">Allow</button>
          <button onClick={() => onConfirmTool(false)} className="px-1.5 py-0.5 rounded text-[0.55rem] font-semibold bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-colors">Deny</button>
        </span>
      )}
    </div>
  )
}

function FileRow({ file, onShowInFolder, onOpen }: {
  file: FileItem
  onShowInFolder: (path: string) => void
  onOpen?: (f: { name: string; path: string; content: string }) => void
}) {
  const name = fileName(file.path)
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="1.5" className="shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span className="text-[0.65rem] text-[#E5E5E5] truncate flex-1" title={file.path}>{name}</span>
      <span className={`text-[0.5rem] font-mono px-1 py-0.5 rounded ${file.action === 'write' && file.written ? 'bg-[rgba(255,255,255,0.06)] text-[#B5B5B5]' : 'bg-[rgba(255,255,255,0.04)] text-[#666666]'}`}>
        {file.action === 'write' ? (file.written ? '✓' : '...') : 'leído'}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onShowInFolder(file.path) }}
        className="shrink-0 px-1.5 py-0.5 rounded text-[0.55rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] transition-colors"
        title="Mostrar en carpeta"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
      {file.action === 'write' && file.isMd && file.content && onOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpen({ name, path: file.path, content: file.content as string }) }}
          className="shrink-0 px-1.5 py-0.5 rounded text-[0.55rem] text-[#00E5C9] hover:text-white hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] transition-colors"
          title="Abrir en el chat"
        >
          Abrir
        </button>
      )}
    </div>
  )
}

export default ProgressPanel
