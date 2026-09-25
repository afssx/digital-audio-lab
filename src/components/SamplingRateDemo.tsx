import { useEffect, useMemo, useState } from 'react'
import {
  aliasedFrequency,
  formatFrequency,
  formatNumber,
  generateAnalogWave,
  isAliasing,
  nyquistFrequency,
  sampleWave,
} from '../lib/signal'
import { pointsToPath, toScreen } from '../lib/chart'
import {
  WINDOW_MS_MAX,
  WINDOW_MS_MIN,
  LOG_WINDOW_MS_MIN,
  LOG_WINDOW_MS_MAX,
  formatWindowMs,
  logSliderToWindowMs,
  windowMsToLogSlider,
  roundWindowMs,
} from '../lib/zoom'

const AMPLITUDE = 1
const VISIBLE_CYCLES = 10 // how many periods of the signal to show in the chart, at most
const MAX_RENDERED_SAMPLES = 250
const CHART_WIDTH = 800
const CHART_HEIGHT = 260
const ANIMATION_DURATION_MS = 2600

const SIGNAL_FREQ_MIN = 1
const SIGNAL_FREQ_MAX = 20000
const SAMPLE_RATE_MIN = 4
const SAMPLE_RATE_MAX = 192000

/** Maps a slider position to a frequency on a log scale, rounded to a sensible precision. */
function logSliderToFrequency(position: number): number {
  const raw = 10 ** position
  if (raw < 10) return Math.round(raw * 10) / 10
  if (raw < 1000) return Math.round(raw)
  return Math.round(raw / 10) * 10
}

type SampleRatePreset = { label: string; value: number; description: string }

const DEMO_PRESETS: SampleRatePreset[] = [
  { label: '4 Hz', value: 4, description: 'Muy pocas muestras: casi no se distingue la forma de onda.' },
  { label: '8 Hz', value: 8, description: 'El doble de muestras, pero todavía muy poco detalle.' },
  { label: '16 Hz', value: 16, description: 'Empieza a insinuarse la forma de la onda.' },
  { label: '40 Hz', value: 40, description: 'Suficiente para representar ondas de baja frecuencia con claridad.' },
]

const REAL_PRESETS: SampleRatePreset[] = [
  { label: 'CD 44.1 kHz', value: 44100, description: 'Frecuencia de muestreo estándar de un CD de audio.' },
  { label: 'Video 48 kHz', value: 48000, description: 'Muy utilizada en producción audiovisual y audio profesional.' },
  { label: 'Hi-Res 96 kHz', value: 96000, description: 'Formato de alta resolución, común en grabación y masterización.' },
  { label: '192 kHz', value: 192000, description: 'Máxima resolución temporal habitual, usada en producción de alta gama.' },
]

