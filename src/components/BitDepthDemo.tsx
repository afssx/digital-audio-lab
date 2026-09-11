import { useMemo, useState } from 'react'
import {
  dynamicRangeDb,
  formatNumber,
  generateAnalogWave,
  quantizationLevels,
  quantizeWave,
  quantizeWaveFloat32,
} from '../lib/signal'
import { pointsToPath, type ChartDomain } from '../lib/chart'

const AMPLITUDE = 1
const DURATION = 1
const SIGNAL_FREQUENCY = 2
const CHART_WIDTH = 800
const CHART_HEIGHT = 260
const CENTER_T = DURATION / 2
const MAX_ZOOM = 40

type BitDepthMode =
  | { kind: 'pcm'; bits: number }
  | { kind: 'float32' }

type BitDepthPreset = { label: string; description: string; mode: BitDepthMode }

const PRESETS: BitDepthPreset[] = [
  { label: '4-bit Demo', mode: { kind: 'pcm', bits: 4 }, description: 'Solo 16 niveles: los escalones de cuantización son muy visibles.' },
  { label: '8-bit', mode: { kind: 'pcm', bits: 8 }, description: '256 niveles, usado históricamente en audio de baja fidelidad.' },
  { label: 'CD 16-bit', mode: { kind: 'pcm', bits: 16 }, description: 'Estándar de un CD de audio, con 65.536 niveles.' },
  { label: 'Studio 24-bit', mode: { kind: 'pcm', bits: 24 }, description: 'Habitual en grabación y producción por su amplio rango dinámico y headroom.' },
  {
    label: '32-bit Float',
    mode: { kind: 'float32' },
    description:
      'En vez de una grilla fija de niveles, usa notación de punto flotante: el tamaño del paso se adapta a la amplitud de la señal, casi eliminando el error de cuantización y evitando el clipping.',
  },
]

