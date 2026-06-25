import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js/lib/core'

import python from 'highlight.js/lib/languages/python'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import rust from 'highlight.js/lib/languages/rust'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'

hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('rs', rust)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

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

function extractText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const n = node as { props?: { children?: unknown } }
    return extractText(n.props?.children)
  }
  return ''
}

/* ════════════════════════════════
   COPY BUTTON
   ════════════════════════════════ */
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  return (
    <button
      onClick={handleCopy}
      className="px-2 py-0.5 rounded text-[0.55rem] text-[#999999] bg-[#2A2A2A] hover:bg-[#353535] hover:text-white border border-[rgba(255,255,255,0.08)] transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? '✓' : 'Copiar'}
    </button>
  )
}

/* ════════════════════════════════
   CODE BLOCK
   ════════════════════════════════ */
function Code({ inline, className, children, ...props }: any) {
  if (inline) {
    return (
      <code className="hl-inline" {...props}>
        {children}
      </code>
    )
  }

  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : ''
  const rawCode = String(children).replace(/\n$/, '')

  let highlighted = escapeHtml(rawCode)
  if (lang && hljs.getLanguage(lang)) {
    highlighted = hljs.highlight(rawCode, { language: lang }).value
  }

  return (
    <div className="hl-block relative group my-3">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.2)]">
        <span className="text-[0.625rem] text-[#666666] font-mono uppercase tracking-wider">
          {lang || 'text'}
        </span>
        <CopyButton code={rawCode} />
      </div>
      <pre className="!m-0 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

/* Passthrough <pre> so we don't double-wrap */
function Pre({ children }: any) {
  return <>{children}</>
}

/* ════════════════════════════════
   BLOCKQUOTE
   ════════════════════════════════ */
function Blockquote({ children, ...props }: any) {
  return (
    <blockquote
      className="pl-3 my-3 text-[0.8125rem] text-[#b0b0b0] border-l-2 border-[#00E5C9] bg-[rgba(0,229,201,0.03)] rounded-r-lg py-2 pr-3"
      style={{ fontWeight: 350 }}
      {...props}
    >
      {children}
    </blockquote>
  )
}

/* ════════════════════════════════
   LISTS
   ════════════════════════════════ */
function Ol({ children, ...props }: any) {
  return (
    <ol className="list-decimal pl-5 my-2 space-y-1" {...props}>
      {children}
    </ol>
  )
}

function Ul({ children, ...props }: any) {
  return (
    <ul className="list-disc pl-5 my-2 space-y-1" {...props}>
      {children}
    </ul>
  )
}

function Li({ children, ...props }: any) {
  return (
    <li className="leading-[1.7]" style={{ fontWeight: 300 }} {...props}>
      {children}
    </li>
  )
}

/* ════════════════════════════════
   HEADINGS
   ════════════════════════════════ */
function H1({ children, ...props }: any) {
  return (
    <h1
      className="text-[1.0625rem] font-medium text-white mt-5 mb-3"
      style={{ letterSpacing: '0.01em' }}
      {...props}
    >
      {children}
    </h1>
  )
}

function H2({ children, ...props }: any) {
  return (
    <h2
      className="text-[0.875rem] font-medium text-white mt-4 mb-2"
      style={{ letterSpacing: '0.01em' }}
      {...props}
    >
      {children}
    </h2>
  )
}

function H3({ children, ...props }: any) {
  return (
    <h3
      className="text-[0.8125rem] font-normal text-white mt-3 mb-2"
      style={{ letterSpacing: '0.01em' }}
      {...props}
    >
      {children}
    </h3>
  )
}

/* ════════════════════════════════
   PARAGRAPH (with agent-step detection)
   ════════════════════════════════ */
function P({ children, ...props }: any) {
  return (
    <p
      className="my-2 leading-[1.8]"
      style={{ fontWeight: 300, letterSpacing: '0.015em' }}
      {...props}
    >
      {children}
    </p>
  )
}

/* ════════════════════════════════
   EMPHASIS (agent step chips)
   ════════════════════════════════ */
