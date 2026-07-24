import { useState, useMemo } from 'react'
import type { WorkspaceAsideProps } from '../types'
import { useLegalWorkspace, type MatterType } from '../../../hooks/useLegalWorkspace'
import CaseList, { CaseTabs } from './CaseList'
import CaseModal from './CaseModal'
import DeadlineList from './DeadlineList'
import DeadlineModal from './DeadlineModal'
import LegalQuickActions from './LegalQuickActions'
import LibrarySection from './LibrarySection'
import { scaleBadge } from './utils'

export default function LegalWorkspace({
  conversations,
  isCollapsed,
  onToggle,
  onNew,
  onShowSettings,
  onOpenWiki,
}: WorkspaceAsideProps) {
  const {
    activeCases,
    archivedCases,
    closedCases,
    deadlines,
    upcomingDeadlines,
    addCase,
    updateCase,
    archiveCase,
    restoreCase,
    addDeadline,
    toggleDeadline,
    deleteDeadline,
  } = useLegalWorkspace()

  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [caseTab, setCaseTab] = useState<'active' | 'archived' | 'closed'>('active')
  const [showCaseModal, setShowCaseModal] = useState(false)
  const [editingCase, setEditingCase] = useState<ReturnType<typeof useLegalWorkspace>['cases'][number] | null>(null)
  const [showDeadlineModal, setShowDeadlineModal] = useState(false)

  const currentCases = useMemo(() => {
    switch (caseTab) {
      case 'archived': return archivedCases
      case 'closed': return closedCases
      default: return activeCases
    }
  }, [activeCases, archivedCases, closedCases, caseTab])

  const caseOptions = useMemo(() => activeCases.map(c => ({
    id: c.id,
    label: `${c.caseName} — ${c.clientName}`,
  })), [activeCases])

  const caseName = (id: string) => activeCases.find(c => c.id === id)?.caseName || 'Caso desconocido'

  const archivedCount = conversations.filter(c => c.archived).length

  const handleSaveCase = (data: { clientName: string; caseName: string; caseNumber?: string; matterType: MatterType; notes?: string; path?: string }) => {
    const payload = { ...data, path: data.path || '' }
    if (editingCase) {
      updateCase(editingCase.id, payload)
    } else {
      addCase(payload)
    }
    setShowCaseModal(false)
    setEditingCase(null)
  }

  const handleArchiveCase = (id: string) => {
    if (caseTab === 'active') archiveCase(id)
    else restoreCase(id)
  }

  const handleNewConversation = () => {
    onNew()
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3 py-3 px-2 bg-[#1A1A1A] border-r border-[rgba(255,255,255,0.04)] w-[52px] shrink-0 transition-all duration-250">
        <div className="w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.2)] flex items-center justify-center">
          <span className="text-[0.9rem]">⚖️</span>
        </div>
        <button onClick={onNew} className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.15)] hover:text-white transition-all" title="Nueva conversación">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button onClick={() => setShowCaseModal(true)} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#00E5C9] transition-colors" title="Nuevo caso">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button onClick={() => onShowSettings?.()} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#00E5C9] transition-colors" title="Configuración">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        {archivedCount > 0 && (
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#DCB263] transition-colors relative" title="Archivados">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#DCB263] text-[0.45rem] font-bold text-[#131313] flex items-center justify-center">{scaleBadge(archivedCount)}</span>
          </button>
        )}
        <button onClick={onToggle} className="mt-auto flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-[#E5E5E5] transition-colors" title="Expandir">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col bg-[#1A1A1A] border-r border-[rgba(255,255,255,0.04)] overflow-hidden transition-all duration-250 w-[320px] shrink-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] border-b border-[rgba(255,255,255,0.04)]">
          <div className="w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.1)] border border-[rgba(0,229,201,0.2)] flex items-center justify-center">
            <span className="text-[0.9rem]">⚖️</span>
          </div>
          <div className="flex-1">
            <div className="text-[0.8rem] font-semibold text-[#DCB263]">Solaria Legal</div>
            <div className="text-[0.5rem] text-[#666666] uppercase tracking-wider">Área Legal</div>
          </div>
          <button onClick={onToggle} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#E5E5E5] transition-colors" title="Colapsar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        </div>

        {/* Quick Actions */}
        <LegalQuickActions
          onNewCase={() => { setEditingCase(null); setShowCaseModal(true) }}
          onNewDeadline={() => setShowDeadlineModal(true)}
          onNewDocument={() => { /* placeholder */ }}
          onOpenLibrary={() => { /* placeholder */ }}
          onNewConversation={handleNewConversation}
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
          {/* Upcoming deadlines */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">Plazos próximos</span>
            {upcomingDeadlines.length > 0 && <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#999999]">{scaleBadge(upcomingDeadlines.length)}</span>}
          </div>
          <DeadlineList
            deadlines={upcomingDeadlines}
            caseName={caseName}
            onToggle={toggleDeadline}
            onDelete={deleteDeadline}
            max={5}
            emptyMessage="Sin plazos próximos"
          />

          {/* Cases */}
          <div className="flex items-center justify-between px-3 py-1.5 mt-2">
            <div className="flex items-center gap-2">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">Casos</span>
            </div>
          </div>
          <CaseTabs
            activeTab={caseTab}
            onChange={t => setCaseTab(t as any)}
            counts={{ active: activeCases.length, archived: archivedCases.length, closed: closedCases.length }}
          />
          <CaseList
            cases={currentCases}
            deadlines={deadlines}
            activeCaseId={activeCaseId}
            onSelect={id => setActiveCaseId(id)}
            onEdit={id => { setEditingCase(currentCases.find(c => c.id === id) || null); setShowCaseModal(true) }}
            onArchive={handleArchiveCase}
            emptyMessage={caseTab === 'active' ? 'No hay casos activos' : caseTab === 'archived' ? 'No hay casos archivados' : 'No hay casos cerrados'}
          />

          {/* Library */}
          <div className="flex items-center gap-2 px-3 py-1.5 mt-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">Biblioteca legal</span>
          </div>
          <LibrarySection />
        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.04)] px-3 py-2 space-y-0.5">
          <button onClick={() => onShowSettings?.()} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[0.75rem] text-[#999999] hover:text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
            <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <span>Configuración</span>
          </button>
          {onOpenWiki && (
            <button onClick={onOpenWiki} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[0.75rem] text-[#999999] hover:text-[#00E5C9] hover:bg-[rgba(0,229,201,0.04)] transition-colors">
              <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>
              </div>
              <span>Markdowns</span>
            </button>
          )}
        </div>
      </div>

      <CaseModal
        isOpen={showCaseModal}
        onClose={() => { setShowCaseModal(false); setEditingCase(null) }}
        initial={editingCase}
        onSave={handleSaveCase}
      />

      <DeadlineModal
        isOpen={showDeadlineModal}
        onClose={() => setShowDeadlineModal(false)}
        caseOptions={caseOptions}
        onSave={data => { addDeadline(data); setShowDeadlineModal(false) }}
      />
    </>
  )
}
