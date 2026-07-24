import type { LegalCase, LegalDeadline } from '../../../hooks/useLegalWorkspace'
import { matterLabel, daysUntil, deadlineLabel } from './utils'

interface CaseCardProps {
  legalCase: LegalCase
  deadlines: LegalDeadline[]
  isActive: boolean
  onClick: () => void
  onEdit: () => void
  onArchive: () => void
}

function CaseCard({ legalCase, deadlines, isActive, onClick, onEdit, onArchive }: CaseCardProps) {
  const activeDeadlines = deadlines
    .filter(d => !d.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const nextDeadline = activeDeadlines[0]

  return (
    <div
      onClick={onClick}
      className={`group flex flex-col gap-1.5 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-all border ${
        isActive
          ? 'bg-[rgba(0,229,201,0.06)] border-[rgba(0,229,201,0.15)] text-white'
          : 'bg-transparent border-transparent text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-[rgba(220,178,99,0.1)] text-[#DCB263] font-medium">
              {matterLabel(legalCase.matterType)}
            </span>
            {legalCase.caseNumber && <span className="text-[0.55rem] text-[#666666] font-mono">#{legalCase.caseNumber}</span>}
          </div>
          <div className="text-[0.75rem] font-medium truncate mt-1">{legalCase.caseName}</div>
          <div className="text-[0.65rem] text-[#888888] truncate">{legalCase.clientName}</div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="w-5 h-5 rounded-md flex items-center justify-center text-[#666666] hover:text-[#00E5C9] hover:bg-[rgba(0,229,201,0.08)] transition-all"
            title="Editar"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7 21l-4 1 1-4L17 3z"/></svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onArchive() }}
            className="w-5 h-5 rounded-md flex items-center justify-center text-[#666666] hover:text-[#DCB263] hover:bg-[rgba(220,178,99,0.08)] transition-all"
            title="Archivar"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
          </button>
        </div>
      </div>

      {nextDeadline && (
        <div className={`flex items-center gap-1.5 text-[0.6rem] ${
          daysUntil(nextDeadline.date) <= 1 ? 'text-[#ef4444]' : daysUntil(nextDeadline.date) <= 3 ? 'text-[#DCB263]' : 'text-[#00E5C9]'
        }`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="truncate">{nextDeadline.title} · {deadlineLabel(daysUntil(nextDeadline.date))}</span>
        </div>
      )}

      {legalCase.notes && (
        <div className="text-[0.6rem] text-[#666666] truncate">{legalCase.notes}</div>
      )}
    </div>
  )
}

interface CaseListProps {
  cases: LegalCase[]
  deadlines: LegalDeadline[]
  activeCaseId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onArchive: (id: string) => void
  emptyMessage?: string
}

export default function CaseList({ cases, deadlines, activeCaseId, onSelect, onEdit, onArchive, emptyMessage }: CaseListProps) {
  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 text-center">
        <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <p className="text-[0.65rem] text-[#666666]">{emptyMessage || 'Sin casos'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 px-1">
      {cases.map(c => (
        <CaseCard
          key={c.id}
          legalCase={c}
          deadlines={deadlines.filter(d => d.caseId === c.id)}
          isActive={activeCaseId === c.id}
          onClick={() => onSelect(c.id)}
          onEdit={() => onEdit(c.id)}
          onArchive={() => onArchive(c.id)}
        />
      ))}
    </div>
  )
}

export function CaseTabs({ activeTab, onChange, counts }: { activeTab: string; onChange: (t: string) => void; counts: { active: number; archived: number; closed: number } }) {
  const tabs = [
    { key: 'active', label: 'Activos', count: counts.active },
    { key: 'archived', label: 'Archivados', count: counts.archived },
    { key: 'closed', label: 'Cerrados', count: counts.closed },
  ]

  return (
    <div className="flex items-center gap-1 px-3 py-1.5">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] transition-colors ${
            activeTab === t.key
              ? 'bg-[rgba(0,229,201,0.08)] text-[#00E5C9]'
              : 'text-[#666666] hover:text-white hover:bg-[rgba(255,255,255,0.04)]'
          }`}
        >
          {t.label}
          {t.count > 0 && <span className="text-[0.5rem] px-1 rounded-full bg-[rgba(255,255,255,0.08)]">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
