import { useMemo, useState } from 'react'
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

const AMPLITUDE = 1
const VISIBLE_CYCLES = 10 // how many periods of the signal to show in the chart, at most
const MAX_RENDERED_SAMPLES = 250
const CHART_WIDTH = 800
const CHART_HEIGHT = 260

const SIGNAL_FREQ_MIN = 1
const SIGNAL_FREQ_MAX = 20000
const SAMPLE_RATE_MIN = 4
const SAMPLE_RATE_MAX = 192000
const WINDOW_MS_MIN = 0.005 // 5 µs, enough to zoom in below a single sample interval at 192 kHz
const WINDOW_MS_MAX = 1000 // 1 s
const LOG_WINDOW_MS_MIN = Math.log10(WINDOW_MS_MIN)
// Hardcoded because Math.log10(1000) is 2.9999999999999996 in JS, not exactly 3.
const LOG_WINDOW_MS_MAX = 3

/** Maps a frequency to the exact log-scale slider position, avoiding floating-point drift at the bounds. */
function windowMsToLogSlider(ms: number): number {
  if (ms >= WINDOW_MS_MAX) return LOG_WINDOW_MS_MAX
  if (ms <= WINDOW_MS_MIN) return LOG_WINDOW_MS_MIN
  return Math.log10(ms)
}

/** Maps a slider position to a frequency on a log scale, rounded to a sensible precision. */
function logSliderToFrequency(position: number): number {
  const raw = 10 ** position
  if (raw < 10) return Math.round(raw * 10) / 10
  if (raw < 1000) return Math.round(raw)
  return Math.round(raw / 10) * 10
}

/** Whole milliseconds once the window is 1 ms or larger, so the value never shows decimals. */
function roundWindowMs(ms: number): number {
  return ms < 1 ? ms : Math.round(ms)
}

/** Maps a slider position to a window size, snapping exactly to the min/max at the ends of the range. */
function logSliderToWindowMs(position: number): number {
  if (position >= LOG_WINDOW_MS_MAX - 0.0005) return WINDOW_MS_MAX
  if (position <= LOG_WINDOW_MS_MIN + 0.0005) return WINDOW_MS_MIN
  return roundWindowMs(10 ** position)
}

function formatWindowMs(ms: number): string {
  if (ms < 1) return `${formatNumber(ms * 1000)} µs`
  return `${formatNumber(Math.round(ms))} ms`
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
  const apparentWave = useMemo(
    () =>
      aliasing && alias !== null
        ? generateAnalogWave(alias, AMPLITUDE, duration)
        : null,
    [aliasing, alias, duration],
  )

  const analogPath = pointsToPath(analogWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const apparentPath = apparentWave ? pointsToPath(apparentWave, domain, CHART_WIDTH, CHART_HEIGHT) : null
  const renderedSamples = samples.length <= MAX_RENDERED_SAMPLES ? samples : []

  const explanation = aliasing
    ? `Estás tomando ${formatFrequency(sampleRate)} muestras por segundo para una señal de ${formatFrequency(signalFrequency)}. Como la señal supera el límite de Nyquist (${formatFrequency(nyquist)}), el sistema no puede distinguirla de una señal de ${formatFrequency(alias ?? 0)}: esto es aliasing.`
    : `Estás tomando ${formatFrequency(sampleRate)} muestras por segundo. Según Nyquist, este sistema puede representar frecuencias de hasta aproximadamente ${formatFrequency(nyquist)}, así que la señal de ${formatFrequency(signalFrequency)} se representa correctamente.`

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Gráfico de señal analógica y muestreo"
        >
          <line x1={0} y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke="#334155" strokeWidth={1} />

          <path d={analogPath} fill="none" stroke="#64748b" strokeWidth={2} />

          {apparentPath && (
            <path d={apparentPath} fill="none" stroke="#f87171" strokeWidth={2} strokeDasharray="6 4" />
          )}

          {renderedSamples.map((s, i) => {
            const { x, y } = toScreen(s, domain, CHART_WIDTH, CHART_HEIGHT)
            return (
              <g key={i}>
                <line x1={x} y1={CHART_HEIGHT / 2} x2={x} y2={y} stroke="#a855f7" strokeWidth={1} opacity={0.4} />
                <circle cx={x} cy={y} r={4} fill="#a855f7" />
              </g>
            )
          })}
        </svg>

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

      <div className="grid gap-6 md:grid-cols-2">
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
              onChange={(e) => setSignalFrequency(logSliderToFrequency(Number(e.target.value)))}
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
