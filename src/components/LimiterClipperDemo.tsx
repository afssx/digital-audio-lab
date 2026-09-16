import { useMemo, useState } from 'react'
import {
  applyClipper,
  applyLimiter,
  dbfsToLinear,
  formatNumber,
  generateTransientWave,
  linearToDbfs,
} from '../lib/signal'
import { pointsToPath, toScreen, type ChartDomain } from '../lib/chart'
import {
  WINDOW_MS_MAX,
  WINDOW_MS_MIN,
  LOG_WINDOW_MS_MIN,
  LOG_WINDOW_MS_MAX,
  formatWindowMs,
  logSliderToWindowMs,
  windowMsToLogSlider,
} from '../lib/zoom'

const DURATION = 1
const RESOLUTION = 2000 // dense enough to stay smooth when zoomed into a small time window
const CHART_WIDTH = 720
const CHART_HEIGHT = 220
const GR_CHART_HEIGHT = 64

type Preset = {
  label: string
  inputGainDb: number
  thresholdDb: number
  ceilingDb: number
  description: string
}

const PRESETS: Preset[] = [
  {
    label: 'Neutro',
    inputGainDb: 0,
    thresholdDb: 0,
    ceilingDb: 0,
    description: 'Sin ganancia extra y umbral al techo: ninguno de los dos procesadores actúa.',
  },
  {
    label: 'Suave',
    inputGainDb: 4,
    thresholdDb: -6,
    ceilingDb: -1,
    description: 'Poca ganancia extra: los picos apenas tocan el umbral, la diferencia entre limiter y clipper es sutil.',
  },
  {
    label: 'Moderado',
    inputGainDb: 10,
    thresholdDb: -9,
    ceilingDb: -0.5,
    description: 'Ganancia media: el limiter ya reduce ganancia de forma audible y el clipper empieza a aplanar picos.',
  },
  {
    label: 'Extremo',
    inputGainDb: 20,
    thresholdDb: -14,
    ceilingDb: -0.1,
    description: 'Mucha ganancia de entrada: el limiter aplasta la dinámica con gain reduction fuerte, y el clipper recorta y distorsiona agresivamente la forma de onda.',
  },
]

