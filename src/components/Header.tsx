interface HeaderProps {
  presentationMode: boolean
  onTogglePresentation: () => void
}

export default function Header({ presentationMode, onTogglePresentation }: HeaderProps) {
  if (presentationMode) return null

  return (
    <header className="border-b border-slate-800 px-6 py-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src="/AES_logo.png" alt="AES logo" className="h-8 w-auto sm:h-9" />
        <div className="h-8 w-px bg-slate-700 sm:h-9" />
        <img src="/partner_logo.svg" alt="Partner logo" className="h-8 w-auto sm:h-9" />
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Digital Audio Lab
          </h1>
          <p className="text-sm text-slate-400">
            Aprende cómo el sonido se convierte en información digital
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onTogglePresentation}
        title="Modo presentación"
        aria-label="Modo presentación"
        className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-purple-500 hover:text-purple-300 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </header>
  )
}
