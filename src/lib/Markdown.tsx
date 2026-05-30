function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function sanitizeUrl(url: string): string {
  const allowed = ['http://', 'https://', 'mailto:', '#']
  for (const prefix of allowed) {
    if (url.toLowerCase().startsWith(prefix)) return url
  }
  return '#'
}

const KEYWORDS = '\\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|implements|interface|type|enum|import|export|from|default|async|await|yield|throw|try|catch|finally|this|super|true|false|null|undefined|void|static|private|protected|public|readonly|abstract|as|satisfies|using|await using|module|namespace|declare|global)\\b'

function highlightCode(code: string, lang: string): string {
  const escaped = escapeHtml(code)

  if (!lang) return escaped

  const patterns: { lang: string; fn: (s: string) => string }[] = [
    { lang: 'bash', fn: h => h.replace(/^# .+/gm, '<span class="hl-comment">$&</span>') },
    { lang: 'json', fn: h => h
      .replace(/"([^"]+)":/g, '<span class="hl-attr">"$1"</span>:')
      .replace(/"([^"]+)"(?=\s*[,\]}])/g, '<span class="hl-string">"$1"</span>')
    },
    { lang: 'rust', fn: h => applyGenericHighlight(h) },
    { lang: 'typescript', fn: h => applyGenericHighlight(h) },
    { lang: 'tsx', fn: h => applyGenericHighlight(h) },
    { lang: 'ts', fn: h => applyGenericHighlight(h) },
    { lang: 'javascript', fn: h => applyGenericHighlight(h) },
    { lang: 'js', fn: h => applyGenericHighlight(h) },
    { lang: 'jsx', fn: h => applyGenericHighlight(h) },
    { lang: 'python', fn: h => applyPythonHighlight(h) },
    { lang: 'py', fn: h => applyPythonHighlight(h) },
  ]

  const match = patterns.find(p => p.lang === lang.toLowerCase())
  if (match) return match.fn(escaped)
  return applyGenericHighlight(escaped)
}

function applyGenericHighlight(code: string): string {
  return code
    .replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    .replace(new RegExp(`(${KEYWORDS})`, 'g'), '<span class="hl-keyword">$1</span>')
    .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="hl-string">$&</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>')
    .replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>')
}

function applyPythonHighlight(code: string): string {
  return code
    .replace(/(#[^\n]*)/g, '<span class="hl-comment">$1</span>')
    .replace(new RegExp(`(${KEYWORDS.replace('\\bconst\\b|', '').replace('\\blet\\b|', '').replace('\\bvar\\b|', '')})`, 'g'), '<span class="hl-keyword">$1</span>')
    .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="hl-string">$&</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>')
}

function autolink(text: string): string {
  return text.replace(
    /(?<!\]\()(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#00E5C9] hover:underline break-all">$1</a>'
  )
}

function renderInline(text: string): string {
  let result = autolink(text)
  result = result
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white" style="font-weight:500">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-[#999999] not-italic" style="font-weight:350">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="hl-inline">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, text: string, url: string) =>
      `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-[#00E5C9] hover:underline">${text}</a>`
    )
  return result
}

function renderTable(block: string): string {
  const lines = block.split('\n').filter(l => l.trim())
  if (lines.length < 2) return escapeHtml(block)

  const separatorIdx = lines.findIndex(l => /^\|?\s*[-|]+\s*\|?\s*$/.test(l))
  if (separatorIdx < 0) {
    // Not a real table, render as heading body if starts with #
    const hm = lines[0].match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const level = hm[1].length
      const size = level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs'
      return `<h${level} class="${size} font-medium text-white mt-4 mb-2" style="letter-spacing:0.01em">${renderInline(escapeHtml(hm[2]))}</h${level}>`
    }
    return escapeHtml(block)
  }

  const beforeSep = lines.slice(0, separatorIdx)
  const afterSep = lines.slice(separatorIdx + 1)

  let html = ''

  // Render heading lines before the separator
  for (const line of beforeSep) {
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const level = hm[1].length
      const size = level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs'
      const title = hm[2].split('|')[0].trim()
      html += `<h${level} class="${size} font-medium text-white mt-4 mb-2" style="letter-spacing:0.01em">${renderInline(escapeHtml(title))}</h${level}>`
    }
  }

  // Extract table headers from the last line before separator
  let headers: string[] = []
  const lastBefore = beforeSep[beforeSep.length - 1]
  if (lastBefore) {
    const hm = lastBefore.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      headers = hm[2].split('|').slice(1).map(s => s.trim()).filter(Boolean)
    } else {
      headers = lastBefore.split('|').filter(c => c.trim()).map(c => c.trim())
    }
  }

  if (headers.length === 0) return html

  html += '<div class="overflow-x-auto my-3"><table class="w-full text-[0.75rem] border-collapse" style="font-family:\'IBM Plex Sans\',\'Inter\',system-ui,sans-serif;letter-spacing:0.01em">'
  html += '<thead><tr>'
  for (const h of headers) {
    html += `<th class="border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-left font-medium text-[#DCB263]" style="font-weight:450;letter-spacing:0.02em">${renderInline(escapeHtml(h))}</th>`
  }
  html += '</tr></thead><tbody>'

  for (const row of afterSep) {
    if (/^\|?\s*[-|]+\s*\|?\s*$/.test(row)) continue
    const cols = row.split('|').filter(c => c.trim()).map(c => c.trim())
    if (cols.length === 0) continue
    html += '<tr>'
    for (const c of cols) {
      html += `<td class="border border-[rgba(255,255,255,0.1)] px-3 py-1.5" style="font-weight:350;letter-spacing:0.01em">${renderInline(escapeHtml(c))}</td>`
    }
    html += '</tr>'
  }

  html += '</tbody></table></div>'
  return html
}

