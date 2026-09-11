interface HeaderProps {
  presentationMode: boolean
  onTogglePresentation: () => void
}

export default function Header({ presentationMode, onTogglePresentation }: HeaderProps) {
  if (presentationMode) return null

  return (
    <header className="border-b border-slate-800 px-6 py-5 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Digital Audio Lab
        </h1>
        <p className="text-sm text-slate-400">
          Aprende cómo el sonido se convierte en información digital
        </p>
      </div>
      <button
        type="button"
        onClick={onTogglePresentation}
        className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-purple-500 hover:text-purple-300 transition-colors"
      >
        Modo presentación
      </button>
    </header>
  )
}
