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
  onOpenWiki?: () => void
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ════════════════════════════════
   DROPDOWN
   ════════════════════════════════ */
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className={`flex items-center justify-center w-6 h-6 rounded-lg transition-all ${
          open ? 'text-white bg-[rgba(255,255,255,0.08)]' : 'text-[#666666] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
        }`}
        style={{ opacity: open ? 1 : undefined }}
        title="Más opciones"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-7 w-44 bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-50 animate-[fadeIn_0.1s_ease]">
          {showArchived ? (
            <button onClick={e => { e.stopPropagation(); onRestore(conv.id); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[0.7rem] text-[#E5E5E5] hover:bg-[rgba(0,229,201,0.08)] hover:text-[#00E5C9] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Restaurar
            </button>
          ) : (
            <>
              <button onClick={e => { e.stopPropagation(); const newTitle = prompt('Renombrar:', conv.title); if (newTitle?.trim()) onRename(conv.id, newTitle.trim()); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[0.7rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7 21l-4 1 1-4L17 3z"/></svg>
                Editar titulo
              </button>
              <button onClick={e => { e.stopPropagation(); onPin(conv.id); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[0.7rem] text-[#E5E5E5] hover:bg-[rgba(220,178,99,0.08)] hover:text-[#DCB263] transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill={conv.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {conv.pinned ? 'Desanclar' : 'Anclar'}
              </button>
              <button onClick={e => { e.stopPropagation(); onArchive(conv.id); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[0.7rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
                Archivar
              </button>
            </>
          )}
          <div className="border-t border-[rgba(255,255,255,0.04)]" />
          <button onClick={e => { e.stopPropagation(); onDelete(conv.id); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[0.7rem] text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════
   ROW
   ════════════════════════════════ */
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
  const isActive = activeConvId === conv.id

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 mx-1.5 rounded-xl cursor-pointer transition-all text-[0.7rem] ${
        isActive
          ? 'bg-[rgba(0,229,201,0.08)] text-white border border-[rgba(0,229,201,0.15)]'
          : 'text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
      }`}
      onClick={() => onSelect(conv.id)}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {editingId === conv.id ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => { if (editTitle.trim()) onRename(conv.id, editTitle.trim()); setEditingId(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { if (editTitle.trim()) onRename(conv.id, editTitle.trim()); setEditingId(null) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            className="w-full bg-[#1A1A1A] border border-[#DCB263] rounded-lg px-2 py-1 text-[0.7rem] text-white outline-none"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <>
            {conv.pinned ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#DCB263" stroke="#DCB263" strokeWidth="1.5" className="shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ) : showArchived ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" className="shrink-0"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
            ) : null}
            <span className="flex-1 truncate text-[0.7rem]" onDoubleClick={e => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title) }}>
              {conv.title}
            </span>
            <span className="text-[0.55rem] text-[#555555] font-mono shrink-0">{relativeTime(conv.updatedAt)}</span>
          </>
        )}
      </div>
      <ConvDropdown conv={conv} showArchived={showArchived} onPin={onPin} onArchive={onArchive} onRestore={onRestore} onRename={onRename} onDelete={onDelete} />
    </div>
  )
}

/* ════════════════════════════════
   SECTION HEADER
   ════════════════════════════════ */
function SectionHeader({ title, expanded, onToggle, badge, action }: {
  title: string
  expanded: boolean
  onToggle: () => void
  badge?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 mt-1">
      <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 text-left">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" className={`transition-transform ${expanded ? '' : '-rotate-90'}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">{title}</span>
        {badge && <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#999999]">{badge}</span>}
      </button>
      {action}
    </div>
  )
}

/* ════════════════════════════════
   MAIN
   ════════════════════════════════ */
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
  onOpenWiki,
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
      {/* EXPANDED */}
      {!isCollapsed && (
        <div className="flex flex-col bg-[#1A1A1A] border-r border-[rgba(255,255,255,0.04)] overflow-hidden transition-all duration-250 w-[320px] shrink-0">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] border-b border-[rgba(255,255,255,0.04)]">
            <img src="/solaria-logo.svg" alt="Solaria" className="w-8 h-8 rounded-lg" />
            <div className="flex-1">
              <div className="text-[0.8rem] font-semibold text-[#DCB263]">Solaria</div>
              <div className="text-[0.5rem] text-[#666666] uppercase tracking-wider">Workspace</div>
            </div>
            <button onClick={onNew} className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.15)] hover:text-white transition-all" title="Nueva conversacion (Ctrl+N)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            {onOpenWiki && (
              <button onClick={onOpenWiki} className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.04)] border border-[rgba(0,229,201,0.1)] text-[#00E5C9]/70 hover:bg-[rgba(0,229,201,0.12)] hover:text-[#00E5C9] transition-all" title="Abrir Markdowns">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/>
                  <line x1="8" y1="17" x2="14" y2="17"/>
                </svg>
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#222] border border-[rgba(255,255,255,0.04)] focus-within:border-[rgba(0,229,201,0.2)] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar conversaciones..." className="flex-1 bg-transparent border-none outline-none text-[0.7rem] text-white placeholder-[#555555]" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>

            {/* Skills */}
            <button onClick={() => onShowSettings?.('skills')} className="flex items-center gap-2.5 w-full px-4 py-2 mx-1.5 rounded-xl text-[0.7rem] text-[#DCB263] hover:bg-[rgba(220,178,99,0.06)] hover:border-[rgba(220,178,99,0.1)] border border-transparent transition-all mb-1">
              <div className="w-6 h-6 rounded-md bg-[rgba(220,178,99,0.08)] border border-[rgba(220,178,99,0.15)] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <span className="font-medium">Skills</span>
            </button>

            {/* Conversations */}
            <SectionHeader title={showArchived ? 'Archivados' : 'Conversaciones'} expanded={convsExpanded} onToggle={() => setConvsExpanded(!convsExpanded)} badge={showArchived ? undefined : unpinnedConvs.length > 0 ? unpinnedConvs.length.toString() : undefined} />

            {convsExpanded && (
              <>
                {(pinnedConvs.length === 0 && unpinnedConvs.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
                    <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <p className="text-[0.65rem] text-[#666666]">{searchQuery ? 'Sin resultados' : showArchived ? 'Sin archivadas' : 'Sin conversaciones'}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 px-1">
                    {pinnedConvs.length > 0 && (
                      <div className="mb-1">
                        <div className="flex items-center gap-2 px-3 py-1">
                          <span className="w-1 h-1 rounded-full bg-[#DCB263]" />
                          <span className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">Anclados</span>
                        </div>
                        {pinnedConvs.map(conv => <ConvRow key={conv.id} conv={conv} activeConvId={activeConvId} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} setEditingId={setEditingId} showArchived={showArchived} onSelect={onSelect} onRename={onRename} onPin={onPin} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} />)}
                      </div>
                    )}
                    {unpinnedConvs.map(conv => <ConvRow key={conv.id} conv={conv} activeConvId={activeConvId} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} setEditingId={setEditingId} showArchived={showArchived} onSelect={onSelect} onRename={onRename} onPin={onPin} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} />)}
                  </div>
                )}
              </>
            )}

            {/* Projects */}
            <SectionHeader title="Proyectos" expanded={projectsExpanded} onToggle={() => setProjectsExpanded(!projectsExpanded)} badge={projects.length > 0 ? projects.length.toString() : undefined} action={
              <button onClick={async () => { try { const name = prompt('Nombre del proyecto:'); if (!name?.trim()) return; const { open } = await import('@tauri-apps/plugin-dialog'); const path = await open({ directory: true, multiple: false, title: 'Seleccionar carpeta del proyecto' }); if (path) onAddProject?.({ id: crypto.randomUUID(), name: name.trim(), path: path as string, createdAt: Date.now() }) } catch {} }} className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-[#00E5C9] transition-colors" title="Nuevo proyecto">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            } />

            {projectsExpanded && (
              <div className="px-1 space-y-0.5">
                {projects.map(proj => (
                  <div key={proj.id}>
                    <div className={`group flex items-center gap-2.5 px-3 py-2 mx-1 rounded-xl cursor-pointer transition-all text-[0.7rem] ${activeProjectId === proj.id ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9] border border-[rgba(0,229,201,0.15)]' : 'text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'}`} onClick={() => onSelectProject?.(proj)}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${activeProjectId === proj.id ? 'bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.2)]' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeProjectId === proj.id ? '#00E5C9' : '#666666'} strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      </div>
                      <span className="flex-1 truncate font-medium">{proj.name}</span>
                      <button onClick={e => { e.stopPropagation(); onDeleteProject?.(proj.id) }} className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md flex items-center justify-center text-[#666666] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-all">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>

                    {activeProjectId === proj.id && (
                      <div className="ml-3 mt-0.5 mb-1 space-y-0.5 px-1">
                        {projectFilesLoading ? (
                          <div className="flex items-center gap-2 px-3 py-2 mx-1.5 text-[0.65rem] text-[#666666]"><svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Cargando...</div>
                        ) : projectFiles.length === 0 ? (
                          <div className="px-3 py-2 mx-1.5 text-[0.65rem] text-[#666666]">vacio</div>
                        ) : (
                          projectFiles.slice(0, 8).map(f => (
                            <div key={f.name} className="flex items-center gap-2 px-3 py-2 mx-1.5 rounded-xl cursor-default transition-all text-[0.7rem] text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white border border-transparent">
                              <span className="flex-1 truncate">{f.name}</span>
                              <span className="text-[0.55rem] text-[#555555] font-mono shrink-0">{formatSize(f.size)}</span>
                            </div>
                          ))
                        )}
                        {projectFiles.length > 8 && <div className="px-3 py-1 mx-1.5 text-[0.6rem] text-[#666666]">+{projectFiles.length - 8} mas</div>}
                        {projectConvs.filter(c => c.projectId === proj.id).slice(0, 5).map(conv => (
                          <div key={conv.id} className={`group flex items-center gap-2 px-3 py-2 mx-1.5 rounded-xl cursor-pointer transition-all text-[0.7rem] ${activeConvId === conv.id ? 'bg-[rgba(0,229,201,0.08)] text-white border border-[rgba(0,229,201,0.15)]' : 'text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white border border-transparent'}`} onClick={() => onSelect(conv.id)}>
                            <span className="flex-1 truncate">{conv.title}</span>
                            <span className="text-[0.55rem] text-[#555555] font-mono shrink-0">{relativeTime(conv.updatedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[rgba(255,255,255,0.04)] px-3 py-2 space-y-0.5">
            <button onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[0.7rem] text-[#999999] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
              <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
              </div>
              <span className="flex-1 text-left">{showArchived ? 'Volver' : 'Archivados'}</span>
              {archivedCount > 0 && !showArchived && <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#999999]">{archivedCount}</span>}
            </button>
            <button onClick={onToggle} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[0.7rem] text-[#999999] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
              <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </div>
              <span>Colapsar</span>
            </button>
          </div>
        </div>
      )}

      {/* COLLAPSED */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-3 py-3 px-2 bg-[#1A1A1A] border-r border-[rgba(255,255,255,0.04)] w-[52px] shrink-0 transition-all duration-250">
          <img src="/solaria-logo.svg" alt="Solaria" className="w-8 h-8 rounded-lg" />
          <button onClick={onNew} className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.15)] hover:text-white transition-all" title="Nueva conversacion (Ctrl+N)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          {archivedCount > 0 && (
            <button onClick={() => setShowArchived(true)} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#DCB263] transition-colors relative" title="Archivados">
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
