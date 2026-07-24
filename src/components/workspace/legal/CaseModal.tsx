import { useState, useEffect } from 'react'
import type { LegalCase, MatterType } from '../../../hooks/useLegalWorkspace'
import { MATTER_TYPES } from './utils'

interface CaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { clientName: string; caseName: string; caseNumber?: string; matterType: MatterType; notes?: string; path?: string }) => void
  initial?: LegalCase | null
}

export default function CaseModal({ isOpen, onClose, onSave, initial }: CaseModalProps) {
  const [clientName, setClientName] = useState('')
  const [caseName, setCaseName] = useState('')
  const [caseNumber, setCaseNumber] = useState('')
  const [matterType, setMatterType] = useState<MatterType>('civil')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setClientName(initial?.clientName || '')
      setCaseName(initial?.caseName || '')
      setCaseNumber(initial?.caseNumber || '')
      setMatterType(initial?.matterType || 'civil')
      setNotes(initial?.notes || '')
      setError(null)
    }
  }, [isOpen, initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim()) { setError('Ingresa el nombre del cliente'); return }
    if (!caseName.trim()) { setError('Ingresa el nombre del caso'); return }
    onSave({
      clientName: clientName.trim(),
      caseName: caseName.trim(),
      caseNumber: caseNumber.trim() || undefined,
      matterType,
      notes: notes.trim() || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[460px] bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h3 className="text-[0.9rem] font-medium text-[#E5E5E5]">{initial ? 'Editar caso' : 'Nuevo caso'}</h3>
            <p className="text-[0.65rem] text-[#666666] mt-0.5">Datos del cliente y del asunto legal</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Cliente</label>
            <input
              value={clientName}
              onChange={e => { setClientName(e.target.value); setError(null) }}
              placeholder="Nombre del cliente"
              className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white placeholder-[#555555] outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Caso</label>
              <input
                value={caseName}
                onChange={e => { setCaseName(e.target.value); setError(null) }}
                placeholder="Pérez vs Empresa X"
                className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white placeholder-[#555555] outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Número de caso</label>
              <input
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white placeholder-[#555555] outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Materia</label>
            <div className="grid grid-cols-4 gap-2">
              {MATTER_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setMatterType(t.value as MatterType)}
                  className={`px-2 py-1.5 rounded-lg text-[0.65rem] border transition-colors ${
                    matterType === t.value
                      ? 'bg-[rgba(0,229,201,0.1)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]'
                      : 'bg-[#1C1B1B] border-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles relevantes del caso..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white placeholder-[#555555] outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
              <p className="text-[0.65rem] text-[#ef4444]">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[0.75rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.04)] transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[linear-gradient(135deg,#00E5C9,#DCB263)] text-[#131313] text-[0.75rem] font-medium hover:shadow-[0_0_12px_rgba(0,229,201,0.15)] transition-all">{initial ? 'Guardar cambios' : 'Crear caso'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
