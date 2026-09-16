import { useState } from 'react'
import Header from './components/Header'
import ConceptTabs, { type Tab } from './components/ConceptTabs'
import SamplingRateDemo from './components/SamplingRateDemo'
import BitDepthDemo from './components/BitDepthDemo'
import FileSizeDemo from './components/FileSizeDemo'
import HeadroomClippingDemo from './components/HeadroomClippingDemo'
import HeadroomMarginDemo from './components/HeadroomMarginDemo'
import LimiterClipperDemo from './components/LimiterClipperDemo'

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
        {activeTab === 'sampling' && <SamplingRateDemo presentationMode={presentationMode} />}
        {activeTab === 'bitdepth' && <BitDepthDemo presentationMode={presentationMode} />}
        {activeTab === 'filesize' && <FileSizeDemo presentationMode={presentationMode} />}
        {activeTab === 'headroommargin' && <HeadroomMarginDemo presentationMode={presentationMode} />}
        {activeTab === 'headroom' && <HeadroomClippingDemo presentationMode={presentationMode} />}
        {activeTab === 'limiter' && <LimiterClipperDemo presentationMode={presentationMode} />}
      </main>

      {presentationMode && (
        <button
          type="button"
          onClick={() => setPresentationMode(false)}
          title="Salir de modo presentación"
          aria-label="Salir de modo presentación"
          className="fixed bottom-4 right-4 rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:border-purple-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default App
