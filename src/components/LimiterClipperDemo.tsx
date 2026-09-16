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
const CHART_WIDTH = 820
const CHART_HEIGHT = 260

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
  const [visible, setVisible] = useState({
    original: true,
    limiter: true,
    clipper: true,
    threshold: true,
    ceiling: true,
    gainReduction: true,
  })
  const toggleVisible = (key: keyof typeof visible) => setVisible((v) => ({ ...v, [key]: !v[key] }))

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
  const originalPath = pointsToPath(gainedWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const limiterPath = pointsToPath(limiterResult.wave, domain, CHART_WIDTH, CHART_HEIGHT)
  const clipperPath = pointsToPath(clipperResult.wave, domain, CHART_WIDTH, CHART_HEIGHT)

  // Maps the -24..0 dB gain-reduction range onto the same pixel space as the waveform, so it renders as an extra line.
  const grDomain: ChartDomain = useMemo(() => ({ xMin: 0, xMax: windowSec, yMin: -24, yMax: 0 }), [windowSec])
  const grPath = pointsToPath(limiterResult.gainReductionDb, grDomain, CHART_WIDTH, CHART_HEIGHT)

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_170px]">
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <ComparisonPanel
              title="Original vs Limiter"
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              thresholdTop={thresholdTop}
              thresholdBottom={thresholdBottom}
              showThreshold={visible.threshold}
              ceilingTop={ceilingTop}
              ceilingBottom={ceilingBottom}
              showCeiling={visible.ceiling}
              originalPath={originalPath}
              showOriginal={visible.original}
              processedPath={limiterPath}
              processedColor="#22d3ee"
              showProcessed={visible.limiter}
              extraPaths={visible.gainReduction ? [{ d: grPath, color: '#c084fc', dash: '2 2', width: 2 }] : []}
            />

            <ComparisonPanel
              title="Original vs Clipper"
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              thresholdTop={thresholdTop}
              thresholdBottom={thresholdBottom}
              showThreshold={visible.threshold}
              ceilingTop={ceilingTop}
              ceilingBottom={ceilingBottom}
              showCeiling={visible.ceiling}
              originalPath={originalPath}
              showOriginal={visible.original}
              processedPath={clipperPath}
              processedColor="#f97316"
              showProcessed={visible.clipper}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <LegendItem color="#64748b" label="Original" checked={visible.original} onChange={() => toggleVisible('original')} />
            <LegendItem color="#22d3ee" label="Limiter" checked={visible.limiter} onChange={() => toggleVisible('limiter')} />
            <LegendItem color="#f97316" label="Clipper" checked={visible.clipper} onChange={() => toggleVisible('clipper')} />
            <LegendItem color="#fcd34d" label="Umbral (Threshold)" checked={visible.threshold} onChange={() => toggleVisible('threshold')} />
            <LegendItem color="#f87171" label="Ceiling" checked={visible.ceiling} onChange={() => toggleVisible('ceiling')} />
            <LegendItem color="#c084fc" label="Gain reduction (limiter)" checked={visible.gainReduction} onChange={() => toggleVisible('gainReduction')} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-5">
            <div>
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

            <div className="grid gap-5 border-t border-slate-800 pt-4 sm:grid-cols-3">
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

              <div className="sm:col-span-3">
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
        </div>

        <div className="grid gap-2 content-start grid-cols-2 lg:grid-cols-1">
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
  showThreshold,
  ceilingTop,
  ceilingBottom,
  showCeiling,
  originalPath,
  showOriginal,
  processedPath,
  processedColor,
  showProcessed,
  extraPaths,
  extraLabel,
}: {
  title: string
  width: number
  height: number
  thresholdTop: number
  thresholdBottom: number
  showThreshold: boolean
  ceilingTop: number
  ceilingBottom: number
  showCeiling: boolean
  originalPath: string
  showOriginal: boolean
  processedPath: string
  processedColor: string
  showProcessed: boolean
  extraPaths?: { d: string; color: string; width?: number; dash?: string; opacity?: number }[]
  extraLabel?: string
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Forma de onda: ${title}`}>
        {showCeiling && (
          <>
            <line x1={0} y1={ceilingTop} x2={width} y2={ceilingTop} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
            <line x1={0} y1={ceilingBottom} x2={width} y2={ceilingBottom} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
          </>
        )}
        {showThreshold && (
          <>
            <line x1={0} y1={thresholdTop} x2={width} y2={thresholdTop} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
            <line x1={0} y1={thresholdBottom} x2={width} y2={thresholdBottom} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          </>
        )}
        {showOriginal && (
          <path d={originalPath} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
        )}
        {showProcessed && <path d={processedPath} fill="none" stroke={processedColor} strokeWidth={2.5} />}
        {extraPaths?.map((ep, i) => (
          <path
            key={i}
            d={ep.d}
            fill="none"
            stroke={ep.color}
            strokeWidth={ep.width ?? 1.5}
            strokeDasharray={ep.dash}
            opacity={ep.opacity ?? 0.9}
          />
        ))}
      </svg>
      {extraLabel && <p className="mt-1 text-[10px] text-slate-500">{extraLabel}</p>}
    </div>
  )
}

function LegendItem({
  color,
  label,
  checked,
  onChange,
}: {
  color: string
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-400">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3 w-3 accent-purple-500" />
      <span className="h-2 w-4 rounded" style={{ backgroundColor: color }} />
      {label}
    </label>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-red-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-100'
  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  )
}
