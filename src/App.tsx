import { useState } from 'react'
import Header from './components/Header'
import ConceptTabs, { type Tab } from './components/ConceptTabs'
import SamplingRateDemo from './components/SamplingRateDemo'
import BitDepthDemo from './components/BitDepthDemo'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('sampling')
  const [presentationMode, setPresentationMode] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        presentationMode={presentationMode}
        onTogglePresentation={() => setPresentationMode((v) => !v)}
      />
      <ConceptTabs active={activeTab} onChange={setActiveTab} />

      <main className="flex-1">
        {activeTab === 'sampling' ? (
          <SamplingRateDemo presentationMode={presentationMode} />
        ) : (
          <BitDepthDemo presentationMode={presentationMode} />
        )}
      </main>

      {presentationMode && (
        <button
          type="button"
          onClick={() => setPresentationMode(false)}
          className="fixed bottom-4 right-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-purple-500"
        >
          Salir de modo presentación
        </button>
      )}
    </div>
  )
}

export default App
