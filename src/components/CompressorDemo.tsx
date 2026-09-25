import { useMemo, useState } from 'react'
import {
  applyCompressor,
  applyLimiter,
  compressorOutputDb,
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
const RESOLUTION = 2000
const DT = DURATION / RESOLUTION
const CHART_WIDTH = 820
const CHART_HEIGHT = 300
const CURVE_SIZE = 380
const CURVE_MIN_DB = -40
const CURVE_MAX_DB = 6

type CompressorType = 'VCA' | 'FET' | 'Optical' | 'Vari-Mu' | 'Digital'

const TYPE_INFO: Record<CompressorType, { description: string[]; attackMs: number; releaseMs: number }> = {
  VCA: {
    description: ['Preciso y controlado.', 'Ataque rápido.', 'Común en buses, batería y control dinámico general.'],
    attackMs: 5,
    releaseMs: 120,
  },
  FET: {
    description: ['Rápido y con carácter.', 'Útil para transientes, voces y batería.', 'Puede añadir color/distorsión.'],
    attackMs: 0.5,
    releaseMs: 90,
  },
  Optical: {
    description: ['Respuesta más suave y dependiente de la señal.', 'Compresión natural.', 'Común en voces y bajos.'],
    attackMs: 25,
    releaseMs: 350,
  },
  'Vari-Mu': {
    description: ['Compresión suave y musical.', 'Suele añadir color armónico.', 'Común en buses y mastering.'],
    attackMs: 35,
    releaseMs: 450,
  },
  Digital: {
    description: [
      'Muy flexible y preciso.',
      'Puede ser transparente.',
      'Permite diseños y tiempos difíciles de conseguir en hardware analógico.',
    ],
    attackMs: 0.1,
    releaseMs: 150,
  },
}

const USE_CASES = [
  'Controlar picos de una voz.',
  'Estabilizar un bajo.',
  'Dar más consistencia a una interpretación.',
  'Controlar la dinámica de una batería.',
  'Dar cohesión a un bus.',
  'Modificar transientes.',
  'Aumentar la sensación de sustain.',
]

const SUMMARY = [
  { param: 'Threshold', question: '¿Cuándo empieza?' },
  { param: 'Ratio', question: '¿Cuánto comprime?' },
  { param: 'Attack', question: '¿Qué tan rápido entra?' },
  { param: 'Release', question: '¿Qué tan rápido sale?' },
  { param: 'Makeup', question: '¿Cuánto nivel recuperamos?' },
]

function ratioLabel(ratio: number): string {
  return ratio >= 20 ? '∞:1' : `${formatNumber(ratio)}:1`
}

type KneeType = 'hard' | 'soft'

const KNEE_INFO: Record<KneeType, { title: string; description: string }> = {
  hard: {
    title: 'Hard Knee (Rodilla Dura)',
    description:
      'El gráfico forma un ángulo agudo y afilado justo en el umbral. La compresión pasa de 0% a 100% de forma instantánea y matemática en cuanto la señal supera el límite.',
  },
  soft: {
    title: 'Soft Knee (Rodilla Suave)',
    description:
      'El gráfico muestra una curva sutil y redondeada alrededor del umbral. La compresión empieza a aplicarse de forma gradual un poco antes de llegar al umbral y no alcanza su proporción total (ratio) hasta que la señal supere por completo esa zona curvada.',
  },
}

type SubTab = 'general' | 'curve'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'curve', label: 'Curva Input / Output' },
]

