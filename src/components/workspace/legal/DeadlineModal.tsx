import { useState, useEffect } from 'react'
import type { LegalDeadline } from '../../../hooks/useLegalWorkspace'

interface DeadlineModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { caseId: string; title: string; date: string; priority: 'low' | 'medium' | 'high' }) => void
  caseOptions: { id: string; label: string }[]
  initial?: LegalDeadline | null
}

export default function DeadlineModal({ isOpen, onClose, onSave, caseOptions, initial }: DeadlineModalProps) {
  const [caseId, setCaseId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setCaseId(initial?.caseId || caseOptions[0]?.id || '')
      setTitle(initial?.title || '')
      setDate(initial?.date || '')
      setPriority(initial?.priority || 'medium')
      setError(null)
    }
  }, [isOpen, initial, caseOptions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseId) { setError('Selecciona un caso'); return }
    if (!title.trim()) { setError('Ingresa un título'); return }
    if (!date) { setError('Selecciona una fecha'); return }
    onSave({ caseId, title: title.trim(), date, priority })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[420px] bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h3 className="text-[0.9rem] font-medium text-[#E5E5E5]">{initial ? 'Editar plazo' : 'Nuevo plazo'}</h3>
            <p className="text-[0.65rem] text-[#666666] mt-0.5">Fecha límite o tarea pendiente</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Caso</label>
            <select
              value={caseId}
              onChange={e => { setCaseId(e.target.value); setError(null) }}
              className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors appearance-none"
            >
              {caseOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Título</label>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); setError(null) }}
              placeholder="Presentar demanda, responder requerimiento..."
              className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white placeholder-[#555555] outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setError(null) }}
                className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Prioridad</label>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 px-2 py-2 rounded-lg text-[0.65rem] border transition-colors ${
                      priority === p
                        ? 'bg-[rgba(0,229,201,0.1)] border-[rgba(0,229,201,0.3)] text-[#00E5C9]'
                        : 'bg-[#1C1B1B] border-[rgba(255,255,255,0.08)] text-[#999999] hover:text-white'
                    }`}
                  >
                    {p === 'low' ? 'Baja' : p === 'medium' ? 'Media' : 'Alta'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
              <p className="text-[0.65rem] text-[#ef4444]">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[0.75rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.04)] transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[linear-gradient(135deg,#00E5C9,#DCB263)] text-[#131313] text-[0.75rem] font-medium hover:shadow-[0_0_12px_rgba(0,229,201,0.15)] transition-all">{initial ? 'Guardar' : 'Crear plazo'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