function renderBlockquote(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inBq = false

  for (const line of lines) {
    const bqMatch = line.match(/^>\s?(.+)/)
    if (bqMatch) {
      if (!inBq) { result.push('<blockquote class="pl-0 my-2 text-[0.75rem] text-[#b0b0b0]" style="font-weight:350">'); inBq = true }
      result.push(renderInline(escapeHtml(bqMatch[1])))
      result.push('<br/>')
    } else {
      if (inBq) { result.push('</blockquote>'); inBq = false }
      result.push(line)
    }
  }
  if (inBq) result.push('</blockquote>')
  return result.join('\n')
}

function renderList(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inUl = false

  for (const line of lines) {
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)/)
    if (listMatch) {
      if (!inUl) { result.push('<ul class="list-disc pl-5 my-2 space-y-1">'); inUl = true }
      result.push(`<li class="leading-[1.7]" style="font-weight:300">${renderInline(escapeHtml(listMatch[2]))}</li>`)
    } else {
      if (inUl) { result.push('</ul>'); inUl = false }
      result.push(line)
    }
  }
  if (inUl) result.push('</ul>')
  return result.join('\n')
}

import { useRef, useEffect } from 'react'

interface MarkdownProps {
  content: string
  compact?: boolean
}

export default function Markdown({ content, compact }: MarkdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.hl-copy-btn') as HTMLElement
      if (!btn) return
      const idx = btn.dataset.idx
      if (idx === undefined) return
      const blocks = content.split(/(```[\s\S]*?```)/g)
      let codeIdx = 0
      for (const block of blocks) {
        const match = block.match(/^```(\w*)\n([\s\S]*?)```$/)
        if (match) {
          if (codeIdx === parseInt(idx)) {
            navigator.clipboard.writeText(match[2]).then(() => {
              btn.textContent = '✓'
              setTimeout(() => { btn.textContent = 'Copiar' }, 1500)
            })
            return
          }
          codeIdx++
        }
      }
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [content])

  const blocks = content.split(/(```[\s\S]*?```)/g)
  const htmlParts: string[] = []
  let codeBlockIndex = 0

  for (const block of blocks) {
    const codeMatch = block.match(/^```(\w*)\n([\s\S]*?)```$/)
    if (codeMatch) {
      const lang = codeMatch[1]
      const highlighted = highlightCode(codeMatch[2], lang)
      const idx = codeBlockIndex++
      const langLabel = lang ? `<span class="text-[0.625rem] text-[#666666] font-mono absolute top-1 right-2">${escapeHtml(lang)}</span>` : ''
      htmlParts.push(
        `<div class="hl-block relative group">${langLabel}
          <button class="hl-copy-btn absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[0.55rem] text-[#999999] bg-[#2A2A2A] hover:bg-[#353535] hover:text-white border border-[rgba(255,255,255,0.08)]" data-idx="${idx}">Copiar</button>
          <pre><code>${highlighted}</code></pre>
        </div>`
      )
    } else {
      const paragraphs = block.split('\n\n')
      for (const para of paragraphs) {
        if (!para.trim()) continue

        const lines = para.split('\n').filter(l => l.trim())
        const separatorIdx = lines.findIndex(l => l.match(/^\|?\s*[-|]+\s*\|?\s*$/))
        const hasTable = separatorIdx >= 0 && lines.some((l, i) => l.includes('|') && i !== separatorIdx)

        if (hasTable) {
          htmlParts.push(renderTable(para))
        } else if (para.startsWith('#')) {
          const match = para.match(/^(#{1,3})\s+(.+)/)
            if (match) {
              const level = match[1].length
              const sizes = ['text-base', 'text-[0.8125rem]', 'text-[0.75rem]']
              const size = sizes[level - 1] || 'text-[0.6875rem]'
              const weights = ['font-medium', 'font-medium', 'font-normal']
              const weight = weights[level - 1] || 'font-medium'
              htmlParts.push(
                `<h${level} class="${size} ${weight} text-white mt-4 mb-2" style="letter-spacing:0.01em">${renderInline(escapeHtml(match[2]))}</h${level}>`
              )
            }
        } else {
          const withBlockquotes = renderBlockquote(para)
          const withLists = renderList(withBlockquotes)
          const withInline = withLists
            .split('\n')
            .map(l => l.trim())
            .filter(l => l)
            .map(l => {
              if (l.startsWith('<')) return l
              if (l.startsWith('---')) return `<hr class="border-[rgba(255,255,255,0.08)] my-4" />`
              if (/^\*→ .+ paso \d+\/\d+\*$/.test(l.trim())) {
                return `<p class="my-1 leading-[1.6] text-[0.7rem]" style="font-weight:300">${renderInline(escapeHtml(l))}</p>`
              }
              return `<p class="my-2 leading-[1.8]" style="font-weight:300;letter-spacing:0.015em">${renderInline(escapeHtml(l))}</p>`
            })
            .join('\n')
          htmlParts.push(withInline)
        }
      }
    }
  }

  return (
    <div
      className={`markdown-body ${compact ? 'text-[0.75rem]' : 'text-[0.875rem]'} text-[#E5E5E5]`}
      style={{ fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif", fontWeight: 300, letterSpacing: '0.015em', lineHeight: '1.75' }}
      dangerouslySetInnerHTML={{ __html: htmlParts.join('\n') }}
    />
  )
}
