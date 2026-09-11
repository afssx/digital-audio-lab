import { useMemo, useState } from 'react'
import {
  aliasedFrequency,
  formatNumber,
  generateAnalogWave,
  isAliasing,
  nyquistFrequency,
  sampleWave,
} from '../lib/signal'
import { pointsToPath, toScreen } from '../lib/chart'

const AMPLITUDE = 1
const DURATION = 1 // seconds shown in the chart
const MAX_RENDERED_SAMPLES = 250
const CHART_WIDTH = 800
const CHART_HEIGHT = 260
const DOMAIN = { xMin: 0, xMax: DURATION, yMin: -AMPLITUDE, yMax: AMPLITUDE }

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

  const nyquist = nyquistFrequency(sampleRate)
  const aliasing = isAliasing(signalFrequency, sampleRate)
  const alias = aliasing ? aliasedFrequency(signalFrequency, sampleRate) : null

  const analogWave = useMemo(
    () => generateAnalogWave(signalFrequency, AMPLITUDE, DURATION),
    [signalFrequency],
  )
  const samples = useMemo(
    () => sampleWave(signalFrequency, AMPLITUDE, sampleRate, DURATION),
    [signalFrequency, sampleRate],
  )
  const apparentWave = useMemo(
    () =>
      aliasing && alias !== null
        ? generateAnalogWave(alias, AMPLITUDE, DURATION)
        : null,
    [aliasing, alias],
  )

  const analogPath = pointsToPath(analogWave, DOMAIN, CHART_WIDTH, CHART_HEIGHT)
  const apparentPath = apparentWave ? pointsToPath(apparentWave, DOMAIN, CHART_WIDTH, CHART_HEIGHT) : null
  const renderedSamples = samples.length <= MAX_RENDERED_SAMPLES ? samples : []

  const explanation = aliasing
    ? `Estás tomando ${formatNumber(sampleRate)} muestras por segundo para una señal de ${formatNumber(signalFrequency)} Hz. Como la señal supera el límite de Nyquist (${formatNumber(nyquist)} Hz), el sistema no puede distinguirla de una señal de ${formatNumber(alias ?? 0)} Hz: esto es aliasing.`
    : `Estás tomando ${formatNumber(sampleRate)} muestras por segundo. Según Nyquist, este sistema puede representar frecuencias de hasta aproximadamente ${formatNumber(nyquist)} Hz, así que la señal de ${formatNumber(signalFrequency)} Hz se representa correctamente.`

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
            const { x, y } = toScreen(s, DOMAIN, CHART_WIDTH, CHART_HEIGHT)
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Frecuencia de la señal
              <span className="text-purple-300">{formatNumber(signalFrequency)} Hz</span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={signalFrequency}
              onChange={(e) => setSignalFrequency(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Sample Rate
              <span className="text-purple-300">{formatNumber(sampleRate)} Hz</span>
            </label>
            <input
              type="range"
              min={4}
              max={200}
              step={1}
              value={Math.min(sampleRate, 200)}
              onChange={(e) => setSampleRate(Number(e.target.value))}
              className="mt-2 w-full"
            />
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
            <Stat label="Señal" value={`${formatNumber(signalFrequency)} Hz`} />
            <Stat label="Sample Rate" value={`${formatNumber(sampleRate)} Hz`} />
            {showNyquist && <Stat label="Nyquist" value={`${formatNumber(nyquist)} Hz`} />}
            <Stat
              label="Estado"
              value={aliasing ? '⚠ Aliasing' : '✓ Representable'}
              tone={aliasing ? 'warn' : 'ok'}
            />
          </div>

          {showNyquist && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
              Sample Rate ({formatNumber(sampleRate)} Hz) ÷ 2 = Nyquist ({formatNumber(nyquist)} Hz)
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
