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
import {
  WINDOW_MS_MAX,
  WINDOW_MS_MIN,
  LOG_WINDOW_MS_MIN,
  LOG_WINDOW_MS_MAX,
  formatWindowMs,
  logSliderToWindowMs,
  windowMsToLogSlider,
} from '../lib/zoom'
import HeadroomDemo from './HeadroomDemo'

const AMPLITUDE = 1
const DURATION = 1
const SIGNAL_FREQUENCY = 2
const CHART_WIDTH = 800
const CHART_HEIGHT = 260
const CENTER_T = DURATION / 2
const ANALOG_RESOLUTION = 4000 // dense enough to stay smooth when zoomed into a small time window

type BitDepthMode =
  | { kind: 'pcm'; bits: number }
  | { kind: 'float32' }

const INTEGER_BIT_OPTIONS = [8, 16, 24]
const DEMO_BIT_OPTIONS = [2, 3, 4]

function describeMode(mode: BitDepthMode): string {
  if (mode.kind === 'float32') {
    return 'En vez de una grilla fija de niveles, usa notación de punto flotante: el tamaño del paso se adapta a la amplitud de la señal, casi eliminando el error de cuantización y evitando el clipping.'
  }
  switch (mode.bits) {
    case 2:
      return 'Solo 4 niveles: prácticamente todo se convierte en escalones enormes.'
    case 3:
      return '8 niveles: los escalones siguen siendo muy evidentes.'
    case 4:
      return 'Solo 16 niveles: los escalones de cuantización son muy visibles.'
    case 8:
      return '256 niveles, usado históricamente en audio de baja fidelidad.'
    case 16:
      return 'Estándar de un CD de audio, con 65.536 niveles.'
    case 24:
      return 'Habitual en grabación y producción por su amplio rango dinámico y headroom.'
    default:
      return `${formatNumber(2 ** mode.bits)} niveles disponibles.`
  }
}

export default function BitDepthDemo({ presentationMode }: { presentationMode: boolean }) {
  const [subTab, setSubTab] = useState<'chart' | 'compare'>('chart')
  const [mode, setMode] = useState<BitDepthMode>({ kind: 'pcm', bits: 8 })
  const [compareBits, setCompareBits] = useState<number | null>(null)
  const [presetInfo, setPresetInfo] = useState<string | null>(null)
  const [windowMs, setWindowMs] = useState(WINDOW_MS_MAX)

  // Same zoom factor definition as the sampling tab: full window (1000 ms) = 1x.
  const zoom = WINDOW_MS_MAX / windowMs

  const analogWave = useMemo(
    () => generateAnalogWave(SIGNAL_FREQUENCY, AMPLITUDE, DURATION, ANALOG_RESOLUTION),
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
      <nav className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('chart')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'chart' ? 'bg-purple-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-purple-500'
          }`}
        >
          Cuantización
        </button>
        <button
          type="button"
          onClick={() => setSubTab('compare')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'compare' ? 'bg-purple-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-purple-500'
          }`}
        >
          Comparación Integer vs Float
        </button>
      </nav>

      {subTab === 'chart' ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
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
            </div>

            <div className="grid gap-2 content-start grid-cols-2 lg:grid-cols-1">
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
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-slate-200">
                  Zoom
                  <span className="text-purple-300">{formatWindowMs(windowMs)}</span>
                </label>
                <input
                  type="range"
                  min={LOG_WINDOW_MS_MIN}
                  max={LOG_WINDOW_MS_MAX}
                  step="any"
                  value={windowMsToLogSlider(windowMs)}
                  onChange={(e) => setWindowMs(logSliderToWindowMs(Number(e.target.value)))}
                  className="mt-2 w-full"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{formatWindowMs(WINDOW_MS_MIN)}</span>
                  {windowMs !== WINDOW_MS_MAX && (
                    <button type="button" onClick={() => setWindowMs(WINDOW_MS_MAX)} className="text-purple-300 hover:underline">
                      Ver todo
                    </button>
                  )}
                  <span>{formatWindowMs(WINDOW_MS_MAX)}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Formato</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode({ kind: 'pcm', bits: mode.kind === 'pcm' ? mode.bits : 8 })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      mode.kind === 'pcm' ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200 hover:border-purple-500'
                    }`}
                  >
                    Integer PCM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode({ kind: 'float32' })
                      setPresetInfo(describeMode({ kind: 'float32' }))
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      mode.kind === 'float32' ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200 hover:border-purple-500'
                    }`}
                  >
                    Floating Point
                  </button>
                </div>
                {mode.kind === 'pcm' ? (
                  <label className="mt-3 flex items-center justify-between text-xs font-medium text-slate-300">
                    Ajuste fino
                    <span className="text-purple-300">{mode.bits} bits</span>
                  </label>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">32-bit Float</p>
                )}
                {mode.kind === 'pcm' && (
                  <input
                    type="range"
                    min={2}
                    max={24}
                    step={1}
                    value={mode.bits}
                    onChange={(e) => setMode({ kind: 'pcm', bits: Number(e.target.value) })}
                    className="mt-2 w-full"
                  />
                )}
              </div>

              <div>
                {mode.kind === 'pcm' && (
                  <>
                    <p className="mb-2 text-xs text-slate-500">Presets:</p>
                    <div className="flex flex-wrap gap-2">
                      {[...INTEGER_BIT_OPTIONS, ...DEMO_BIT_OPTIONS].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setMode({ kind: 'pcm', bits: b })
                            setPresetInfo(describeMode({ kind: 'pcm', bits: b }))
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs hover:border-purple-500 ${
                            mode.bits === b ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200'
                          }`}
                        >
                          {b}-bit
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="mb-2 mt-3 text-xs uppercase tracking-wide text-slate-500">Comparar A/B</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompareBits(compareBits === null ? 4 : null)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      compareBits !== null
                        ? 'border-cyan-400 text-cyan-300'
                        : 'border-slate-700 text-slate-200 hover:border-purple-500'
                    }`}
                  >
                    {compareBits !== null ? 'Quitar comparación' : 'Comparar bit depth'}
                  </button>
                  {compareBits !== null && (
                    <input
                      type="range"
                      min={2}
                      max={24}
                      step={1}
                      value={compareBits}
                      onChange={(e) => setCompareBits(Number(e.target.value))}
                      className="w-24"
                    />
                  )}
                </div>
              </div>
            </div>
            {presetInfo && <p className="mt-3 text-xs text-slate-400">{presetInfo}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
              <p className="mb-1 font-medium text-slate-300">¿Qué son los "niveles disponibles"?</p>
              <p>
                Los valores de amplitud distintos que el conversor puede usar, como los peldaños de una
                escalera: más niveles significan escalones más pequeños y una señal más fiel a la original.
                {mode.kind === 'pcm' && (
                  <> Niveles = 2^{bits} = {formatNumber(levels ?? 0)} · Rango dinámico ≈ 6.02 × {bits} dB.</>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
              {explanation}
            </div>
          </div>
        </>
      ) : (
        <HeadroomDemo integerBits={mode.kind === 'pcm' ? mode.bits : 24} />
      )}
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
