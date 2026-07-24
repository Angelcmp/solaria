import { useState, useCallback, useContext, createContext } from 'react'
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
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import go from 'highlight.js/lib/languages/go'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

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
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c++', cpp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('golang', go)
hljs.registerLanguage('php', php)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rb', ruby)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('kt', kotlin)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('docker', dockerfile)

const MarkdownContext = createContext({ isRunning: false })

function normalizeMarkdown(content: string): string {
  return content
    // Opening fence at start of line must be followed by a newline
    .replace(/^(```[a-zA-Z0-9]*)(?!\n)/gm, '$1\n')
    // Opening fence inline with no following newline: split before and after it
    .replace(/([^\n])(```[a-zA-Z0-9]*)(?!\n)/g, '$1\n$2\n')
    // Opening fence inline with following newline: move it to its own line
    .replace(/([^\n])(```[a-zA-Z0-9]*\n)/g, '$1\n$2')
    // Closing fence must be on its own line
    .replace(/([^\n])(```)(\n|$)/gm, '$1\n$2$3')
    // Trim excessive blank lines to at most two
    .replace(/\n{4,}/g, '\n\n\n')
}

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
  const rawCode = extractText(children).replace(/\n$/, '')
  const lines = rawCode.split('\n')
  const showLineNumbers = lines.length > 1

  let highlighted = escapeHtml(rawCode)
  if (lang && hljs.getLanguage(lang)) {
    highlighted = hljs.highlight(rawCode, { language: lang }).value
  }

  return (
    <div className={`hl-block relative group my-3 ${showLineNumbers ? '' : 'hl-block-single'}`}>
      <div className="hl-block-header">
        <span className="flex items-center gap-1.5 text-[0.6rem] text-[#888888] font-mono uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DCB263]" />
          {lang || 'text'}
        </span>
        <CopyButton code={rawCode} />
      </div>
      <div className="flex">
        {showLineNumbers && (
          <div className="hl-line-numbers pt-4 pb-4" aria-hidden="true">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}
        <pre className="!m-0 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
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
      className="relative pl-8 pr-3 py-2 my-3 text-[0.8125rem] text-[#b0b0b0] border-l-2 border-[#00E5C9] bg-[rgba(0,229,201,0.03)] rounded-r-lg"
      style={{ fontWeight: 300 }}
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
  const hasCheckbox = Array.isArray(children) && children.some(
    (c: any) => c?.type === 'input' || c?.props?.type === 'checkbox'
  )
  return (
    <li className={`leading-[1.7] my-1 ${hasCheckbox ? 'task-list-item' : ''}`} style={{ fontWeight: 300 }} {...props}>
      {children}
    </li>
  )
}

/* ════════════════════════════════
   INPUT (task list checkbox)
   ════════════════════════════════ */
function Input({ checked }: { checked?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border mr-2 align-middle ${
        checked
          ? 'bg-[#00E5C9] border-[#00E5C9]'
          : 'bg-transparent border-[rgba(255,255,255,0.25)]'
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#131313" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  )
}

/* ════════════════════════════════
   HEADINGS
   ════════════════════════════════ */
function H1({ children, ...props }: any) {
  return (
    <h1
      className="text-[1.25rem] font-medium text-[#DCB263] mt-6 mb-3 pb-1 border-b border-[rgba(220,178,99,0.15)]"
      style={{ letterSpacing: '0.01em', lineHeight: '1.3' }}
      {...props}
    >
      {children}
    </h1>
  )
}

function H2({ children, ...props }: any) {
  return (
    <h2
      className="text-[1rem] font-medium text-[#E5E5E5] mt-5 mb-2"
      style={{ letterSpacing: '0.01em', lineHeight: '1.35' }}
      {...props}
    >
      {children}
    </h2>
  )
}

function H3({ children, ...props }: any) {
  return (
    <h3
      className="text-[0.875rem] font-medium text-[#999999] mt-4 mb-2"
      style={{ letterSpacing: '0.01em', lineHeight: '1.4' }}
      {...props}
    >
      {children}
    </h3>
  )
}

function H4({ children, ...props }: any) {
  return (
    <h4
      className="text-[0.8125rem] font-medium text-[#E5E5E5] mt-3 mb-1.5"
      style={{ letterSpacing: '0.01em', lineHeight: '1.4' }}
      {...props}
    >
      {children}
    </h4>
  )
}

function H5({ children, ...props }: any) {
  return (
    <h5
      className="text-[0.75rem] font-medium text-[#999999] mt-3 mb-1.5 uppercase tracking-wider"
      style={{ lineHeight: '1.4' }}
      {...props}
    >
      {children}
    </h5>
  )
}

function H6({ children, ...props }: any) {
  return (
    <h6
      className="text-[0.75rem] font-normal text-[#666666] mt-3 mb-1.5"
      style={{ lineHeight: '1.4' }}
      {...props}
    >
      {children}
    </h6>
  )
}

/* ════════════════════════════════
   PARAGRAPH (with agent-step detection)
   ════════════════════════════════ */
function P({ children, ...props }: any) {
  return (
    <p
      className="my-3 leading-[1.7]"
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
  const { isRunning } = useContext(MarkdownContext)
  if (text.startsWith('→ ')) {
    if (isRunning) {
      return <span className="sr-only">tool step</span>
    }
    const clean = text.slice(2)
    const isFetch = clean.startsWith('fetch_url')
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
        }}
      >
        → {clean}
      </span>
    )
  }
  return (
    <em
      className="text-[#999999] not-italic"
      style={{ fontWeight: 300 }}
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
    <div className="overflow-x-auto my-3 rounded-lg border border-[rgba(255,255,255,0.08)]">
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
    <thead className="bg-[rgba(255,255,255,0.05)]" {...props}>
      {children}
    </thead>
  )
}

function Tbody({ children, ...props }: any) {
  return <tbody {...props}>{children}</tbody>
}

function Tr({ children, ...props }: any) {
  return (
    <tr className="transition-colors hover:bg-[rgba(255,255,255,0.03)]" {...props}>
      {children}
    </tr>
  )
}

function Th({ children, ...props }: any) {
  return (
    <th
      className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2 text-left font-medium text-[#DCB263]"
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
      className="border-b border-[rgba(255,255,255,0.06)] px-3 py-2"
      style={{ fontWeight: 300, letterSpacing: '0.01em' }}
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
  isRunning?: boolean
}

export default function Markdown({ content, compact, isRunning = false }: MarkdownProps) {
  const normalized = normalizeMarkdown(content)
  return (
    <MarkdownContext.Provider value={{ isRunning }}>
      <div
        className={`markdown-body ${compact ? 'text-[0.75rem]' : 'text-[0.875rem]'} text-[#E5E5E5] ${compact ? 'markdown-compact' : ''}`}
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
            h4: H4,
            h5: H5,
            h6: H6,
            p: P,
            em: Em,
            strong: Strong,
            a: A,
            table: Table,
            thead: Thead,
            tbody: Tbody,
            tr: Tr,
            th: Th,
            td: Td,
            hr: Hr,
            img: Img,
            del: Del,
            input: Input,
          }}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    </MarkdownContext.Provider>
  )
}
