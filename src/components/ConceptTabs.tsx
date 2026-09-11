export type Tab = 'sampling' | 'bitdepth' | 'filesize' | 'headroom'

interface ConceptTabsProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'sampling', label: 'Frecuencia de muestreo' },
  { id: 'bitdepth', label: 'Profundidad de bits' },
  { id: 'filesize', label: 'Tamaño de archivo' },
  { id: 'headroom', label: 'Headroom y Clipping' },
]

export default function ConceptTabs({ active, onChange }: ConceptTabsProps) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-800 px-6 py-3">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.id
              ? 'bg-purple-600 text-white'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
