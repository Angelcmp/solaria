import type { LegalDeadline } from '../../../hooks/useLegalWorkspace'
import { daysUntil, deadlineLabel } from './utils'

interface DeadlineListProps {
  deadlines: LegalDeadline[]
  caseName?: (id: string) => string
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  max?: number
  emptyMessage?: string
}

export default function DeadlineList({ deadlines, caseName, onToggle, onDelete, max, emptyMessage }: DeadlineListProps) {
  const sorted = [...deadlines]
    .filter(d => !d.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, max)

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 gap-2 text-center">
        <p className="text-[0.65rem] text-[#666666]">{emptyMessage || 'Sin plazos próximos'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 px-1">
      {sorted.map(d => {
        const days = daysUntil(d.date)
        const color = days <= 1 ? 'text-[#ef4444]' : days <= 3 ? 'text-[#DCB263]' : 'text-[#00E5C9]'
        return (
          <div key={d.id} className="flex items-center gap-2 px-3 py-2 mx-1 rounded-lg bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-colors group">
            <button
              onClick={() => onToggle(d.id)}
              className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                d.completed ? 'bg-[#00E5C9] border-[#00E5C9]' : 'bg-transparent border-[rgba(255,255,255,0.25)] hover:border-[#00E5C9]'
              }`}
            >
              {d.completed && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#131313" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-[0.7rem] truncate ${d.completed ? 'text-[#666666] line-through' : 'text-[#E5E5E5]'}`}>{d.title}</div>
              <div className="flex items-center gap-2 text-[0.55rem]">
                <span className={color}>{deadlineLabel(days)} · {d.date}</span>
                {caseName && <span className="text-[#555555] truncate">{caseName(d.caseId)}</span>}
              </div>
            </div>
            <button
              onClick={() => onDelete(d.id)}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md flex items-center justify-center text-[#666666] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-all"
              title="Eliminar"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
