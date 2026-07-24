interface LibraryItem {
  id: string
  name: string
  type: 'template' | 'jurisprudence' | 'doctrine' | 'legislation' | 'other'
  path?: string
}

interface LibrarySectionProps {
  items?: LibraryItem[]
  onOpen?: (item: LibraryItem) => void
}

const ICONS: Record<string, string> = {
  template: '📄',
  jurisprudence: '⚖️',
  doctrine: '📖',
  legislation: '🏛️',
  other: '📁',
}

const LABELS: Record<string, string> = {
  template: 'Plantillas',
  jurisprudence: 'Jurisprudencia',
  doctrine: 'Doctrina',
  legislation: 'Legislación',
  other: 'Otros',
}

export default function LibrarySection({ items = [], onOpen }: LibrarySectionProps) {
  const defaultItems: LibraryItem[] = [
    { id: 'contract-template', name: 'Plantilla de contrato', type: 'template' },
    { id: 'demand-template', name: 'Plantilla de demanda', type: 'template' },
    { id: 'brief-template', name: 'Plantilla de escrito', type: 'template' },
    { id: 'nda-template', name: 'Plantilla de NDA', type: 'template' },
  ]

  const displayItems = items.length > 0 ? items : defaultItems
  const grouped = displayItems.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || []
    acc[item.type].push(item)
    return acc
  }, {} as Record<string, LibraryItem[]>)

  return (
    <div className="space-y-2 px-1 py-1">
      {Object.entries(grouped).map(([type, groupItems]) => (
        <div key={type}>
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-[#999999]">
              {ICONS[type]} {LABELS[type]}
            </span>
          </div>
          {groupItems.map(item => (
            <button
              key={item.id}
              onClick={() => onOpen?.(item)}
              className="w-full flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg text-[0.7rem] text-[#999999] hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-colors text-left"
            >
              <span>{ICONS[item.type]}</span>
              <span className="flex-1 truncate">{item.name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
