import { useState } from 'react'
import type { PromptTemplate, TemplateVariable } from '../lib/prompts'
import { t } from '../lib/i18n'
import type { Lang } from '../lib/i18n'

interface TemplateFormProps {
  template: PromptTemplate
  lang?: Lang
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
}

const inputCls = 'w-full bg-[#0F0F0F] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-[0.8125rem] text-[#E5E5E5] placeholder-[#555555] outline-none focus:border-[rgba(255,255,255,0.2)] transition-colors'

function Field({ v, value, onChange }: {
  v: TemplateVariable
  value: string
  onChange: (key: string, value: string) => void
}) {
  const cls = inputCls + (v.required && !value.trim() ? ' border-[rgba(239,68,68,0.4)]' : '')

  if (v.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(v.key, e.target.value)}
        placeholder={v.placeholder}
        rows={3}
        className={cls + ' resize-y min-h-[70px]'}
      />
    )
  }

  if (v.type === 'select') {
    return (
      <select
        value={value}
        onChange={e => onChange(v.key, e.target.value)}
        className={cls + ' appearance-none'}
      >
        <option value="" disabled>{v.placeholder || 'Seleccionar...'}</option>
        {v.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      type={v.type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={e => onChange(v.key, e.target.value)}
      placeholder={v.placeholder}
      className={cls}
    />
  )
}

export default function TemplateForm({ template, lang = 'es', onSubmit, onCancel }: TemplateFormProps) {
  const initial: Record<string, string> = {}
  for (const v of template.variables ?? []) {
    initial[v.key] = v.type === 'select' && v.options?.[0] ? v.options[0] : ''
  }
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState(false)

  const missing = (template.variables ?? [])
    .filter(v => v.required && !values[v.key]?.trim())
    .map(v => v.label)

  const handleSubmit = () => {
    if (missing.length > 0) {
      setTouched(true)
      return
    }
    onSubmit(values)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
        <button onClick={onCancel} className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[#999999] hover:text-white transition-colors" title={t('templates.cancel', lang)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-[0.875rem] font-medium text-white truncate">{template.title}</h3>
          <p className="text-[0.625rem] text-[#999999] truncate">{template.description}</p>
        </div>
        {template.agentMode && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[rgba(0,229,201,0.08)] text-[0.6rem] font-medium text-[#E5E5E5]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="8" cy="13" r="1.5" fill="currentColor"/><circle cx="16" cy="13" r="1.5" fill="currentColor"/><path d="M12 3v3M12 16v3"/></svg>
            {t('templates.agent', lang)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {(template.variables ?? []).map(v => (
          <div key={v.key}>
            <label className="flex items-center gap-1 mb-1.5 text-[0.6875rem] font-medium text-[#999999]">
              {v.label}
              {v.required && <span className="text-[#ef4444]">*</span>}
            </label>
            <Field v={v} value={values[v.key] || ''} onChange={(k, val) => { setValues(p => ({ ...p, [k]: val })); setTouched(true) }} />
          </div>
        ))}
        {touched && missing.length > 0 && (
          <div className="px-3 py-2 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] text-[0.65rem] text-[#ef4444]">
            {t('templates.required', lang)}: {missing.join(', ')}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
        <button onClick={onCancel} className="px-3 h-8 rounded-lg text-[0.6875rem] text-[#999999] hover:text-white hover:bg-[rgba(255,255,255,0.04)] transition-colors">
          {t('templates.cancel', lang)}
        </button>
        <button onClick={handleSubmit} className="flex items-center gap-1.5 px-4 h-8 rounded-lg text-[0.6875rem] font-medium text-[#131313] bg-[linear-gradient(135deg,#00E5C9,#DCB263)] hover:opacity-90 transition-opacity">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          {t('templates.generate', lang)}
        </button>
      </div>
    </div>
  )
}
