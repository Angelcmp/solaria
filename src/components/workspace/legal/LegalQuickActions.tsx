interface LegalQuickActionsProps {
  onNewCase: () => void
  onNewDeadline: () => void
  onNewDocument: () => void
  onOpenLibrary: () => void
  onNewConversation: () => void
}

export default function LegalQuickActions({ onNewCase, onNewDeadline, onNewDocument, onOpenLibrary, onNewConversation }: LegalQuickActionsProps) {
  const actions = [
    { label: 'Nuevo caso', icon: '⚖️', onClick: onNewCase },
    { label: 'Plazo', icon: '⏰', onClick: onNewDeadline },
    { label: 'Documento', icon: '📄', onClick: onNewDocument },
    { label: 'Biblioteca', icon: '📚', onClick: onOpenLibrary },
  ]

  return (
    <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-[0.65rem] text-[#E5E5E5] hover:bg-[rgba(0,229,201,0.06)] hover:border-[rgba(0,229,201,0.12)] hover:text-[#00E5C9] transition-all"
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onNewConversation}
        className="mt-2 flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[0.65rem] text-[#00E5C9] hover:bg-[rgba(0,229,201,0.12)] transition-all"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Nueva conversación legal</span>
      </button>
    </div>
  )
}
