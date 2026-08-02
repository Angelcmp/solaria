import { useState } from 'react'
import Markdown from '../lib/Markdown'

interface ArtifactCardProps {
  title: string
  content: string
  filePath?: string
}

const EXTENSIONS = ['md', 'txt', 'json', 'csv', 'tsx', 'ts', 'js', 'jsx', 'html', 'css', 'py', 'rs', 'yaml', 'yml', 'toml', 'xml']

function getFormat(filePath?: string): string {
  if (!filePath) return 'md'
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return EXTENSIONS.includes(ext) ? ext : 'md'
}

export default function ArtifactCard({ title, content, filePath }: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  const previewLines = content.split('\n').slice(0, 8).join('\n')
  const isLong = content.split('\n').length > 8
  const format = getFormat(filePath)

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const handleSaveAs = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { invoke } = await import('@tauri-apps/api/core')
      const base = (title.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'archivo')
      const path = await save({
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
        defaultPath: `${base}.${format}`,
      })
      if (!path) return
      await invoke('write_text_file', { path, content })
    } catch {}
    setOpenMenu(false)
  }

  const handleOpenInApp = async () => {
    if (!filePath) { setOpenMenu(false); return }
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      setOpening('system')
      await openPath(filePath)
    } catch {}
    setOpening(null)
    setOpenMenu(false)
  }

  return (
    <div className="bg-[#131313] rounded-xl p-4 my-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0F0F0F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9C9C9" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="14" y2="17"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[0.75rem] font-medium text-[#E5E5E5] truncate" title={title}>{title}</div>
            {filePath && <div className="text-[0.55rem] text-[#666666] truncate" title={filePath}>{filePath}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="px-1.5 py-0.5 rounded-md bg-[#0F0F0F] border border-[rgba(255,255,255,0.06)] text-[0.6rem] font-mono text-[#999999]">
            {format}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={handleSaveAs}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .{format}
          </button>
          <div className="relative">
            <button
              onClick={() => setOpenMenu(!openMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] transition-colors"
            >
              Abrir en
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {openMenu && (
              <div className="absolute right-0 top-7 w-44 bg-[#1C1B1B] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl overflow-hidden animate-[fadeIn_0.1s_ease] z-50">
                <button
                  onClick={() => { setExpanded(true); setOpenMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                  En este chat
                </button>
                <button
                  onClick={handleOpenInApp}
                  disabled={!filePath || opening === 'system'}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  {opening === 'system' ? 'Abriendo...' : 'Con la app del sistema'}
                </button>
                <button
                  onClick={handleSaveAs}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[0.6875rem] text-[#E5E5E5] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Guardar como…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        <div className={`overflow-hidden ${expanded ? '' : 'max-h-[220px]'}`}>
          <Markdown content={expanded ? content : previewLines} />
        </div>
      </div>

      {/* Footer */}
      {isLong && (
        <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[0.65rem] text-[#00E5C9] hover:text-[#FACD7B] transition-colors font-medium"
          >
            {expanded ? 'Ver resumen' : 'Ver completo'}
          </button>
        </div>
      )}
    </div>
  )
}