export default function LimiterClipperDemo({ presentationMode }: { presentationMode: boolean }) {
  const [inputGainDb, setInputGainDb] = useState(4)
  const [thresholdDb, setThresholdDb] = useState(-6)
  const [ceilingDb, setCeilingDb] = useState(-1)
  const [presetInfo, setPresetInfo] = useState<string | null>(null)
  const [windowMs, setWindowMs] = useState(WINDOW_MS_MAX)

  const inputGainLinear = dbfsToLinear(inputGainDb)
  const thresholdLinear = dbfsToLinear(thresholdDb)
  const ceilingLinear = dbfsToLinear(ceilingDb)

  const rawWave = useMemo(() => generateTransientWave(DURATION, RESOLUTION), [])
  const gainedWave = useMemo(
    () => rawWave.map((p) => ({ t: p.t, y: p.y * inputGainLinear })),
    [rawWave, inputGainLinear],
  )

  const limiterResult = useMemo(
    () => applyLimiter(gainedWave, thresholdLinear, ceilingLinear),
    [gainedWave, thresholdLinear, ceilingLinear],
  )
  const clipperResult = useMemo(
    () => applyClipper(gainedWave, thresholdLinear, ceilingLinear),
    [gainedWave, thresholdLinear, ceilingLinear],
  )

  const peakInputLinear = Math.max(...gainedWave.map((p) => Math.abs(p.y)))
  const peakLimiterLinear = Math.max(...limiterResult.wave.map((p) => Math.abs(p.y)))
  const peakClipperLinear = Math.max(...clipperResult.wave.map((p) => Math.abs(p.y)))

  const peakInputDb = linearToDbfs(peakInputLinear)
  const peakLimiterDb = linearToDbfs(peakLimiterLinear)
  const peakClipperDb = linearToDbfs(peakClipperLinear)

  // Same zoom convention as the other tabs: full window (1000 ms) = 1x, from t = 0.
  const windowSec = windowMs / 1000

  const framePeak = Math.max(1.2, peakInputLinear * 1.15)
  const domain: ChartDomain = useMemo(
    () => ({ xMin: 0, xMax: windowSec, yMin: -framePeak, yMax: framePeak }),
    [windowSec, framePeak],
  )
  const grDomain: ChartDomain = useMemo(() => ({ xMin: 0, xMax: windowSec, yMin: -24, yMax: 0 }), [windowSec])

  const originalPath = pointsToPath(gainedWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const limiterPath = pointsToPath(limiterResult.wave, domain, CHART_WIDTH, CHART_HEIGHT)
  const clipperPath = pointsToPath(clipperResult.wave, domain, CHART_WIDTH, CHART_HEIGHT)
  const grPath = pointsToPath(limiterResult.gainReductionDb, grDomain, CHART_WIDTH, GR_CHART_HEIGHT)

  const thresholdTop = toScreen({ t: 0, y: thresholdLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const thresholdBottom = toScreen({ t: 0, y: -thresholdLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingTop = toScreen({ t: 0, y: ceilingLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingBottom = toScreen({ t: 0, y: -ceilingLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y

  const clippingPercent = clipperResult.clippedSamplesRatio * 100

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Limiter vs Clipper</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Ambos evitan que la señal supere un nivel máximo, pero de forma muy distinta.{' '}
          <strong className="text-slate-100">Limiter:</strong> reduce la ganancia dinámicamente (gain reduction)
          para que los picos no superen el umbral, preservando la forma general de la onda.{' '}
          <strong className="text-slate-100">Clipper:</strong> corta directamente la forma de onda apenas supera
          el umbral, generando bordes planos y distorsión armónica.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
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
              onChange={(e) => setWindowMs(logSliderToWindowMs(Number(e.target.value)))}
              className="mt-2 w-full"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{formatWindowMs(WINDOW_MS_MIN)}</span>
              {windowMs !== WINDOW_MS_MAX && (
                <button
                  type="button"
                  onClick={() => setWindowMs(WINDOW_MS_MAX)}
                  className="text-purple-300 hover:underline"
                >
                  Ver ventana completa
                </button>
              )}
              <span>{formatWindowMs(WINDOW_MS_MAX)}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ComparisonPanel
              title="Original vs Limiter"
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              thresholdTop={thresholdTop}
              thresholdBottom={thresholdBottom}
              ceilingTop={ceilingTop}
              ceilingBottom={ceilingBottom}
              originalPath={originalPath}
              processedPath={limiterPath}
              processedColor="#22d3ee"
            >
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Gain reduction en el tiempo</p>
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${GR_CHART_HEIGHT}`}
                className="w-full h-auto"
                role="img"
                aria-label="Gain reduction del limiter en el tiempo"
              >
                <path d={grPath} fill="none" stroke="#22d3ee" strokeWidth={2} />
              </svg>
            </ComparisonPanel>

            <ComparisonPanel
              title="Original vs Clipper"
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              thresholdTop={thresholdTop}
              thresholdBottom={thresholdBottom}
              ceilingTop={ceilingTop}
              ceilingBottom={ceilingBottom}
              originalPath={originalPath}
              processedPath={clipperPath}
              processedColor="#f97316"
            />
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-500" /> Original</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-cyan-400" /> Limiter</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-orange-400" /> Clipper</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-amber-300" /> Umbral (Threshold)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-400" /> Ceiling</span>
          </div>
        </div>

        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4 h-fit">
          <Slider
            label="Input Gain"
            value={inputGainDb}
            min={-6}
            max={24}
            step={0.5}
            onChange={setInputGainDb}
          />
          <Slider
            label="Threshold"
            value={thresholdDb}
            min={-24}
            max={0}
            step={0.5}
            onChange={setThresholdDb}
          />
          <Slider
            label="Output / Ceiling"
            value={ceilingDb}
            min={-12}
            max={0}
            step={0.1}
            onChange={setCeilingDb}
          />

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setInputGainDb(p.inputGainDb)
                    setThresholdDb(p.thresholdDb)
                    setCeilingDb(p.ceilingDb)
                    setPresetInfo(p.description)
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-purple-500"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {presetInfo && <p className="mt-2 text-xs text-slate-400">{presetInfo}</p>}
          </div>
        </div>
      </div>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Peak Input" value={`${peakInputDb > 0 ? '+' : ''}${formatNumber(peakInputDb)} dBFS`} />
        <Stat
          label="Peak Output (Limiter)"
          value={`${peakLimiterDb > 0 ? '+' : ''}${formatNumber(peakLimiterDb)} dBFS`}
          tone="ok"
        />
        <Stat
          label="Peak Output (Clipper)"
          value={`${peakClipperDb > 0 ? '+' : ''}${formatNumber(peakClipperDb)} dBFS`}
          tone={clippingPercent > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Gain Reduction máxima"
          value={`${formatNumber(limiterResult.maxGainReductionDb)} dB`}
          tone={limiterResult.maxGainReductionDb < -0.05 ? 'warn' : 'ok'}
        />
        <Stat
          label="Muestras recortadas (clipper)"
          value={`${formatNumber(clippingPercent)} %`}
          tone={clippingPercent > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <p className="mb-1 font-medium text-slate-300">¿Por qué se ven distintos?</p>
        <p>
          El limiter usa un seguidor de envolvente (attack/release) que anticipa los picos y baja la ganancia
          progresivamente, por eso la curva de gain reduction sube y baja suavemente y la forma de onda mantiene
          sus curvas. El clipper no mide nada: en cuanto una muestra supera el umbral, la trunca a ese valor de
          forma instantánea, dejando bordes planos que agregan armónicos (distorsión). El control Output/Ceiling
          fija además un límite final duro (tipo true-peak) que ninguno de los dos puede superar.
        </p>
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-sm font-medium text-slate-200">
        {label}
        <span className="text-purple-300">
          {value > 0 ? '+' : ''}
          {formatNumber(value)} dB
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{min} dB</span>
        <span>{max} dB</span>
      </div>
    </div>
  )
}

function ComparisonPanel({
  title,
  width,
  height,
  thresholdTop,
  thresholdBottom,
  ceilingTop,
  ceilingBottom,
  originalPath,
  processedPath,
  processedColor,
  children,
}: {
  title: string
  width: number
  height: number
  thresholdTop: number
  thresholdBottom: number
  ceilingTop: number
  ceilingBottom: number
  originalPath: string
  processedPath: string
  processedColor: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Forma de onda: ${title}`}>
        <line x1={0} y1={ceilingTop} x2={width} y2={ceilingTop} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
        <line x1={0} y1={ceilingBottom} x2={width} y2={ceilingBottom} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
        <line x1={0} y1={thresholdTop} x2={width} y2={thresholdTop} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <line x1={0} y1={thresholdBottom} x2={width} y2={thresholdBottom} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <path d={originalPath} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
        <path d={processedPath} fill="none" stroke={processedColor} strokeWidth={2.5} />
      </svg>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-red-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-100'
  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}
