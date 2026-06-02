import { useState, useEffect, useCallback, useRef } from 'react'
import Markdown from '../lib/Markdown'

export interface WikiFile {
  name: string
  path: string
  size: number
  modified: number
}

interface WikiAsideProps {
  workingDirectory?: string
  isCollapsed: boolean
  onToggle: () => void
  onBackToChat?: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelative(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() / 1000 - ts
  const min = 60, hour = 3600, day = 86400, week = 604800, month = 2592000
  if (diff < min) return 'ahora'
  if (diff < hour) return `${Math.round(diff / min)}m`
  if (diff < day) return `${Math.round(diff / hour)}h`
  if (diff < week) return `${Math.round(diff / day)}d`
  if (diff < month) return `${Math.round(diff / week)}s`
  return `${Math.round(diff / month)}M`
}

function displayName(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

function Spinner() {
  return (
    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

/* ════════════════════════════════
   FILE ROW — sin iconos, padding compacto
   ════════════════════════════════ */
function WikiFileRow({ file, active, onClick }: { file: WikiFile; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 mx-1 rounded-lg cursor-pointer transition-all text-[0.7rem] ${
        active
          ? 'bg-[rgba(0,229,201,0.08)] text-white border border-[rgba(0,229,201,0.15)]'
          : 'text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white border border-transparent'
      }`}
      title={file.path}
    >
      <span className="flex-1 truncate font-medium">{displayName(file.name)}</span>
      <span className="text-[0.55rem] text-[#555555] font-mono shrink-0">{formatSize(file.size)}</span>
      {file.modified > 0 && (
        <span className="text-[0.55rem] text-[#555555] font-mono shrink-0">{formatRelative(file.modified)}</span>
      )}
    </div>
  )
}

/* ════════════════════════════════
   MAIN
   ════════════════════════════════ */
export default function WikiAside({ workingDirectory, isCollapsed, onToggle, onBackToChat }: WikiAsideProps) {
  const [files, setFiles] = useState<WikiFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activePath, setActivePath] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!workingDirectory) { setFiles([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<WikiFile[]>('wiki_list_files', { dir: workingDirectory })
      setFiles(result)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [workingDirectory])

  useEffect(() => { load() }, [load])

  const openFile = useCallback(async (path: string) => {
    setActivePath(path)
    setContent(null)
    setContentLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const text = await invoke<string>('wiki_read_file', { path })
      setContent(text)
    } catch (e) {
      setContent(`Error leyendo archivo: ${e}`)
    }
    setContentLoading(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  const closeFile = () => {
    setActivePath(null)
    setContent(null)
  }

  const filtered = files.filter(f =>
    !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
  )

  const activeFile = files.find(f => f.path === activePath)
  const dirName = workingDirectory ? workingDirectory.split('/').filter(Boolean).pop() || workingDirectory : ''

  return (
    <>
      {/* EXPANDED */}
      {!isCollapsed && (
        <div className="flex flex-col bg-[#1A1A1A] border-r border-[rgba(255,255,255,0.04)] overflow-hidden transition-all duration-250 w-[320px] shrink-0">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] border-b border-[rgba(255,255,255,0.04)]">
            <div className="w-8 h-8 rounded-lg bg-[#00E5C9]/10 border border-[#00E5C9]/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="14" y2="17"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.8rem] font-semibold text-[#00E5C9]">Markdowns</div>
              <div className="text-[0.5rem] text-[#666666] uppercase tracking-wider truncate" title={workingDirectory || ''}>
                {dirName || 'Sin working dir'}
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.15)] hover:text-white transition-all"
              title="Recargar"
            >
              {loading ? <Spinner /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              )}
            </button>
          </div>

          {/* VIEWER MODE: show file content */}
          {activePath && activeFile ? (
            <>
              {/* File header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
                <button
                  onClick={closeFile}
                  className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white transition-colors shrink-0"
                  title="Volver a la lista"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.7rem] font-semibold text-white truncate">{displayName(activeFile.name)}</div>
                  <div className="text-[0.5rem] text-[#666666] font-mono truncate" title={activeFile.path}>{activeFile.path}</div>
                </div>
                <span className="text-[0.5rem] text-[#555555] font-mono shrink-0">{formatSize(activeFile.size)}</span>
              </div>

              {/* File content */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
                {contentLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Spinner />
                    <span className="text-[0.65rem] text-[#999999]">Cargando archivo...</span>
                  </div>
                ) : content ? (
                  <Markdown content={content} compact />
                ) : null}
              </div>
            </>
          ) : (
            <>
              {/* Search */}
              <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#222] border border-[rgba(255,255,255,0.04)] focus-within:border-[rgba(0,229,201,0.2)] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar archivos .md..."
                    className="flex-1 bg-transparent border-none outline-none text-[0.7rem] text-white placeholder-[#555555]"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Spinner />
                    <span className="text-[0.65rem] text-[#999999]">Listando archivos...</span>
                  </div>
                ) : error ? (
                  <div className="mx-3 my-4 px-3 py-2 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
                    <p className="text-[0.65rem] text-[#ef4444]">{error}</p>
                  </div>
                ) : !workingDirectory ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 text-center">
                    <p className="text-[0.65rem] text-[#999999]">Sin directorio de trabajo</p>
                    <p className="text-[0.55rem] text-[#666666]">Configura el working dir del agente para listar archivos .md aquí.</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 text-center">
                    <p className="text-[0.65rem] text-[#999999]">{search ? 'Sin resultados' : 'Sin archivos .md'}</p>
                    {!search && <p className="text-[0.55rem] text-[#666666]">Añade archivos .md en {dirName}</p>}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#00E5C9]" />
                      <span className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">
                        Notas ({filtered.length})
                      </span>
                    </div>
                    {filtered.map(f => (
                      <WikiFileRow
                        key={f.path}
                        file={f}
                        active={activePath === f.path}
                        onClick={() => openFile(f.path)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="border-t border-[rgba(255,255,255,0.04)] px-3 py-2 space-y-0.5">
            {onBackToChat && !activePath && (
              <button onClick={onBackToChat} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[0.7rem] text-[#999999] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span>Volver a conversaciones</span>
              </button>
            )}
            <button onClick={onToggle} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[0.7rem] text-[#999999] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
              <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </div>
              <span>Colapsar</span>
            </button>
          </div>
        </div>
      )}

      {/* COLLAPSED */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-3 py-3 px-2 bg-[#1A1A1A] border-r border-[rgba(255,255,255,0.04)] w-[52px] shrink-0 transition-all duration-250">
          <div className="w-8 h-8 rounded-lg bg-[#00E5C9]/10 border border-[#00E5C9]/20 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="14" y2="17"/>
            </svg>
          </div>
          {files.length > 0 && (
            <div className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] flex items-center justify-center text-[0.55rem] font-mono">
              {files.length}
            </div>
          )}
          {onBackToChat && (
            <button onClick={onBackToChat} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#00E5C9] transition-colors" title="Volver a conversaciones">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}
          <button onClick={onToggle} className="mt-auto flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-[#E5E5E5] transition-colors" title="Expandir">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
