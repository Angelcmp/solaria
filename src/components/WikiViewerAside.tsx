import { useState, useEffect, useCallback, useRef } from 'react'
import Markdown from '../lib/Markdown'

export interface WikiFile {
  name: string
  path: string
  size: number
  modified: number
}

interface WikiViewerAsideProps {
  file: WikiFile
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  open?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function displayName(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

function Spinner() {
  return (
    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

export default function WikiViewerAside({ file, onClose, onPrev, onNext, hasPrev, hasNext, open = true }: WikiViewerAsideProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (path: string) => {
    setContent(null)
    setLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const text = await invoke<string>('wiki_read_file', { path })
      setContent(text)
    } catch (e) {
      setContent(`Error leyendo archivo: ${e}`)
    }
    setLoading(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    load(file.path)
  }, [file.path, load])

  return (
    <div
      className="flex bg-[#1A1A1A] border-l border-[rgba(255,255,255,0.04)] shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: open ? 600 : 0 }}
      aria-hidden={!open}
    >
      <div className="flex flex-col w-[600px] shrink-0 min-h-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)]">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white transition-colors shrink-0"
          title="Cerrar vista"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[0.75rem] font-semibold text-white truncate">{displayName(file.name)}</div>
          <div className="text-[0.5rem] text-[#666666] font-mono truncate" title={file.path}>{file.path}</div>
        </div>
        <span className="text-[0.5rem] text-[#555555] font-mono shrink-0">{formatSize(file.size)}</span>
        {(onPrev || onNext) && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Anterior"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Siguiente"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Spinner />
            <span className="text-[0.65rem] text-[#999999]">Cargando archivo...</span>
          </div>
        ) : content ? (
          <Markdown content={content} />
        ) : null}
      </div>
      </div>
    </div>
  )
}
