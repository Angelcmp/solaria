import { useState, useEffect, useRef } from 'react'

export interface ProjectModalData {
  id?: string
  name: string
  path: string
}

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project?: ProjectModalData | null
  onSave: (project: ProjectModalData) => void
}

export default function ProjectModal({ isOpen, onClose, project, onSave }: ProjectModalProps) {
  const isEdit = !!project?.id
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(project?.name || '')
      setPath(project?.path || '')
      setError(null)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, project])

  const handleSelectFolder = async () => {
    try {
      setError(null)
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: isEdit ? 'Cambiar carpeta del proyecto' : 'Seleccionar carpeta del proyecto'
      })
      if (selected) setPath(selected as string)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Ingresa un nombre para el proyecto'); return }
    if (!path.trim()) { setError('Selecciona una carpeta'); return }
    setLoading(true)
    onSave({ id: project?.id, name: name.trim(), path })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-[420px] bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h3 className="text-[0.9rem] font-medium text-[#E5E5E5]">{isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</h3>
            <p className="text-[0.65rem] text-[#666666] mt-0.5">{isEdit ? 'Actualiza el nombre o la carpeta de trabajo' : 'Asigna un nombre y selecciona la carpeta de trabajo'}</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Nombre</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder="Mi proyecto"
              className="w-full px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.8rem] text-white placeholder-[#555555] outline-none focus:border-[rgba(0,229,201,0.4)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[#999999] mb-1.5">Carpeta</label>
            <div className="flex items-center gap-2">
              <div className={`flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] text-[0.75rem] truncate ${path ? 'text-[#E5E5E5]' : 'text-[#555555]'}`}>
                {path || 'Ninguna carpeta seleccionada'}
              </div>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] text-[#00E5C9] text-[0.7rem] hover:bg-[rgba(0,229,201,0.12)] transition-colors whitespace-nowrap"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Seleccionar
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
              <p className="text-[0.65rem] text-[#ef4444]">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[0.75rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[linear-gradient(135deg,#00E5C9,#DCB263)] text-[#131313] text-[0.75rem] font-medium hover:shadow-[0_0_12px_rgba(0,229,201,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isEdit ? 'Guardando...' : 'Creando...') : (isEdit ? 'Guardar cambios' : 'Crear proyecto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
