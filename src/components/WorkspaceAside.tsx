import { useState, useMemo } from 'react'
import type { Conversation } from '../hooks/useChat'

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
}

function formatDate(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const day = 86400000
  if (diff < day) return 'Hoy'
  if (diff < 2 * day) return 'Ayer'
  const d = new Date(ts)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function groupConversations(convs: Conversation[]) {
  const pinned = convs.filter(c => c.pinned)
  const unpinned = convs.filter(c => !c.pinned)
  const groups: { label: string; convs: Conversation[] }[] = []

  if (pinned.length > 0) groups.push({ label: 'Anclados', convs: pinned })

  const today: Conversation[] = []
  const yesterday: Conversation[] = []
  const older: Conversation[] = []

  for (const c of unpinned) {
    const label = formatDate(c.updatedAt)
    if (label === 'Hoy') today.push(c)
    else if (label === 'Ayer') yesterday.push(c)
    else older.push(c)
  }

  if (today.length) groups.push({ label: 'Hoy', convs: today })
  if (yesterday.length) groups.push({ label: 'Ayer', convs: yesterday })
  if (older.length) groups.push({ label: 'Anteriores', convs: older })

  return groups
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
}: WorkspaceAsideProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

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

  const groups = groupConversations(filtered)

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
            {filtered.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-[0.75rem] text-[#666666]">
                  {searchQuery ? 'Sin resultados' : showArchived ? 'Sin archivadas' : 'Sin conversaciones'}
                </p>
              </div>
            ) : (
              groups.map(group => (
                <div key={group.label} className="mb-2">
                  <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#666666] px-2 py-1">
                    {group.label}
                  </span>
                  {group.convs.map(conv => (
                    <div
                      key={conv.id}
                      className={`group flex items-start gap-1 px-2 py-2 mx-1 rounded-md cursor-pointer transition-all text-[0.625rem] ${
                        activeConvId === conv.id
                          ? 'bg-[rgba(220,178,99,0.1)] text-white'
                          : 'text-[#999999] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
                      }`}
                      onClick={() => onSelect(conv.id)}
                    >
                      <div className="flex-1 min-w-0">
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
                          <div className="flex items-center gap-1.5">
                            {showArchived ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" className="shrink-0"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
                            ) : conv.type === 'agent' ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="2" className="shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,201,0.3))' }}>
                                <rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="8" cy="13" r="1.5" fill="#00E5C9"/><circle cx="16" cy="13" r="1.5" fill="#00E5C9"/><path d="M12 3v3M12 16v3"/>
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DCB263" strokeWidth="2" className="shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            )}
                            <span
                              className="flex-1 truncate"
                              onDoubleClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title) }}
                            >
                              {conv.title}
                            </span>
                          </div>
                        )}
                        {conv.toolSummary && Object.keys(conv.toolSummary).length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5 pl-[19px]">
                            {Object.entries(conv.toolSummary).map(([tool, count]) => (
                              <span key={tool} className="text-[0.5rem] text-[#4a4a4a] font-mono">{tool}×{count}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {showArchived ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRestore(conv.id) }}
                            className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(0,229,201,0.15)] hover:text-[#00E5C9] text-[#666666] transition-colors"
                            title="Restaurar"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); onPin(conv.id) }}
                              className={`flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(220,178,99,0.15)] hover:text-[#DCB263] transition-colors ${conv.pinned ? 'text-[#DCB263]' : 'text-[#666666]'}`}
                              title={conv.pinned ? 'Desanclar' : 'Anclar'}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill={conv.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onArchive(conv.id) }}
                              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(220,178,99,0.15)] hover:text-[#DCB263] text-[#666666] transition-colors"
                              title="Archivar"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                          className="flex items-center justify-center w-5 h-5 rounded hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444] text-[#666666] transition-colors"
                          title="Eliminar"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
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