function Em({ children, ...props }: any) {
  const text = extractText(children)
  if (text.startsWith('→ ')) {
    const clean = text.slice(2)
    const isFetch = clean.startsWith('fetch_url')
    const glowAnim = isFetch ? 'stepGlowTeal' : 'stepGlow'
    const borderColor = isFetch ? 'rgba(0,229,201,0.15)' : 'rgba(220,178,99,0.2)'
    const bgColor = isFetch ? 'rgba(0,229,201,0.03)' : 'rgba(220,178,99,0.03)'
    const textColor = isFetch ? '#00E5C9' : '#DCB263'
    return (
      <span
        className="inline-block my-0.5 px-2 py-0.5 rounded border text-[0.65rem] align-middle"
        style={{
          borderColor,
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: '0.02em',
          animation: `${glowAnim} 1.5s ease-in-out forwards`,
        }}
      >
        → {clean}
      </span>
    )
  }
  return (
    <em
      className="text-[#999999] not-italic"
      style={{ fontWeight: 350 }}
      {...props}
    >
      {children}
    </em>
  )
}

/* ════════════════════════════════
   STRONG
   ════════════════════════════════ */
function Strong({ children, ...props }: any) {
  return (
    <strong
      className="text-white"
      style={{ fontWeight: 500 }}
      {...props}
    >
      {children}
    </strong>
  )
}

/* ════════════════════════════════
   LINK
   ════════════════════════════════ */
function A({ children, href, ...props }: any) {
  return (
    <a
      href={sanitizeUrl(href || '#')}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#00E5C9] hover:underline break-all"
      {...props}
    >
      {children}
    </a>
  )
}

/* ════════════════════════════════
   TABLE
   ════════════════════════════════ */
function Table({ children, ...props }: any) {
  return (
    <div className="overflow-x-auto my-3">
      <table
        className="w-full text-[0.75rem] border-collapse"
        style={{
          fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif",
          letterSpacing: '0.01em',
        }}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

function Thead({ children, ...props }: any) {
  return (
    <thead className="bg-[rgba(255,255,255,0.04)]" {...props}>
      {children}
    </thead>
  )
}

function Th({ children, ...props }: any) {
  return (
    <th
      className="border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-left font-medium text-[#DCB263]"
      style={{ fontWeight: 450, letterSpacing: '0.02em' }}
      {...props}
    >
      {children}
    </th>
  )
}

function Td({ children, ...props }: any) {
  return (
    <td
      className="border border-[rgba(255,255,255,0.1)] px-3 py-1.5"
      style={{ fontWeight: 350, letterSpacing: '0.01em' }}
      {...props}
    >
      {children}
    </td>
  )
}

/* ════════════════════════════════
   HR
   ════════════════════════════════ */
function Hr({ ...props }: any) {
  return <hr className="border-[rgba(255,255,255,0.08)] my-4" {...props} />
}

/* ════════════════════════════════
   IMAGE
   ════════════════════════════════ */
function Img({ src, alt, ...props }: any) {
  return (
    <img
      src={sanitizeUrl(src || '#')}
      alt={alt || ''}
      className="max-w-full h-auto rounded-lg my-3 border border-[rgba(255,255,255,0.06)]"
      {...props}
    />
  )
}

/* ════════════════════════════════
   DEL (strikethrough via GFM)
   ════════════════════════════════ */
function Del({ children, ...props }: any) {
  return (
    <del className="text-[#666666] line-through" {...props}>
      {children}
    </del>
  )
}

/* ════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════ */
interface MarkdownProps {
  content: string
  compact?: boolean
}

export default function Markdown({ content, compact }: MarkdownProps) {
  return (
    <div
      className={`markdown-body ${compact ? 'text-[0.75rem]' : 'text-[0.8125rem]'} text-[#E5E5E5]`}
      style={{
        fontFamily: "'IBM Plex Sans', 'Inter', system-ui, sans-serif",
        fontWeight: 300,
        letterSpacing: '0.015em',
        lineHeight: '1.7',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: Pre,
          code: Code,
          blockquote: Blockquote,
          ol: Ol,
          ul: Ul,
          li: Li,
          h1: H1,
          h2: H2,
          h3: H3,
          p: P,
          em: Em,
          strong: Strong,
          a: A,
          table: Table,
          thead: Thead,
          th: Th,
          td: Td,
          hr: Hr,
          img: Img,
          del: Del,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
