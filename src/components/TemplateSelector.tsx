import { TEMPLATES, CATEGORIES, type Template } from '../lib/templates'
import { useState } from 'react'

interface TemplateSelectorProps {
  onSelect: (template: Template) => void
  isOpen: boolean
  onClose: () => void
}

export default function TemplateSelector({ onSelect, isOpen, onClose }: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  const filtered = selectedCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === selectedCategory)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-72 bg-[#1C1B1B] border-r border-[#2A2A2A] overflow-y-auto flex flex-col shrink-0">
        <div className="sticky top-0 bg-[#1C1B1B] p-3 border-b border-[#2A2A2A]">
          <h2 className="text-base font-semibold text-white mb-2">Templates</h2>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-2 py-0.5 rounded-full text-[0.625rem] font-medium transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-[#DCB263] text-[#412D00]'
                  : 'bg-[#2A2A2A] text-[#999999] hover:text-white'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat)
                  if (window.innerWidth < 768) onClose()
                }}
                className={`px-2 py-0.5 rounded-full text-[0.625rem] font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#DCB263] text-[#412D00]'
                    : 'bg-[#2A2A2A] text-[#999999] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          {filtered.map(template => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="w-full text-left p-2 rounded-lg bg-[#2A2A2A] hover:bg-[#353535] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-[#DCB263]/20 text-[#DCB263] font-medium">
                  {template.category}
                </span>
              </div>
              <p className="text-xs font-medium text-white mt-1">{template.title}</p>
              <p className="text-[0.625rem] text-[#999999] mt-0.5 truncate">{template.prompt}...</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
