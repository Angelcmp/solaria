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

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="hl-inline">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, text: string, url: string) =>
      `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer" class="text-[#00E5C9] hover:underline">${text}</a>`
    )
}

function renderTable(lines: string[]): string {
  if (lines.length < 2) return lines.join('\n')
  const align = lines[1]
  if (!align || !align.includes('---')) return lines.join('\n')

  const headers = lines[0].split('|').filter(c => c.trim()).map(c => c.trim())
  const rows = lines.slice(1).filter((_, i) => i > 0)

  let html = '<div class="overflow-x-auto my-2"><table class="w-full text-[0.75rem] border-collapse">'
  html += '<thead><tr>'
  for (const h of headers) {
    html += `<th class="border border-[rgba(255,255,255,0.1)] px-2 py-1 text-left font-semibold text-[#DCB263]">${renderInline(escapeHtml(h))}</th>`
  }
  html += '</tr></thead><tbody>'

  for (const row of rows) {
    if (row.includes('---')) continue
    const cols = row.split('|').filter(c => c.trim()).map(c => c.trim())
    if (cols.length === 0) continue
    html += '<tr>'
    for (const c of cols) {
      html += `<td class="border border-[rgba(255,255,255,0.1)] px-2 py-1">${renderInline(escapeHtml(c))}</td>`
    }
    html += '</tr>'
  }

  html += '</tbody></table></div>'
  return html
}

function renderList(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inUl = false

  for (const line of lines) {
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)/)
    if (listMatch) {
      if (!inUl) { result.push('<ul class="list-disc pl-5 my-1 space-y-0.5">'); inUl = true }
      result.push(`<li>${renderInline(escapeHtml(listMatch[2]))}</li>`)
    } else {
      if (inUl) { result.push('</ul>'); inUl = false }
      result.push(line)
    }
  }
  if (inUl) result.push('</ul>')
  return result.join('\n')
}

interface MarkdownProps {
  content: string
  compact?: boolean
}

export default function Markdown({ content, compact }: MarkdownProps) {
  const blocks = content.split(/(```[\s\S]*?```)/g)
  const htmlParts: string[] = []

  for (const block of blocks) {
    const codeMatch = block.match(/^```(\w*)\n([\s\S]*?)```$/)
    if (codeMatch) {
      const lang = codeMatch[1]
      const highlighted = highlightCode(codeMatch[2], lang)
      const langLabel = lang ? `<span class="text-[0.625rem] text-[#666666] font-mono absolute top-1 right-2">${escapeHtml(lang)}</span>` : ''
      htmlParts.push(
        `<div class="hl-block relative">${langLabel}<pre><code>${highlighted}</code></pre></div>`
      )
    } else {
      const paragraphs = block.split('\n\n')
      for (const para of paragraphs) {
        if (!para.trim()) continue

        const tableLines = para.split('\n')
        const isTable = tableLines.some(l => l.includes('|')) && tableLines.length >= 2

        if (isTable) {
          htmlParts.push(renderTable(tableLines))
        } else if (para.startsWith('#')) {
          const match = para.match(/^(#{1,3})\s+(.+)/)
          if (match) {
            const level = match[1].length
            const size = level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs'
            htmlParts.push(
              `<h${level} class="${size} font-bold text-white mt-2 mb-1">${renderInline(escapeHtml(match[2]))}</h${level}>`
            )
          }
        } else {
          const withLists = renderList(para)
          const withInline = withLists
            .split('\n')
            .map(l => l.trim())
            .filter(l => l)
            .map(l => {
              if (l.startsWith('<')) return l
              if (l.startsWith('---')) return `<hr class="border-[rgba(255,255,255,0.08)] my-2" />`
              return `<p class="my-1 leading-[1.6]">${renderInline(escapeHtml(l))}</p>`
            })
            .join('\n')
          htmlParts.push(withInline)
        }
      }
    }
  }

  return (
    <div
      className={`markdown-body ${compact ? 'text-[0.75rem]' : 'text-[0.875rem]'} leading-[1.6] text-[#E5E5E5]`}
      dangerouslySetInnerHTML={{ __html: htmlParts.join('\n') }}
    />
  )
}