export default function CompressorDemo({ presentationMode }: { presentationMode: boolean }) {
  const [inputGainDb, setInputGainDb] = useState(6)
  const [thresholdDb, setThresholdDb] = useState(-24)
  const [ratio, setRatio] = useState(4)
  const [attackMs, setAttackMs] = useState(10)
  const [releaseMs, setReleaseMs] = useState(150)
  const [makeupDb, setMakeupDb] = useState(0)
  const [ceilingDb, setCeilingDb] = useState(-1)
  const [compressorType, setCompressorType] = useState<CompressorType | null>(null)
  const [windowMs, setWindowMs] = useState(WINDOW_MS_MAX)
  const [kneeType, setKneeType] = useState<KneeType>('hard')
  const [kneeWidthDb, setKneeWidthDb] = useState(6)
  const [subTab, setSubTab] = useState<SubTab>('general')

  const effectiveKneeWidthDb = kneeType === 'soft' ? kneeWidthDb : 0

  const rawWave = useMemo(() => generateTransientWave(DURATION, RESOLUTION), [])
  const gainedWave = useMemo(
    () => rawWave.map((p) => ({ t: p.t, y: p.y * dbfsToLinear(inputGainDb) })),
    [rawWave, inputGainDb],
  )

  const compResult = useMemo(
    () => applyCompressor(gainedWave, DT, thresholdDb, ratio, attackMs, releaseMs, makeupDb, effectiveKneeWidthDb),
    [gainedWave, thresholdDb, ratio, attackMs, releaseMs, makeupDb, effectiveKneeWidthDb],
  )
  const limiterResult = useMemo(
    () => applyLimiter(gainedWave, dbfsToLinear(ceilingDb), dbfsToLinear(ceilingDb)),
    [gainedWave, ceilingDb],
  )

  const peakInputLinear = Math.max(...gainedWave.map((p) => Math.abs(p.y)))
  const peakOutputLinear = Math.max(...compResult.wave.map((p) => Math.abs(p.y)))
  const peakInputDb = linearToDbfs(peakInputLinear)
  const peakOutputDb = linearToDbfs(peakOutputLinear)

  const windowSec = windowMs / 1000
  const framePeak = Math.max(1.2, Math.max(peakInputLinear, peakOutputLinear) * 1.15)
  const domain: ChartDomain = useMemo(
    () => ({ xMin: 0, xMax: windowSec, yMin: -framePeak, yMax: framePeak }),
    [windowSec, framePeak],
  )
  const grDomain: ChartDomain = useMemo(() => ({ xMin: 0, xMax: windowSec, yMin: -24, yMax: 0 }), [windowSec])

  const originalPath = pointsToPath(gainedWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const compressedPath = pointsToPath(compResult.wave, domain, CHART_WIDTH, CHART_HEIGHT)
  const grPath = pointsToPath(compResult.gainReductionDb, grDomain, CHART_WIDTH, CHART_HEIGHT)
  const limiterPath = pointsToPath(limiterResult.wave, domain, CHART_WIDTH, CHART_HEIGHT)
  const limiterGrPath = pointsToPath(limiterResult.gainReductionDb, grDomain, CHART_WIDTH, CHART_HEIGHT)

  const thresholdLinear = dbfsToLinear(thresholdDb)
  const thresholdTop = toScreen({ t: 0, y: thresholdLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const thresholdBottom = toScreen({ t: 0, y: -thresholdLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingLinear = dbfsToLinear(ceilingDb)
  const ceilingTop = toScreen({ t: 0, y: ceilingLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingBottom = toScreen({ t: 0, y: -ceilingLinear }, domain, CHART_WIDTH, CHART_HEIGHT).y

  // Static transfer curve: output dB for every possible input dB, at the current threshold/ratio/makeup.
  const curveYMax = Math.max(CURVE_MAX_DB, CURVE_MAX_DB + makeupDb)
  const curveDomain: ChartDomain = useMemo(
    () => ({ xMin: CURVE_MIN_DB, xMax: CURVE_MAX_DB, yMin: CURVE_MIN_DB, yMax: curveYMax }),
    [curveYMax],
  )
  const curvePoints = useMemo(() => {
    const points: { t: number; y: number }[] = []
    for (let db = CURVE_MIN_DB; db <= CURVE_MAX_DB; db += 0.5) {
      points.push({ t: db, y: compressorOutputDb(db, thresholdDb, ratio, effectiveKneeWidthDb) + makeupDb })
    }
    return points
  }, [thresholdDb, ratio, makeupDb, effectiveKneeWidthDb])
  const curvePath = pointsToPath(curvePoints, curveDomain, CURVE_SIZE, CURVE_SIZE)
  const referencePath = pointsToPath(
    [
      { t: CURVE_MIN_DB, y: CURVE_MIN_DB },
      { t: CURVE_MAX_DB, y: CURVE_MAX_DB },
    ],
    curveDomain,
    CURVE_SIZE,
    CURVE_SIZE,
  )
  const thresholdCurveX = toScreen({ t: thresholdDb, y: 0 }, curveDomain, CURVE_SIZE, CURVE_SIZE).x
  const currentInputPoint = toScreen(
    { t: peakInputDb, y: compressorOutputDb(peakInputDb, thresholdDb, ratio, effectiveKneeWidthDb) + makeupDb },
    curveDomain,
    CURVE_SIZE,
    CURVE_SIZE,
  )

  // In presentation mode, sections flow into balanced columns instead of one tall stack.
  const sectionClass = presentationMode ? 'mb-6 break-inside-avoid' : ''

  return (
    <div className="p-6">
      <nav className="mb-4 flex flex-wrap gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              subTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {subTab === 'general' && (
        <div
          className={`${
            presentationMode
              ? 'columns-1 gap-6 max-w-none lg:columns-2 2xl:columns-3'
              : 'grid max-w-5xl mx-auto gap-6'
          }`}
        >
      <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${sectionClass}`}>
        <h2 className="text-sm font-semibold text-slate-200">Compresor</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <strong className="text-slate-100">Un compresor reduce el rango dinámico disminuyendo el nivel de una
          señal cuando supera un threshold.</strong> No se usa únicamente para hacer una señal más fuerte;
          principalmente controla su dinámica.
        </p>
      </div>

      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${sectionClass}`}>
        <Stat label="Input Level" value={`${formatNumber(peakInputDb)} dBFS`} />
        <Stat label="Threshold" value={`${formatNumber(thresholdDb)} dBFS`} />
        <Stat label="Output Level" value={`${formatNumber(peakOutputDb)} dBFS`} tone="ok" />
        <Stat
          label="Gain Reduction"
          value={`${formatNumber(compResult.maxGainReductionDb)} dB`}
          tone={compResult.maxGainReductionDb < -0.05 ? 'warn' : 'ok'}
        />
      </div>

      <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${sectionClass}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Waveform: original, threshold, comprimida y gain reduction
        </p>
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-auto" role="img" aria-label="Forma de onda del compresor">
          <line x1={0} y1={thresholdTop} x2={CHART_WIDTH} y2={thresholdTop} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <line x1={0} y1={thresholdBottom} x2={CHART_WIDTH} y2={thresholdBottom} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <path d={originalPath} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
          <path d={compressedPath} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
          <path d={grPath} fill="none" stroke="#c084fc" strokeWidth={1.5} strokeDasharray="2 2" opacity={0.9} />
        </svg>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
          <LegendItem color="#64748b" label="Original" />
          <LegendItem color="#fcd34d" label="Threshold" />
          <LegendItem color="#22d3ee" label="Comprimida" />
          <LegendItem color="#c084fc" label="Gain reduction" />
        </div>

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
            onChange={(e) => setWindowMs(logSliderToWindowMs(Number(e.target.value)))}
            className="mt-2 w-full"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatWindowMs(WINDOW_MS_MIN)}</span>
            {windowMs !== WINDOW_MS_MAX && (
              <button type="button" onClick={() => setWindowMs(WINDOW_MS_MAX)} className="text-purple-300 hover:underline">
                Ver ventana completa
              </button>
            )}
            <span>{formatWindowMs(WINDOW_MS_MAX)}</span>
          </div>
        </div>
      </div>

      <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${sectionClass}`}>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Tipo de compresor</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_INFO) as CompressorType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setCompressorType(type)
                setAttackMs(TYPE_INFO[type].attackMs)
                setReleaseMs(TYPE_INFO[type].releaseMs)
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                compressorType === type
                  ? 'border-purple-500 bg-purple-600/20 text-purple-200'
                  : 'border-slate-700 text-slate-200 hover:border-purple-500'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        {compressorType && (
          <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-slate-400">
            {TYPE_INFO[compressorType].description.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          Estas descripciones no son reglas absolutas: son tendencias de comportamiento típicas de cada topología.
        </p>
      </div>

      <div className={sectionClass}>
        <p className="mb-2 text-sm font-medium text-slate-200">¿Cuándo usar compresión?</p>
        <ul className="grid list-inside list-disc grid-cols-1 gap-1 text-sm text-slate-300 sm:grid-cols-2">
          {USE_CASES.map((useCase) => (
            <li key={useCase}>{useCase}</li>
          ))}
        </ul>
      </div>

      <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${sectionClass}`}>
        <h3 className="text-sm font-semibold text-slate-200">Compresor vs Limiter</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <strong className="text-slate-100">Compressor:</strong> reduce progresivamente la dinámica; con un
          ratio de {ratioLabel(ratio)} los picos siguen superando el threshold, pero en menor cantidad.{' '}
          <strong className="text-slate-100">Limiter:</strong> con un ratio muy alto (∞:1) intenta impedir que la
          salida supere el ceiling.
        </p>

        <div className="mt-3">
          <Slider label="Ceiling (limiter)" value={ceilingDb} min={-12} max={0} step={0.1} unit="dB" onChange={setCeilingDb} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Compressor · Ratio {ratioLabel(ratio)}
            </p>
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-auto" role="img" aria-label="Compressor">
              <line x1={0} y1={thresholdTop} x2={CHART_WIDTH} y2={thresholdTop} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <line x1={0} y1={thresholdBottom} x2={CHART_WIDTH} y2={thresholdBottom} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <path d={originalPath} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
              <path d={compressedPath} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
              <path d={grPath} fill="none" stroke="#c084fc" strokeWidth={1.5} strokeDasharray="2 2" opacity={0.9} />
            </svg>
            <p className="mt-1 text-[11px] text-slate-500">Gain reduction máxima: {formatNumber(compResult.maxGainReductionDb)} dB</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Limiter · Ceiling {formatNumber(ceilingDb)} dB</p>
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-auto" role="img" aria-label="Limiter">
              <line x1={0} y1={ceilingTop} x2={CHART_WIDTH} y2={ceilingTop} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
              <line x1={0} y1={ceilingBottom} x2={CHART_WIDTH} y2={ceilingBottom} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
              <path d={originalPath} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
              <path d={limiterPath} fill="none" stroke="#f97316" strokeWidth={2.5} />
              <path d={limiterGrPath} fill="none" stroke="#c084fc" strokeWidth={1.5} strokeDasharray="2 2" opacity={0.9} />
            </svg>
            <p className="mt-1 text-[11px] text-slate-500">Gain reduction máxima: {formatNumber(limiterResult.maxGainReductionDb)} dB</p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          <strong className="text-slate-100">Compressor</strong> = controla la dinámica.{' '}
          <strong className="text-slate-100">Limiter</strong> = controla el máximo nivel de salida.
        </p>
      </div>

      <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-4 ${sectionClass}`}>
        <p className="mb-2 text-sm font-medium text-slate-200">Resumen</p>
        <ul className="space-y-1 text-sm text-slate-300">
          {SUMMARY.map((s) => (
            <li key={s.param}>
              <strong className="text-slate-100">{s.param}</strong> → {s.question}
            </li>
          ))}
        </ul>
      </div>
    </div>
      )}

      {subTab === 'curve' && (
        <div
          className={`@container grid gap-6 @lg:grid-cols-[minmax(0,1fr)_340px] ${
            presentationMode ? '' : 'max-w-5xl mx-auto'
          }`}
        >
          <div className="@container space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="grid gap-5 @sm:grid-cols-2">
              <Slider label="Input Level" value={inputGainDb} min={-24} max={12} step={0.5} unit="dB" onChange={setInputGainDb} />
              <Slider label="Threshold" value={thresholdDb} min={-40} max={0} step={0.5} unit="dB" onChange={setThresholdDb} />
              <RatioSlider value={ratio} onChange={setRatio} />
              <Slider label="Makeup Gain" value={makeupDb} min={0} max={24} step={0.5} unit="dB" onChange={setMakeupDb} />
              <Slider label="Attack" value={attackMs} min={0.1} max={50} step={0.1} unit="ms" onChange={setAttackMs} />
              <Slider label="Release" value={releaseMs} min={10} max={1000} step={5} unit="ms" onChange={setReleaseMs} />
            </div>

            <div className="grid gap-3 @sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium text-slate-200">Threshold</p>
                <p className="text-xs text-slate-400">Nivel desde donde empieza la compresión.</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-200">Ratio</p>
                <p className="text-xs text-slate-400">Cuánto se reduce lo que supera el threshold.</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-200">Attack</p>
                <p className="text-xs text-slate-400">Qué tan rápido empieza a comprimir.</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-200">Release</p>
                <p className="text-xs text-slate-400">Qué tan rápido deja de comprimir.</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-200">Makeup Gain</p>
                <p className="text-xs text-slate-400">Recupera nivel después de comprimir.</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-200">Knee</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KNEE_INFO) as KneeType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setKneeType(type)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      kneeType === type
                        ? 'border-purple-500 bg-purple-600/20 text-purple-200'
                        : 'border-slate-700 text-slate-200 hover:border-purple-500'
                    }`}
                  >
                    {KNEE_INFO[type].title}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">{KNEE_INFO[kneeType].description}</p>
              {kneeType === 'soft' && (
                <div className="mt-3">
                  <Slider label="Knee Width" value={kneeWidthDb} min={1} max={24} step={0.5} unit="dB" onChange={setKneeWidthDb} />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Curva Input / Output
            </p>
            <svg viewBox={`0 0 ${CURVE_SIZE} ${CURVE_SIZE}`} className="w-full h-auto" role="img" aria-label="Curva input/output del compresor">
              <line x1={thresholdCurveX} y1={0} x2={thresholdCurveX} y2={CURVE_SIZE} stroke="#fcd34d" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
              <path d={referencePath} fill="none" stroke="#475569" strokeWidth={1} strokeDasharray="4 3" />
              <path d={curvePath} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
              <circle cx={currentInputPoint.x} cy={currentInputPoint.y} r={4} fill="#f87171" />
            </svg>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
              <LegendItem color="#475569" label="Referencia 1:1 (sin compresión)" />
              <LegendItem color="#fcd34d" label="Threshold" />
              <LegendItem color="#22d3ee" label={`Curva del compresor (${kneeType === 'soft' ? 'Soft Knee' : 'Hard Knee'})`} />
              <LegendItem color="#f87171" label="Nivel de entrada actual" />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Antes del threshold ({formatNumber(thresholdDb)} dB): entrada ≈ salida. Después, la pendiente
              disminuye según el ratio ({ratioLabel(ratio)}). El punto rojo es el nivel de entrada actual.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-sm font-medium text-slate-200">
        {label}
        <span className="text-purple-300">
          {value > 0 && unit === 'dB' ? '+' : ''}
          {formatNumber(value)} {unit}
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
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  )
}

function RatioSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="flex items-center justify-between text-sm font-medium text-slate-200">
        Ratio
        <span className="text-purple-300">{ratioLabel(value)}</span>
      </label>
      <input
        type="range"
        min={1}
        max={20}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>1:1</span>
        <span>∞:1</span>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-4 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-red-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-100'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  )
}
