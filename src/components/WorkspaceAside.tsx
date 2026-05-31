import { useState, useMemo, useRef, useEffect } from 'react'
import type { Conversation } from '../hooks/useChat'

export interface Project {
  id: string
  name: string
  path: string
  createdAt: number
}

interface WorkspaceAsideProps {
  conversations: Conversation[]
  activeConvId: string | null
  isCollapsed: boolean
  onToggle: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onRename: (id: string, title: string) => void
  onShowSettings?: (tab?: string) => void
  projects?: Project[]
  onAddProject?: (project: Project) => void
  onDeleteProject?: (id: string) => void
  onSelectProject?: (project: Project) => void
  activeProjectId?: string | null
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = 60000
  const hour = 3600000
  const day = 86400000
  const week = 604800000
  const month = 2592000000
  if (diff < min) return 'ahora'
  if (diff < 2 * min) return '1m'
  if (diff < hour) return `${Math.round(diff / min)}m`
  if (diff < 2 * hour) return '1h'
  if (diff < day) return `${Math.round(diff / hour)}h`
  if (diff < 2 * day) return '1d'
  if (diff < week) return `${Math.round(diff / day)}d`
  if (diff < 2 * week) return '1s'
  if (diff < month) return `${Math.round(diff / week)}s`
  if (diff < 2 * month) return '1m'
  return `${Math.round(diff / month)}m`
}

function ConvDropdown({ conv, showArchived, onPin, onArchive, onRestore, onRename, onDelete }: {
  conv: Conversation
  showArchived: boolean
  onPin: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={'flex items-center justify-center w-5 h-5 rounded transition-colors ' + (open ? 'text-white bg-[rgba(255,255,255,0.08)]' : 'text-[#666666] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[rgba(255,255,255,0.06)]')}
        style={{ opacity: open ? 1 : undefined }}
        title="Más opciones"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-6 w-40 bg-[#1C1B1B] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl overflow-hidden animate-[fadeIn_0.1s_ease] z-50">
          {showArchived ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(conv.id); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(0,229,201,0.08)] hover:text-[#00E5C9] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Restaurar
            </button>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); const newTitle = prompt('Renombrar:', conv.title); if (newTitle?.trim()) onRename(conv.id, newTitle.trim()); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 114 4L7 21l-4 1 1-4L17 3z"/></svg>
                Editar título
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onPin(conv.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(220,178,99,0.08)] hover:text-[#DCB263] transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={conv.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {conv.pinned ? 'Desanclar' : 'Anclar'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(conv.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
                Archivar
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(conv.id); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

function ConvRow({ conv, activeConvId, editingId, editTitle, setEditTitle, setEditingId, showArchived, onSelect, onRename, onPin, onArchive, onRestore, onDelete }: {
  conv: Conversation
  activeConvId: string | null
  editingId: string | null
  editTitle: string
  setEditTitle: (v: string) => void
  setEditingId: (v: string | null) => void
  showArchived: boolean
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onPin: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={`group flex items-center gap-1 px-3 py-1.5 mx-1 rounded-md cursor-pointer transition-all text-[0.625rem] ${
        activeConvId === conv.id
          ? 'bg-[rgba(220,178,99,0.1)] text-white'
          : 'text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
      }`}
      onClick={() => onSelect(conv.id)}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {editingId === conv.id ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => { if (editTitle.trim()) onRename(conv.id, editTitle.trim()); setEditingId(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { if (editTitle.trim()) onRename(conv.id, editTitle.trim()); setEditingId(null) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            className="w-full bg-[#131313] border border-[#DCB263] rounded px-1 py-0.5 text-[0.6875rem] text-white outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {conv.pinned ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#DCB263" stroke="#DCB263" strokeWidth="1.5" className="shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ) : showArchived ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" className="shrink-0"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
            ) : conv.type === 'agent' ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2" className="shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,201,0.3))' }}>
                <rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="8" cy="13" r="1.5" fill="#00E5C9"/><circle cx="16" cy="13" r="1.5" fill="#00E5C9"/><path d="M12 3v3M12 16v3"/>
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2" className="shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            )}
            <span
              className="flex-1 truncate"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title) }}
            >
              {conv.title}
            </span>
            <span className="text-[0.5rem] text-[#4a4a4a] font-mono shrink-0 ml-1">{relativeTime(conv.updatedAt)}</span>
          </>
        )}
      </div>
      <ConvDropdown
        conv={conv}
        showArchived={showArchived}
        onPin={onPin}
        onArchive={onArchive}
        onRestore={onRestore}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  )
}