export default function BitDepthDemo({ presentationMode }: { presentationMode: boolean }) {
  const [mode, setMode] = useState<BitDepthMode>({ kind: 'pcm', bits: 8 })
  const [compareBits, setCompareBits] = useState<number | null>(null)
  const [presetInfo, setPresetInfo] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const analogWave = useMemo(
    () => generateAnalogWave(SIGNAL_FREQUENCY, AMPLITUDE, DURATION),
    [],
  )
  const quantizedWave = useMemo(
    () =>
      mode.kind === 'float32'
        ? quantizeWaveFloat32(analogWave)
        : quantizeWave(analogWave, mode.bits, AMPLITUDE),
    [analogWave, mode],
  )
  const compareWave = useMemo(
    () => (compareBits !== null ? quantizeWave(analogWave, compareBits, AMPLITUDE) : null),
    [analogWave, compareBits],
  )

  const bits = mode.kind === 'pcm' ? mode.bits : 32
  const levels = mode.kind === 'pcm' ? quantizationLevels(mode.bits) : null
  const dynamicRange = mode.kind === 'pcm' ? dynamicRangeDb(mode.bits) : 1529 // ~1529 dB (24-bit mantissa)

  const domain: ChartDomain = useMemo(() => {
    const halfWindowT = DURATION / 2 / zoom
    const halfWindowY = AMPLITUDE / zoom
    return {
      xMin: CENTER_T - halfWindowT,
      xMax: CENTER_T + halfWindowT,
      yMin: -halfWindowY,
      yMax: halfWindowY,
    }
  }, [zoom])

  const analogPath = pointsToPath(analogWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const quantizedPath = pointsToPath(quantizedWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const comparePath = compareWave ? pointsToPath(compareWave, domain, CHART_WIDTH, CHART_HEIGHT) : null

  const errorLevel =
    mode.kind === 'float32'
      ? 'Prácticamente nulo'
      : bits <= 3
        ? 'Muy alto'
        : bits <= 6
          ? 'Alto'
          : bits <= 10
            ? 'Moderado'
            : 'Muy bajo'

  const explanation =
    mode.kind === 'float32'
      ? `El audio de 32 bits float no usa una grilla fija de ${formatNumber(2 ** 24)} niveles como el PCM entero. Guarda cada muestra como signo + exponente + mantisa (como la notación científica), así que el tamaño del "escalón" se adapta a la amplitud: pasos diminutos tanto en sonidos suaves como en picos altos. Por eso, incluso con zoom, la señal cuantizada se superpone casi perfectamente con la original.`
      : `Con ${bits} bits hay ${formatNumber(levels ?? 0)} niveles posibles para representar la amplitud. Cada muestra se aproxima al nivel disponible más cercano, lo que produce un error de cuantización ${errorLevel.toLowerCase()}. El rango dinámico teórico es de aproximadamente ${formatNumber(dynamicRange)} dB.`

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Gráfico de señal original y cuantizada"
        >
          <path d={analogPath} fill="none" stroke="#64748b" strokeWidth={2} />
          <path d={quantizedPath} fill="none" stroke="#a855f7" strokeWidth={2.5} />
          {comparePath && (
            <path d={comparePath} fill="none" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 4" />
          )}
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-500" /> Señal original</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded bg-purple-500" /> Señal cuantizada ({mode.kind === 'float32' ? '32-bit float' : `${bits} bits`})
          </span>
          {comparePath && (
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-cyan-400" /> Comparación ({compareBits} bits)</span>
          )}
        </div>

        <div className="mt-4">
          <label className="flex items-center justify-between text-xs font-medium text-slate-300">
            Zoom (para ver qué tan "pixelada"/escalonada está la señal)
            <span className="text-purple-300">{zoom.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            El zoom acerca la gráfica al centro (t = {formatNumber(CENTER_T)} s, amplitud = 0). A mayor zoom, más
            fácil ver los escalones de cuantización: en bit depths bajos se notan enseguida, mientras que en 32
            bits float casi no hay escalón visible ni al máximo zoom.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Bit Depth
              <span className="text-purple-300">{mode.kind === 'float32' ? '32-bit float' : `${bits} bits`}</span>
            </label>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              disabled={mode.kind === 'float32'}
              value={mode.kind === 'pcm' ? mode.bits : 24}
              onChange={(e) => setMode({ kind: 'pcm', bits: Number(e.target.value) })}
              className="mt-2 w-full disabled:opacity-40"
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
                    setMode(p.mode)
                    setPresetInfo(p.description)
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs hover:border-purple-500 ${
                    (p.mode.kind === 'float32' && mode.kind === 'float32') ||
                    (p.mode.kind === 'pcm' && mode.kind === 'pcm' && p.mode.bits === mode.bits)
                      ? 'border-purple-500 text-purple-300'
                      : 'border-slate-700 text-slate-200'
                  }`}
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
            <Stat label="Bit Depth" value={mode.kind === 'float32' ? '32-bit float' : `${bits} bits`} />
            <Stat
              label="Niveles disponibles"
              value={mode.kind === 'float32' ? '~16.7 millones (variables)' : formatNumber(levels ?? 0)}
            />
            <Stat label="Rango dinámico teórico" value={`≈ ${formatNumber(dynamicRange)} dB`} />
            <Stat
              label="Error de cuantización"
              value={errorLevel}
              tone={mode.kind === 'pcm' && bits <= 4 ? 'warn' : 'ok'}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
            <p className="mb-1 font-medium text-slate-300">¿Qué son los "niveles disponibles"?</p>
            <p>
              Son los valores de amplitud distintos que el conversor puede usar para representar la señal, como
              los peldaños de una escalera: más peldaños (niveles) significan escalones más pequeños y una señal
              más fiel a la original.
            </p>
          </div>

          {mode.kind === 'pcm' && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
              Niveles = 2^{bits} = {formatNumber(levels ?? 0)} · Rango dinámico ≈ 6.02 × {bits} dB
            </div>
          )}

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