export default function SamplingRateDemo({ presentationMode }: { presentationMode: boolean }) {
  const [signalFrequency, setSignalFrequency] = useState(5)
  const [sampleRate, setSampleRate] = useState(20)
  const [showNyquist, setShowNyquist] = useState(true)
  const [presetInfo, setPresetInfo] = useState<string | null>(null)
  const [manualWindowMs, setManualWindowMs] = useState<number | null>(null)
  const [animationProgress, setAnimationProgress] = useState(1)
  const [isAnimating, setIsAnimating] = useState(false)

  const nyquist = nyquistFrequency(sampleRate)
  const aliasing = isAliasing(signalFrequency, sampleRate)
  const alias = aliasing ? aliasedFrequency(signalFrequency, sampleRate) : null

  // Show at most VISIBLE_CYCLES periods by default, so high-frequency waves stay readable.
  const defaultWindowMs = roundWindowMs(Math.min(WINDOW_MS_MAX, (VISIBLE_CYCLES / signalFrequency) * 1000))
  const windowMs = manualWindowMs ?? defaultWindowMs
  const duration = windowMs / 1000
  const domain = useMemo(
    () => ({ xMin: 0, xMax: duration, yMin: -AMPLITUDE, yMax: AMPLITUDE }),
    [duration],
  )

  const analogWave = useMemo(
    () => generateAnalogWave(signalFrequency, AMPLITUDE, duration),
    [signalFrequency, duration],
  )
  const samples = useMemo(
    () => sampleWave(signalFrequency, AMPLITUDE, sampleRate, duration),
    [signalFrequency, sampleRate, duration],
  )
  const apparentFrequency =
    aliasing && alias !== null
      ? signalFrequency - Math.round(signalFrequency / sampleRate) * sampleRate
      : null
  const apparentWave = useMemo(
    () =>
      apparentFrequency !== null
        ? generateAnalogWave(apparentFrequency, AMPLITUDE, duration)
        : null,
    [apparentFrequency, duration],
  )
  const analogPath = pointsToPath(analogWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const apparentPath = apparentWave ? pointsToPath(apparentWave, domain, CHART_WIDTH, CHART_HEIGHT) : null
  const renderedSamples = samples.length <= MAX_RENDERED_SAMPLES ? samples : []
  const playheadTime = duration * animationProgress
  const playheadX = toScreen({ t: playheadTime, y: -AMPLITUDE }, domain, CHART_WIDTH, CHART_HEIGHT).x

  useEffect(() => {
    if (!isAnimating) return

    let frameId = 0
    const startedAt = performance.now()
    const animate = (now: number) => {
      const progress = ((now - startedAt) % ANIMATION_DURATION_MS) / ANIMATION_DURATION_MS
      setAnimationProgress(progress)
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [isAnimating])

  const startAnimation = () => {
    setAnimationProgress(0)
    setIsAnimating(true)
  }

  const visibleSamples =
    animationProgress < 1
      ? renderedSamples.filter((sample) => sample.t <= playheadTime)
      : renderedSamples

  const explanation = aliasing
    ? `Estás tomando ${formatFrequency(sampleRate)} muestras por segundo para una señal de ${formatFrequency(signalFrequency)}. Como la señal supera el límite de Nyquist (${formatFrequency(nyquist)}), el sistema no puede distinguirla de una señal de ${formatFrequency(alias ?? 0)}: esto es aliasing.`
    : `Estás tomando ${formatFrequency(sampleRate)} muestras por segundo. Según Nyquist, este sistema puede representar frecuencias de hasta aproximadamente ${formatFrequency(nyquist)}, así que la señal de ${formatFrequency(signalFrequency)} se representa correctamente.`

  return (
    <div
      className={`grid gap-6 p-6 ${
        presentationMode ? 'max-w-none lg:grid-cols-[1.4fr_1fr] lg:items-start' : 'max-w-5xl mx-auto'
      }`}
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="relative">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label="Gráfico de señal analógica y muestreo"
          >
          <defs>
            <clipPath id="sampling-reveal">
              <rect x={0} y={0} width={playheadX} height={CHART_HEIGHT} />
            </clipPath>
          </defs>

          <line x1={0} y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke="#334155" strokeWidth={1} />

          <path d={analogPath} fill="none" stroke="#64748b" strokeWidth={2} />

          {apparentPath && (
            <path
              d={apparentPath}
              fill="none"
              stroke="#f87171"
              strokeWidth={2}
              strokeDasharray="6 4"
              clipPath={isAnimating ? 'url(#sampling-reveal)' : undefined}
            />
          )}

          {isAnimating && (
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={CHART_HEIGHT}
              stroke="#facc15"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.9}
            />
          )}

            {visibleSamples.map((s, i) => {
              const { x, y } = toScreen(s, domain, CHART_WIDTH, CHART_HEIGHT)
              return (
                <g key={i}>
                  <line x1={x} y1={CHART_HEIGHT / 2} x2={x} y2={y} stroke="#a855f7" strokeWidth={1} opacity={0.4} />
                  <circle cx={x} cy={y} r={4} fill="#a855f7" />
                </g>
              )
            })}
          </svg>

          <button
            type="button"
            onClick={
              isAnimating
                ? () => {
                    setIsAnimating(false)
                    setAnimationProgress(1)
                  }
                : startAnimation
            }
            aria-label={isAnimating ? 'Detener animación' : 'Reproducir animación'}
            title={isAnimating ? 'Detener animación' : 'Reproducir animación'}
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-purple-300/60 bg-slate-950/90 text-base text-purple-200 shadow-lg hover:bg-purple-500/20"
          >
            {isAnimating ? '■' : '▶'}
          </button>
        </div>

        {samples.length > MAX_RENDERED_SAMPLES && (
          <p className="mt-2 text-xs text-slate-400">
            Hay {formatNumber(samples.length)} muestras en esta ventana de tiempo: demasiadas para dibujar
            individualmente. A esta frecuencia de muestreo, la señal se representa prácticamente sin pérdida.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-500" /> Señal original</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" /> Muestras</span>
          {apparentPath && (
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-400" /> Señal aparente (aliasing)</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            {animationProgress < 1 ? `Muestreando ${formatWindowMs(playheadTime * 1000)}` : 'Muestreo completo'}
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Las líneas verticales moradas son las muestras: marcan el instante exacto en el que el conversor
          mide la señal y conectan ese instante en el eje del tiempo con el valor de amplitud capturado en ese
          punto. Cuantas más líneas verticales quepan por segundo, más seguido se está midiendo la señal.
        </p>

        <div className="mt-4">
          <label className="flex items-center justify-between text-sm font-medium text-slate-200">
            Zoom de la ventana de tiempo
            <span className="text-purple-300">{formatWindowMs(windowMs)}</span>
          </label>
          <input
            type="range"
            min={LOG_WINDOW_MS_MIN}
            max={LOG_WINDOW_MS_MAX}
            step="any"
            value={windowMsToLogSlider(windowMs)}
            onChange={(e) => setManualWindowMs(logSliderToWindowMs(Number(e.target.value)))}
            className="mt-2 w-full"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatWindowMs(WINDOW_MS_MIN)}</span>
            {manualWindowMs !== null && (
              <button
                type="button"
                onClick={() => setManualWindowMs(null)}
                className="text-purple-300 hover:underline"
              >
                Volver a automático
              </button>
            )}
            <span>{formatWindowMs(WINDOW_MS_MAX)}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Acercá el zoom (ventana más chica) para ver los puntos de muestreo individuales, incluso con sample
            rates muy altos donde normalmente hay demasiadas muestras para dibujar.
          </p>
        </div>
      </div>

      <div className={`grid gap-6 md:grid-cols-2 ${presentationMode ? 'lg:grid-cols-1' : ''}`}>
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Frecuencia de la señal
              <span className="text-purple-300">{formatFrequency(signalFrequency)}</span>
            </label>
            <input
              type="range"
              min={Math.log10(SIGNAL_FREQ_MIN)}
              max={Math.log10(SIGNAL_FREQ_MAX)}
              step="any"
              value={Math.log10(signalFrequency)}
              onChange={(e) => setSignalFrequency(Math.max(1, Math.round(logSliderToFrequency(Number(e.target.value)))))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>1 Hz</span>
              <span>20 kHz</span>
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Sample Rate
              <span className="text-purple-300">{formatFrequency(sampleRate)}</span>
            </label>
            <input
              type="range"
              min={Math.log10(SAMPLE_RATE_MIN)}
              max={Math.log10(SAMPLE_RATE_MAX)}
              step="any"
              value={Math.log10(sampleRate)}
              onChange={(e) => setSampleRate(logSliderToFrequency(Number(e.target.value)))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>4 Hz</span>
              <span>192 kHz</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showNyquist}
              onChange={(e) => setShowNyquist(e.target.checked)}
            />
            Mostrar límite de Nyquist
          </label>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Modo demostración</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSampleRate(p.value)
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
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Valores reales</p>
            <div className="flex flex-wrap gap-2">
              {REAL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSampleRate(p.value)
                    setPresetInfo(p.description)
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-purple-500"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {presetInfo && <p className="text-xs text-slate-400">{presetInfo}</p>}
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Señal" value={formatFrequency(signalFrequency)} />
            <Stat label="Sample Rate" value={formatFrequency(sampleRate)} />
            {showNyquist && <Stat label="Nyquist" value={formatFrequency(nyquist)} />}
            <Stat
              label="Estado"
              value={aliasing ? '⚠ Aliasing' : '✓ Representable'}
              tone={aliasing ? 'warn' : 'ok'}
            />
          </div>

          {showNyquist && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
              Sample Rate ({formatFrequency(sampleRate)}) ÷ 2 = Nyquist ({formatFrequency(nyquist)})
            </div>
          )}

          {aliasing && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              ⚠ ALIASING: la frecuencia de la señal supera el límite de Nyquist. La señal digital puede
              representar una frecuencia diferente de la original.
            </div>
          )}

          <p className="text-sm leading-relaxed text-slate-300">{explanation}</p>
        </div>
      </div>

      <div className={presentationMode ? 'lg:col-span-2' : ''}>
        <PluginAliasingDemo presentationMode={presentationMode} />
      </div>
    </div>
  )
}

const OVERSAMPLING_FACTORS = [1, 2, 4, 8] as const
const STANDARD_SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000] as const

/** Always shows whole kHz (or whole Hz below 1 kHz), matching how sample rates/harmonics are usually quoted. */
function formatKHz(hz: number): string {
  if (hz >= 1000) return `${Math.round(hz / 1000)} kHz`
  return `${Math.round(hz)} Hz`
}

function PluginAliasingDemo({ presentationMode }: { presentationMode: boolean }) {
  const [sampleRate, setSampleRate] = useState(48000)
  const [harmonicFrequency, setHarmonicFrequency] = useState(40000)
  const [oversampling, setOversampling] = useState<(typeof OVERSAMPLING_FACTORS)[number]>(1)

  const nyquist = nyquistFrequency(sampleRate)
  const internalSampleRate = sampleRate * oversampling
  const internalNyquist = nyquistFrequency(internalSampleRate)

  const harmonicAliases = harmonicFrequency > nyquist
  const alias = harmonicAliases ? aliasedFrequency(harmonicFrequency, sampleRate) : null
  const representableInternally = harmonicFrequency <= internalNyquist

  const CHART_MAX = Math.max(sampleRate, harmonicFrequency) * 1.1
  const toPercent = (hz: number) => Math.min(100, (hz / CHART_MAX) * 100)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-sm font-semibold text-slate-100">Aliasing en plugins y oversampling</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Los plugins no lineales (saturadores, distorsión, clippers, limiters) pueden generar armónicos que no
        existían en la señal original. Si esos armónicos superan Nyquist, pueden reflejarse dentro del espectro
        audible como aliasing.
      </p>

      <div className={presentationMode ? 'mt-4 grid gap-5 xl:grid-cols-[1fr_1.3fr] xl:items-start' : ''}>
      <div className={presentationMode ? 'rounded-lg border border-slate-800 bg-slate-950/60 p-4' : 'mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4'}>
        <div className="relative h-32">
          <div className="absolute left-0 right-0 top-8 h-0.5 bg-slate-700" />

          {alias !== null && (
            <Marker percent={toPercent(alias)} color="#f87171" label={`Alias ≈ ${formatKHz(alias)}`} shape="circle" labelRow={0} />
          )}
          <Marker percent={toPercent(nyquist)} color="#facc15" label={`Nyquist ${formatKHz(nyquist)}`} shape="line" labelRow={1} />
          <Marker
            percent={toPercent(harmonicFrequency)}
            color={harmonicAliases ? '#f87171' : '#4ade80'}
            label={`Harmonic ${formatKHz(harmonicFrequency)}`}
            shape="cross"
            labelRow={2}
          />
          <span className="absolute -bottom-1 left-0 text-[10px] text-slate-500">0</span>
        </div>

        <p className="mt-2 text-center text-xs text-slate-400">
          {harmonicAliases
            ? `${formatKHz(harmonicFrequency)} → Alias ≈ ${formatKHz(alias ?? 0)}`
            : `${formatKHz(harmonicFrequency)} está dentro de Nyquist: no genera aliasing.`}
        </p>
      </div>

      <div className={`grid gap-5 md:grid-cols-2 ${presentationMode ? '' : 'mt-5'}`}>
        <div className="space-y-5">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Sample Rate
              <span className="text-purple-300">{formatKHz(sampleRate)}</span>
            </label>
            <input
              type="range"
              min={Math.log10(22050)}
              max={Math.log10(SAMPLE_RATE_MAX)}
              step="any"
              value={Math.log10(sampleRate)}
              onChange={(e) => setSampleRate(logSliderToFrequency(Number(e.target.value)))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>22.05 kHz</span>
              <span>192 kHz</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {STANDARD_SAMPLE_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSampleRate(rate)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                    sampleRate === rate
                      ? 'border-purple-500 bg-purple-600/20 text-purple-200'
                      : 'border-slate-700 text-slate-200 hover:border-purple-500'
                  }`}
                >
                  {formatKHz(rate)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Generated Harmonic Frequency
              <span className="text-purple-300">{formatKHz(harmonicFrequency)}</span>
            </label>
            <input
              type="range"
              min={Math.log10(1000)}
              max={Math.log10(96000)}
              step="any"
              value={Math.log10(harmonicFrequency)}
              onChange={(e) => setHarmonicFrequency(logSliderToFrequency(Number(e.target.value)))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>1 kHz</span>
              <span>96 kHz</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Oversampling</p>
            <div className="flex flex-wrap gap-2">
              {OVERSAMPLING_FACTORS.map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => setOversampling(factor)}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    oversampling === factor
                      ? 'border-purple-500 bg-purple-600/20 text-purple-200'
                      : 'border-slate-700 text-slate-200 hover:border-purple-500'
                  }`}
                >
                  {factor === 1 ? 'Off' : `${factor}×`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Nyquist" value={formatKHz(nyquist)} />
            <Stat label="Internal Sample Rate" value={formatKHz(internalSampleRate)} />
            <Stat label="Internal Nyquist" value={formatKHz(internalNyquist)} />
            <Stat
              label="Estado interno"
              value={representableInternally ? '✓ Representable' : '⚠ Aliasing'}
              tone={representableInternally ? 'ok' : 'warn'}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            Internal Sample Rate = {formatKHz(sampleRate)} × {oversampling} = {formatKHz(internalSampleRate)}
            <br />
            Internal Nyquist = {formatKHz(internalSampleRate)} ÷ 2 = {formatKHz(internalNyquist)}
          </div>

          <div
            className={`rounded-lg border p-3 text-sm ${
              representableInternally
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {oversampling === 1 ? (
              <>Sin oversampling: {formatKHz(harmonicFrequency)} vs Nyquist {formatKHz(nyquist)} → {harmonicAliases ? 'Aliasing' : 'Representable'}</>
            ) : (
              <>
                Con {oversampling}× oversampling: {formatKHz(harmonicFrequency)} vs Internal Nyquist{' '}
                {formatKHz(internalNyquist)} → {representableInternally ? 'Representable' : 'Aliasing'}
              </>
            )}
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            El oversampling aumenta temporalmente el sample rate interno del plugin para reducir este problema.
            Antes de volver al sample rate original, el plugin aplica un filtro anti-aliasing y luego hace
            downsampling, eliminando los armónicos que quedaron por encima de la Nyquist original.
          </p>
        </div>
      </div>      </div>    </div>
  )
}

function Marker({
  percent,
  color,
  label,
  shape,
  labelRow,
}: {
  percent: number
  color: string
  label: string
  shape: 'circle' | 'cross' | 'line'
  labelRow: number
}) {
  return (
    <div className="absolute top-0" style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}>
      {shape === 'line' && <div className="h-16 w-px border-l border-dashed" style={{ borderColor: color }} />}
      {shape === 'circle' && (
        <div className="mt-6 h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      )}
      {shape === 'cross' && (
        <div className="mt-6 flex h-3 w-3 items-center justify-center text-xs font-bold" style={{ color }}>
          ✕
        </div>
      )}
      {/* Each marker's label sits on its own row below the axis, so nearby frequencies never overlap. */}
      <span
        className="absolute whitespace-nowrap text-[10px] text-slate-400"
        style={{ left: '50%', transform: 'translateX(-50%)', top: `${68 + labelRow * 16}px` }}
      >
        {label}
      </span>
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