export default function WorkspaceAside({
  conversations,
  activeConvId,
  isCollapsed,
  onToggle,
  onSelect,
  onNew,
  onDelete,
  onPin,
  onArchive,
  onRestore,
  onRename,
  onShowSettings,
  projects = [],
  onAddProject,
  onDeleteProject,
  onSelectProject,
  activeProjectId,
}: WorkspaceAsideProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [convsExpanded, setConvsExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [projectFiles, setProjectFiles] = useState<Array<{name: string; is_dir: boolean; size: number}>>([])
  const [projectFilesLoading, setProjectFilesLoading] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId)

  useEffect(() => {
    if (!activeProject) { setProjectFiles([]); return }
    setProjectFilesLoading(true)
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<Array<{name: string; is_dir: boolean; size: number}>>('list_directory', { path: activeProject.path })
        .then(setProjectFiles).catch(() => setProjectFiles([])).finally(() => setProjectFilesLoading(false))
    })
  }, [activeProjectId, activeProject?.path])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations.filter(c => showArchived ? c.archived : !c.archived)
    const q = searchQuery.toLowerCase().trim()
    return conversations.filter(c =>
      (showArchived ? c.archived : !c.archived) && (
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
      )
    )
  }, [conversations, searchQuery, showArchived])

  const { pinnedConvs, unpinnedConvs } = useMemo(() => {
    const noProject = filtered.filter(c => !c.projectId)
    const pinned = noProject.filter(c => c.pinned)
    const unpinned = noProject.filter(c => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt)
    return { pinnedConvs: pinned, unpinnedConvs: unpinned }
  }, [filtered])
  const projectConvs = useMemo(() => {
    return conversations.filter(c => c.projectId && !c.archived).sort((a, b) => b.updatedAt - a.updatedAt)
  }, [conversations])
  const archivedCount = conversations.filter(c => c.archived).length

  return (
    <>
      {!isCollapsed && (
        <div className="flex flex-col bg-[#1C1B1B] border-r border-[rgba(255,255,255,0.04)] overflow-hidden transition-all duration-250 w-[260px] shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 min-h-[44px] border-b border-[rgba(255,255,255,0.04)]">
            <img src="/solaria-logo.svg" alt="Solaria" className="w-5 h-5" />
            <span className="text-[0.8125rem] font-semibold text-[#DCB263]">Solaria</span>
            <button
              onClick={onNew}
              className="ml-auto flex items-center justify-center w-7 h-7 rounded-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-all"
              title="Nueva conversación (Ctrl+N)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>

          <div className="px-2 py-1.5 border-b border-[rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] focus-within:border-[rgba(220,178,99,0.3)] transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent border-none outline-none text-[0.6875rem] text-white placeholder-[#666666]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex items-center justify-center w-4 h-4 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-white transition-colors">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => onShowSettings?.('skills')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[0.65rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>Skills</span>
            </button>

            <button
              onClick={() => setConvsExpanded(!convsExpanded)}
              className="flex items-center gap-1 w-full px-3 py-1 mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-[#666666] hover:text-[#999999] transition-colors"
            >
              <span className="flex-1 text-left">{showArchived ? 'Archivados' : 'Conversaciones'}</span>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${convsExpanded ? '' : '-rotate-90'}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {convsExpanded && (
            <>
              {(pinnedConvs.length === 0 && unpinnedConvs.length === 0) ? (
                <div className="text-center py-6 px-4">
                  <p className="text-[0.75rem] text-[#666666]">
                    {searchQuery ? 'Sin resultados' : showArchived ? 'Sin archivadas' : 'Sin conversaciones'}
                  </p>
                </div>
              ) : (
                <>
                  {pinnedConvs.length > 0 && (
                    <div className="mb-1">
                      <span className="block text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-[#999999] px-3 py-1">Anclados</span>
                      {pinnedConvs.map(conv => (
                        <ConvRow key={conv.id} conv={conv} activeConvId={activeConvId} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} setEditingId={setEditingId} showArchived={showArchived} onSelect={onSelect} onRename={onRename} onPin={onPin} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} />
                      ))}
                    </div>
                  )}
                  {unpinnedConvs.map(conv => (
                    <ConvRow key={conv.id} conv={conv} activeConvId={activeConvId} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} setEditingId={setEditingId} showArchived={showArchived} onSelect={onSelect} onRename={onRename} onPin={onPin} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} />
                  ))}
                </>
              )}
            </>
            )}

            <div className="flex items-center gap-1 w-full px-3 py-1 mt-1">
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="flex items-center gap-1 flex-1 text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-[#666666] hover:text-[#999999] transition-colors text-left"
              >
                <span>Proyectos</span>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${projectsExpanded ? '' : '-rotate-90'}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <button
                onClick={async () => {
                  try {
                    const name = prompt('Nombre del proyecto:')
                    if (!name?.trim()) return
                    const { open } = await import('@tauri-apps/plugin-dialog')
                    const path = await open({ directory: true, multiple: false, title: 'Seleccionar carpeta del proyecto' })
                    if (path) {
                      onAddProject?.({ id: crypto.randomUUID(), name: name.trim(), path: path as string, createdAt: Date.now() })
                    }
                  } catch {}
                }}
                className="flex items-center justify-center w-4 h-4 rounded hover:bg-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#00E5C9] transition-colors"
                title="Nuevo proyecto"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>

            {projectsExpanded && (
            <div className="mt-1">
              {projects.map((proj) => (
                <div key={proj.id}>
                  <div
                    className={`group flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer transition-all text-[0.75rem] ${
                      activeProjectId === proj.id
                        ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9]'
                        : 'text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
                    }`}
                    onClick={() => onSelectProject?.(proj)}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    <span className="flex-1 truncate">{proj.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteProject?.(proj.id) }}
                      className="opacity-0 group-hover:opacity-100 text-[#666666] hover:text-[#ef4444] transition-all"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  {activeProjectId === proj.id && (
                    <div className="ml-5 border-l border-[rgba(0,229,201,0.15)] pl-2">
                      {projectFilesLoading ? (
                        <div className="text-[0.75rem] text-[#666666] px-1 py-0.5">Cargando...</div>
                      ) : projectFiles.length === 0 ? (
                        <div className="text-[0.75rem] text-[#666666] px-1 py-0.5">vacío</div>
                      ) : (
                        projectFiles.slice(0, 20).map(f => (
                          <div key={f.name} className="flex items-center gap-1.5 px-1 py-0.5 text-[0.75rem] text-[#999999] truncate">
                            {f.is_dir ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            )}
                            <span className="truncate">{f.name}</span>
                          </div>
                        ))
                      )}
                      {projectFiles.length > 20 && (
                        <div className="text-[0.65rem] text-[#666666] px-1 py-0.5">+{projectFiles.length - 20} más</div>
                      )}
                      {projectConvs.filter(c => c.projectId === proj.id).slice(0, 10).map(conv => (
                        <div
                          key={conv.id}
                          className={`flex items-center gap-1 px-1 py-0.5 text-[0.75rem] cursor-pointer rounded ${
                            activeConvId === conv.id
                              ? 'bg-[rgba(0,229,201,0.1)] text-[#00E5C9]'
                              : 'text-[#999999] hover:text-[#E5E5E5]'
                          }`}
                          onClick={() => onSelect(conv.id)}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          <span className="flex-1 truncate">{conv.title}</span>
                          <span className="text-[0.5rem] text-[#4a4a4a] font-mono shrink-0">{relativeTime(conv.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="border-t border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[0.65rem] text-[#666666] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
              <span className="flex-1 text-left">{showArchived ? 'Volver' : 'Archivados'}</span>
              {archivedCount > 0 && !showArchived && (
                <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#999999]">{archivedCount}</span>
              )}
            </button>
            <button
              onClick={onToggle}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[0.65rem] text-[#666666] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              <span>Colapsar</span>
            </button>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="flex flex-col items-center gap-3 py-3 px-1.5 bg-[#1C1B1B] border-r border-[rgba(255,255,255,0.04)] w-[48px] shrink-0 transition-all duration-250">
          <img src="/solaria-logo.svg" alt="Solaria" className="w-5 h-5 mt-1" />
          <button onClick={onNew} className="flex items-center justify-center w-8 h-8 rounded-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-all" title="Nueva conversación (Ctrl+N)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          {archivedCount > 0 && (
            <button onClick={() => setShowArchived(true)} className="flex items-center justify-center w-8 h-8 rounded-md border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#DCB263] transition-colors relative" title="Archivados">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#DCB263] text-[0.45rem] font-bold text-[#131313] flex items-center justify-center">{archivedCount}</span>
            </button>
          )}
          <button onClick={onToggle} className="mt-auto flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-[#E5E5E5] transition-colors" title="Expandir">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      )}
    </>
  )
}
