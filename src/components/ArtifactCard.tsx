import { useState } from 'react'
import Markdown from '../lib/Markdown'

interface ArtifactCardProps {
  title: string
  content: string
  date?: string
}

export default function ArtifactCard({ title, content, date }: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const previewLines = content.split('\n').slice(0, 8).join('\n')
  const isLong = content.split('\n').length > 8

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = title.endsWith('.md') ? title : `${title}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-[#0F0F0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 my-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[rgba(0,229,201,0.08)] border border-[rgba(0,229,201,0.15)] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5C9" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="14" y2="17"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[0.75rem] font-medium text-[#E5E5E5] truncate" title={title}>{title}</div>
            {date && <div className="text-[0.55rem] text-[#666666]">{date}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.6rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            .md
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        <div className={`overflow-hidden ${expanded ? '' : 'max-h-[220px]'}`}>
          <Markdown content={expanded ? content : previewLines} />
        </div>
        {!expanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-[linear-gradient(to_top,#0F0F0F,transparent)]" />
        )}
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
