import { useState, useMemo, useEffect } from 'react'
import { PROMPT_TEMPLATES, CATEGORIES, CATEGORY_ICONS, type PromptTemplate } from '../lib/prompts'
import TemplateForm from './TemplateForm'
import { t } from '../lib/i18n'
import type { Lang } from '../lib/i18n'

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (template: PromptTemplate, composedPrompt?: string) => void
  lang?: Lang
}

const FAV_KEY = 'solaria-fav-templates'
const RECENT_KEY = 'solaria-recent-templates'

function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveIds(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)) } catch {}
}

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function TemplateCard({ template, fav, onFav, onUse }: {
  template: PromptTemplate
  fav: boolean
  onFav: (id: string) => void
  onUse: (template: PromptTemplate) => void
}) {
  const icon = CATEGORY_ICONS[template.category] || CATEGORY_ICONS.Documentos

  return (
    <button
      onClick={() => onUse(template)}
      className="group w-full text-left p-3 rounded-xl bg-[#1C1B1B] border border-[rgba(255,255,255,0.06)] hover:bg-[#2A2A2A] hover:border-[rgba(255,255,255,0.1)] transition-all flex flex-col gap-2"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center text-[#999999] shrink-0 group-hover:text-[#E5E5E5] transition-colors" dangerouslySetInnerHTML={{ __html: icon }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.75rem] font-medium text-[#E5E5E5] truncate">{template.title}</span>
            {template.agentMode && (
              <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[rgba(0,229,201,0.08)] text-[0.55rem] text-[#E5E5E5]">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="8" cy="13" r="1.5" fill="currentColor"/><circle cx="16" cy="13" r="1.5" fill="currentColor"/></svg>
                {t('templates.agent', 'es')}
              </span>
            )}
          </div>
          <p className="text-[0.625rem] text-[#999999] mt-0.5 leading-[1.5] line-clamp-2">{template.description}</p>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onFav(template.id) }}
          className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${fav ? 'text-[#E5E5E5]' : 'text-[#4a4a4a] group-hover:text-[#999999]'} hover:bg-[rgba(255,255,255,0.06)]`}
          title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <StarIcon active={fav} />
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#999999]">{template.category}</span>
        {template.variables && template.variables.length > 0 && (
          <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#666666]">{t('templates.form', 'es')}</span>
        )}
      </div>
    </button>
  )
}

export default function TemplateSelector({ isOpen, onClose, onSelect, lang = 'es' }: TemplateSelectorProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [favorites, setFavorites] = useState<string[]>(() => loadIds(FAV_KEY))
  const [recent, setRecent] = useState<string[]>(() => loadIds(RECENT_KEY))
  const [activeTemplate, setActiveTemplate] = useState<PromptTemplate | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setCategory('All')
      setActiveTemplate(null)
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return PROMPT_TEMPLATES.filter(t => {
      if (category !== 'All' && t.category !== category) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords?.some(k => k.toLowerCase().includes(q))
      )
    })
  }, [query, category])

  if (!isOpen) return null

  const favTemplates = favorites
    .map(id => PROMPT_TEMPLATES.find(t => t.id === id))
    .filter((t): t is PromptTemplate => !!t)
  const recentTemplates = recent
    .map(id => PROMPT_TEMPLATES.find(t => t.id === id))
    .filter((t): t is PromptTemplate => !!t)
    .filter(t => !favTemplates.some(f => f.id === t.id))

  const handleUse = (template: PromptTemplate, composedPrompt?: string) => {
    setRecent(prev => {
      const next = [template.id, ...prev.filter(id => id !== template.id)].slice(0, 6)
      saveIds(RECENT_KEY, next)
      return next
    })
    onSelect(template, composedPrompt)
    if (composedPrompt || !template.variables) onClose()
  }

  const useTemplate = (tpl: PromptTemplate) => {
    if (tpl.variables && tpl.variables.length > 0) {
      setActiveTemplate(tpl)
    } else {
      handleUse(tpl)
    }
  }

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]
      saveIds(FAV_KEY, next)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[620px] h-[560px] max-h-[80vh] bg-[#1C1B1B] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden flex flex-col animate-[fadeIn_0.15s_ease-out] shadow-[0_24px_64px_rgba(0,0,0,0.5)]">        {activeTemplate?.variables && activeTemplate.variables.length > 0 ? (
          <TemplateForm
            template={activeTemplate}
            lang={lang}
            onCancel={() => setActiveTemplate(null)}
            onSubmit={(values) => {
              let composed = activeTemplate.prompt
              for (const v of activeTemplate.variables!) {
                composed = composed.split(`{${v.key}}`).join(values[v.key]?.trim() || '')
              }
              composed = composed.replace(/\n{3,}/g, '\n\n').trim()
              handleUse(activeTemplate, composed)
            }}
          />
        ) : (
          <>
            {/* Header + search */}
            <div className="px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[0.875rem] font-medium text-white flex-1">{t('chat.templates', lang)}</h2>
                <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white transition-colors" title={t('templates.cancel', lang)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0F0F0F] border border-[rgba(255,255,255,0.08)] focus-within:border-[rgba(255,255,255,0.2)] transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('templates.search', lang)}
                  className="flex-1 bg-transparent border-none outline-none text-[0.8125rem] text-white placeholder-[#555555]"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery('')} className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#666666] hover:text-white transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
              {/* Category chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {['All', ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-[0.625rem] font-medium transition-colors ${category === cat ? 'bg-[rgba(0,229,201,0.1)] text-white' : 'bg-[#2A2A2A] text-[#999999] hover:text-white'}`}
                  >
                    {cat === 'All' ? t('templates.all', lang) : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {favTemplates.length > 0 && query === '' && category === 'All' && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">{t('templates.favorites', lang)}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {favTemplates.map(tpl => (
                      <TemplateCard key={tpl.id} template={tpl} fav onFav={toggleFav} onUse={useTemplate} />
                    ))}
                  </div>
                </section>
              )}

              {recentTemplates.length > 0 && query === '' && category === 'All' && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">{t('templates.recent', lang)}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {recentTemplates.map(tpl => (
                      <TemplateCard key={tpl.id} template={tpl} fav={false} onFav={toggleFav} onUse={useTemplate} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">{category === 'All' ? t('templates.all', lang) : category}</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <p className="text-[0.6875rem] text-[#666666]">{t('templates.no_results', lang)}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filtered.map(tpl => (
                      <TemplateCard key={tpl.id} template={tpl} fav={favorites.includes(tpl.id)} onFav={toggleFav} onUse={useTemplate} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
