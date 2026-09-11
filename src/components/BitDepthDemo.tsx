import { useMemo, useState } from 'react'
import {
  dynamicRangeDb,
  formatNumber,
  generateAnalogWave,
  quantizationLevels,
  quantizeWave,
} from '../lib/signal'
import { pointsToPath } from '../lib/chart'

const AMPLITUDE = 1
const DURATION = 1
const SIGNAL_FREQUENCY = 2
const CHART_WIDTH = 800
const CHART_HEIGHT = 260

type BitDepthPreset = { label: string; value: number; description: string }

const PRESETS: BitDepthPreset[] = [
  { label: '4-bit Demo', value: 4, description: 'Solo 16 niveles: los escalones de cuantización son muy visibles.' },
  { label: '8-bit', value: 8, description: '256 niveles, usado históricamente en audio de baja fidelidad.' },
  { label: 'CD 16-bit', value: 16, description: 'Estándar de un CD de audio, con 65.536 niveles.' },
  { label: 'Studio 24-bit', value: 24, description: 'Habitual en grabación y producción por su amplio rango dinámico y headroom.' },
]

export default function BitDepthDemo({ presentationMode }: { presentationMode: boolean }) {
  const [bits, setBits] = useState(8)
  const [compareBits, setCompareBits] = useState<number | null>(null)
  const [presetInfo, setPresetInfo] = useState<string | null>(null)

  const analogWave = useMemo(
    () => generateAnalogWave(SIGNAL_FREQUENCY, AMPLITUDE, DURATION),
    [],
  )
  const quantizedWave = useMemo(
    () => quantizeWave(analogWave, bits, AMPLITUDE),
    [analogWave, bits],
  )
  const compareWave = useMemo(
    () => (compareBits !== null ? quantizeWave(analogWave, compareBits, AMPLITUDE) : null),
    [analogWave, compareBits],
  )

  const levels = quantizationLevels(bits)
  const dynamicRange = dynamicRangeDb(bits)

  const analogPath = pointsToPath(analogWave, DURATION, AMPLITUDE, CHART_WIDTH, CHART_HEIGHT)
  const quantizedPath = pointsToPath(quantizedWave, DURATION, AMPLITUDE, CHART_WIDTH, CHART_HEIGHT)
  const comparePath = compareWave
    ? pointsToPath(compareWave, DURATION, AMPLITUDE, CHART_WIDTH, CHART_HEIGHT)
    : null

  const errorLevel = bits <= 3 ? 'Muy alto' : bits <= 6 ? 'Alto' : bits <= 10 ? 'Moderado' : 'Muy bajo'

  const explanation = `Con ${bits} bits hay ${formatNumber(levels)} niveles posibles para representar la amplitud. Cada muestra se aproxima al nivel disponible más cercano, lo que produce un error de cuantización ${errorLevel.toLowerCase()}. El rango dinámico teórico es de aproximadamente ${formatNumber(dynamicRange)} dB.`

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Gráfico de señal original y cuantizada"
        >
          <line x1={0} y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke="#334155" strokeWidth={1} />
          <path d={analogPath} fill="none" stroke="#64748b" strokeWidth={2} />
          <path d={quantizedPath} fill="none" stroke="#a855f7" strokeWidth={2.5} />
          {comparePath && (
            <path d={comparePath} fill="none" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 4" />
          )}
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-500" /> Señal original</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-purple-500" /> Señal cuantizada ({bits} bits)</span>
          {comparePath && (
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-cyan-400" /> Comparación ({compareBits} bits)</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Bit Depth
              <span className="text-purple-300">{bits} bits</span>
            </label>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={bits}
              onChange={(e) => setBits(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setBits(p.value)
                    setPresetInfo(p.description)
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-purple-500"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Comparar A/B</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCompareBits(compareBits === null ? 4 : null)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  compareBits !== null
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-slate-700 text-slate-200 hover:border-purple-500'
                }`}
              >
                {compareBits !== null ? 'Quitar comparación' : 'Comparar con otro bit depth'}
              </button>
              {compareBits !== null && (
                <input
                  type="range"
                  min={2}
                  max={24}
                  step={1}
                  value={compareBits}
                  onChange={(e) => setCompareBits(Number(e.target.value))}
                  className="w-32"
                />
              )}
            </div>
          </div>

          {presetInfo && <p className="text-xs text-slate-400">{presetInfo}</p>}
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Bit Depth" value={`${bits} bits`} />
            <Stat label="Niveles disponibles" value={formatNumber(levels)} />
            <Stat label="Rango dinámico teórico" value={`≈ ${formatNumber(dynamicRange)} dB`} />
            <Stat label="Error de cuantización" value={errorLevel} tone={bits <= 4 ? 'warn' : 'ok'} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            Niveles = 2^{bits} = {formatNumber(levels)} · Rango dinámico ≈ 6.02 × {bits} dB
          </div>

          <p className="text-sm leading-relaxed text-slate-300">{explanation}</p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-red-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-100'
  return (
    <div className="rounded-lg bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}
