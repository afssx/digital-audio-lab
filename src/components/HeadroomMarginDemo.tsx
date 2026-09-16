import { useMemo, useState } from 'react'
import { clampToFullScale, dbfsToLinear, formatNumber, generateAnalogWave } from '../lib/signal'
import { pointsToPath, toScreen, type ChartDomain } from '../lib/chart'

const SIGNAL_FREQUENCY = 4
const DURATION = 1
const CHART_WIDTH = 800
const CHART_HEIGHT = 220
const METER_MIN = -30
const METER_MAX = 6
const PEAK_MIN = -30
const PEAK_MAX = 3

type Preset = { label: string; peakLevelDb: number; description: string }

const PRESETS: Preset[] = [
  { label: 'Mucho margen (-18 dBFS)', peakLevelDb: -18, description: 'El pico queda lejos del techo: mucho headroom disponible para absorber picos inesperados.' },
  { label: 'Mezcla (-6 dBFS)', peakLevelDb: -6, description: 'Un nivel de referencia común al mezclar: deja un margen cómodo sin desperdiciar rango dinámico.' },
  { label: 'Cerca del límite (-1 dBFS)', peakLevelDb: -1, description: 'Casi sin margen: cualquier transitorio extra puede hacer clipping.' },
  { label: 'Clipping (+3 dBFS)', peakLevelDb: 3, description: 'El pico superó 0 dBFS: el sistema ya no puede representar la señal y la recorta.' },
]

// Relative analog scale (dB around the 0 VU reference) used only to place the Input Level on the zone diagram.
const ANALOG_ZONE_BOUNDARIES = {
  noiseFloorTop: -36,
  lowSignalTop: -20,
  normalOperatingTop: -4,
  nominalTop: 1,
  headroomNearOverload: 6,
  overloadStart: 9,
}

type AnalogZoneId = 'noiseFloor' | 'lowSignal' | 'normalOperating' | 'nominal' | 'headroom' | 'overload'

function getAnalogZone(inputLevel: number): { zone: AnalogZoneId; status: string } {
  const b = ANALOG_ZONE_BOUNDARIES
  if (inputLevel <= b.noiseFloorTop) return { zone: 'noiseFloor', status: 'Signal too low / Poor SNR' }
  if (inputLevel <= b.lowSignalTop) return { zone: 'lowSignal', status: 'Signal too low / Poor SNR' }
  if (inputLevel <= b.normalOperatingTop) return { zone: 'normalOperating', status: 'Healthy operating level' }
  if (inputLevel <= b.nominalTop) return { zone: 'nominal', status: 'Nominal operating level' }
  if (inputLevel <= b.headroomNearOverload) return { zone: 'headroom', status: 'Using headroom' }
  if (inputLevel <= b.overloadStart) return { zone: 'headroom', status: 'Low headroom' }
  return { zone: 'overload', status: 'Saturation / distortion' }
}

// Combined SNR + Headroom meter: same relative dB reference as the zone diagram above.
const SNR_METER_MIN = -90
const SNR_METER_MAX = 16
const OVERLOAD_POINT = ANALOG_ZONE_BOUNDARIES.overloadStart
const SIGNAL_LEVEL_MIN = -70
const SIGNAL_LEVEL_MAX = 12
const NOISE_FLOOR_MIN = -90
const NOISE_FLOOR_MAX = -10

/** Illustrative buckets only — SNR quality is a spectrum, not a fixed pass/fail threshold. */
function getSnrStatus(snrDb: number): string {
  if (snrDb < 20) return 'Signal close to noise / Poor SNR'
  if (snrDb < 40) return 'Signal clearly above noise'
  return 'Clean signal / Good SNR'
}

export default function HeadroomMarginDemo({ presentationMode }: { presentationMode: boolean }) {
  const [peakLevelDb, setPeakLevelDb] = useState(-6)
  const [mode, setMode] = useState<'digital' | 'analog'>('digital')
  const [presetInfo, setPresetInfo] = useState<string | null>(null)
  const [signalLevel, setSignalLevel] = useState(-10)
  const [noiseFloor, setNoiseFloor] = useState(-60)

  const { zone: analogZone } = getAnalogZone(signalLevel)
  const snrDb = signalLevel - noiseFloor
  const snrStatus = getSnrStatus(snrDb)
  const analogOverloaded = signalLevel > OVERLOAD_POINT
  const analogHeadroomDb = analogOverloaded ? 0 : OVERLOAD_POINT - signalLevel
  const analogExcessDb = analogOverloaded ? signalLevel - OVERLOAD_POINT : 0

  // Combined meter: 0% at SNR_METER_MIN (bottom), 100% at SNR_METER_MAX (top).
  const snrMeterRange = SNR_METER_MAX - SNR_METER_MIN
  const pctForAnalogDb = (db: number) => Math.min(100, Math.max(0, ((db - SNR_METER_MIN) / snrMeterRange) * 100))
  const noiseFloorPct = pctForAnalogDb(noiseFloor)
  const signalLevelPct = pctForAnalogDb(signalLevel)
  const overloadPointPct = pctForAnalogDb(OVERLOAD_POINT)

  const clipping = peakLevelDb > 0
  const headroomDb = clipping ? 0 : -peakLevelDb
  const excessDb = clipping ? peakLevelDb : 0

  const amplitude = dbfsToLinear(peakLevelDb)
  const rawWave = useMemo(
    () => generateAnalogWave(SIGNAL_FREQUENCY, amplitude, DURATION),
    [amplitude],
  )
  const displayedWave = useMemo(
    () => rawWave.map((p) => ({ t: p.t, y: clampToFullScale(p.y) })),
    [rawWave],
  )

  const domain: ChartDomain = { xMin: 0, xMax: DURATION, yMin: -1.3, yMax: 1.3 }
  const rawPath = pointsToPath(rawWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const displayedPath = pointsToPath(displayedWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const ceilingTop = toScreen({ t: 0, y: 1 }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingBottom = toScreen({ t: 0, y: -1 }, domain, CHART_WIDTH, CHART_HEIGHT).y

  // Vertical meter: 0% at METER_MIN (bottom), 100% at METER_MAX (top).
  const meterRange = METER_MAX - METER_MIN
  const pctForDb = (db: number) => ((db - METER_MIN) / meterRange) * 100
  const zeroPct = pctForDb(0)
  const peakPct = Math.min(100, Math.max(0, pctForDb(peakLevelDb)))

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Headroom</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <strong className="text-slate-100">Headroom es el espacio que queda antes de alcanzar el límite del
          sistema.</strong> Es el margen, en dB, entre el pico actual de la señal y el techo (0 dBFS en digital).
          Cuanto más subís el nivel, menos margen te queda: <strong className="text-slate-100">más nivel → menos
          headroom → mayor riesgo de clipping.</strong>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('digital')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'digital' ? 'bg-purple-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-purple-500'
            }`}
          >
            Digital
          </button>
          <button
            type="button"
            onClick={() => setMode('analog')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'analog' ? 'bg-purple-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-purple-500'
            }`}
          >
            Analog
          </button>
        </div>
      </div>

      {mode === 'digital' ? (
        <>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="w-full h-auto"
                role="img"
                aria-label="Forma de onda con headroom y clipping"
              >
                <line x1={0} y1={ceilingTop} x2={CHART_WIDTH} y2={ceilingTop} stroke="#f87171" strokeWidth={1} strokeDasharray="6 4" opacity={0.7} />
                <line x1={0} y1={ceilingBottom} x2={CHART_WIDTH} y2={ceilingBottom} stroke="#f87171" strokeWidth={1} strokeDasharray="6 4" opacity={0.7} />
                <path d={rawPath} fill="none" stroke="#64748b" strokeWidth={2} strokeDasharray={clipping ? '4 4' : undefined} />
                <path d={displayedPath} fill="none" stroke="#a855f7" strokeWidth={2.5} />
              </svg>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-500" /> Señal (sin límite)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-purple-500" /> Señal almacenada</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-400" /> Techo de 0 dBFS</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-slate-500">Medidor (dBFS)</p>
              <div className="relative mx-auto h-64 w-16 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
                <div
                  className="absolute inset-x-0 bottom-0 bg-purple-500/40"
                  style={{ height: `${Math.min(peakPct, zeroPct)}%` }}
                />
                {!clipping && (
                  <div
                    className="absolute inset-x-0 border-y border-emerald-400/50 bg-emerald-500/20"
                    style={{ bottom: `${peakPct}%`, height: `${Math.max(zeroPct - peakPct, 0)}%` }}
                  />
                )}
                {clipping && (
                  <div
                    className="absolute inset-x-0 bg-red-500/50"
                    style={{ bottom: `${zeroPct}%`, height: `${Math.max(peakPct - zeroPct, 0)}%` }}
                  />
                )}
                <div className="absolute inset-x-0 border-t-2 border-dashed border-red-400" style={{ bottom: `${zeroPct}%` }} />
                <div className={`absolute inset-x-0 border-t-2 ${clipping ? 'border-red-300' : 'border-purple-300'}`} style={{ bottom: `${peakPct}%` }} />
              </div>
              <div className="mt-2 flex flex-col items-center gap-1 text-[10px] text-slate-500">
                <span>0 dBFS = techo</span>
                {!clipping && <span className="text-emerald-300">Zona HEADROOM</span>}
                {clipping && <span className="text-red-300">Zona CLIPPING</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-slate-200">
                  Peak Level
                  <span className="text-purple-300">{peakLevelDb > 0 ? '+' : ''}{formatNumber(peakLevelDb)} dBFS</span>
                </label>
                <input
                  type="range"
                  min={PEAK_MIN}
                  max={PEAK_MAX}
                  step={0.5}
                  value={peakLevelDb}
                  onChange={(e) => setPeakLevelDb(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{PEAK_MIN} dBFS</span>
                  <span>0 dBFS</span>
                  <span>+{PEAK_MAX} dBFS</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Presets</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setPeakLevelDb(p.peakLevelDb)
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

            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Peak" value={`${peakLevelDb > 0 ? '+' : ''}${formatNumber(peakLevelDb)} dBFS`} />
                <Stat
                  label="Headroom"
                  value={clipping ? `Excede ${formatNumber(excessDb)} dB` : `${formatNumber(headroomDb)} dB`}
                  tone={clipping ? 'warn' : 'ok'}
                />
                <Stat label="Techo" value="0 dBFS" />
                <Stat
                  label="Status"
                  value={clipping ? '⚠ CLIPPING' : headroomDb === 0 ? '⚠ 0 dB Headroom' : '✓ OK'}
                  tone={clipping ? 'warn' : headroomDb === 0 ? 'warn' : 'ok'}
                />
              </div>

              {clipping ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  ⚠ CLIPPING: el pico supera 0 dBFS por {formatNumber(excessDb)} dB. El sistema no puede
                  representar ese valor y recorta la forma de onda de manera permanente.
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-slate-300">
                  El pico está a {formatNumber(peakLevelDb)} dBFS, dejando {formatNumber(headroomDb)} dB de
                  headroom antes de tocar el techo de 0 dBFS. Por ejemplo, a -6 dBFS quedan 6 dB de margen.
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="mb-4 text-sm text-slate-300">
              En el mundo analógico no hay un techo fijo como 0 dBFS. <strong className="text-slate-100">0 VU es
              un nivel nominal de referencia, no el máximo del sistema:</strong> superarlo simplemente significa
              empezar a utilizar el headroom disponible, hasta llegar al punto de overload — que varía según el
              diseño de cada equipo, por eso no se asume un valor universal.
            </p>
            <div className="flex flex-col gap-1">
              <FlowBox label="OVERLOAD / DISTORTION" description="El equipo ya no reproduce la señal con fidelidad." color="bg-red-700" active={analogZone === 'overload'} />
              <ArrowUp />
              <FlowBox label="HEADROOM" description="Margen disponible por encima de 0 VU, antes del overload." color="bg-emerald-700" active={analogZone === 'headroom'} />
              <ArrowUp />
              <FlowBox label="NOMINAL LEVEL (0 VU)" description="Nivel de trabajo de referencia del equipo." color="bg-cyan-700" active={analogZone === 'nominal'} />
              <ArrowUp />
              <FlowBox
                label="NORMAL OPERATING RANGE"
                description="Usable Signal Range: suficientemente por encima del noise floor y todavía dentro de un nivel adecuado del sistema."
                color="bg-purple-700"
                active={analogZone === 'normalOperating'}
              />
              <ArrowUp />
              <FlowBox label="LOW SIGNAL LEVEL" description="Cerca del noise floor: poca relación señal/ruido." color="bg-slate-600" active={analogZone === 'lowSignal'} />
              <ArrowUp />
              <FlowBox label="NOISE FLOOR" description="El ruido de fondo más bajo que el sistema puede captar." color="bg-slate-700" active={analogZone === 'noiseFloor'} />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-center text-xs uppercase tracking-wide text-slate-500">
              Noise Floor ← SNR → Signal ← Headroom → Overload
            </p>

            <div className="flex justify-center gap-3">
              <div className="relative h-72 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
                {/* Overload zone (fixed, above the overload boundary) */}
                <div
                  className="absolute inset-x-0 top-0 bg-red-500/25"
                  style={{ height: `${100 - overloadPointPct}%` }}
                />
                {/* Headroom zone: from signal level up to the overload boundary */}
                {!analogOverloaded && (
                  <div
                    className="absolute inset-x-0 border-y border-emerald-400/50 bg-emerald-500/20"
                    style={{ bottom: `${signalLevelPct}%`, height: `${Math.max(overloadPointPct - signalLevelPct, 0)}%` }}
                  />
                )}
                {/* Overload overflow: signal pushed past the boundary */}
                {analogOverloaded && (
                  <div
                    className="absolute inset-x-0 bg-red-500/50"
                    style={{ bottom: `${overloadPointPct}%`, height: `${Math.max(signalLevelPct - overloadPointPct, 0)}%` }}
                  />
                )}
                {/* SNR zone: from noise floor up to signal level */}
                <div
                  className="absolute inset-x-0 border-y border-cyan-400/50 bg-cyan-500/20"
                  style={{ bottom: `${noiseFloorPct}%`, height: `${Math.max(signalLevelPct - noiseFloorPct, 0)}%` }}
                />
                <div className="absolute inset-x-0 border-t-2 border-dashed border-red-400" style={{ bottom: `${overloadPointPct}%` }} />
                <div className={`absolute inset-x-0 border-t-2 ${analogOverloaded ? 'border-red-300' : 'border-purple-300'}`} style={{ bottom: `${signalLevelPct}%` }} />
                <div className="absolute inset-x-0 border-t-2 border-dashed border-slate-400" style={{ bottom: `${noiseFloorPct}%` }} />
              </div>

              <div className="relative h-72 w-32 shrink-0 text-[10px] text-slate-400">
                <span className="absolute -translate-y-1/2" style={{ bottom: `${100}%` }}>OVERLOAD</span>
                <span className="absolute -translate-y-1/2" style={{ bottom: `${(overloadPointPct + 100) / 2}%` }}>↕ HEADROOM</span>
                <span className={`absolute -translate-y-1/2 font-medium ${analogOverloaded ? 'text-red-300' : 'text-purple-300'}`} style={{ bottom: `${signalLevelPct}%` }}>
                  ← SIGNAL LEVEL
                </span>
                <span className="absolute -translate-y-1/2" style={{ bottom: `${(noiseFloorPct + signalLevelPct) / 2}%` }}>
                  ↕ SNR = {formatNumber(snrDb)} dB
                </span>
                <span className="absolute -translate-y-1/2 text-slate-300" style={{ bottom: `${noiseFloorPct}%` }}>← NOISE FLOOR</span>
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-medium text-slate-200">
                Signal Level
                <span className="text-purple-300">
                  {signalLevel > 0 ? '+' : ''}
                  {formatNumber(signalLevel)} dB
                </span>
              </label>
              <input
                type="range"
                min={SIGNAL_LEVEL_MIN}
                max={SIGNAL_LEVEL_MAX}
                step={0.5}
                value={signalLevel}
                onChange={(e) => setSignalLevel(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-sm font-medium text-slate-200">
                Noise Floor
                <span className="text-purple-300">{formatNumber(noiseFloor)} dB</span>
              </label>
              <input
                type="range"
                min={NOISE_FLOOR_MIN}
                max={NOISE_FLOOR_MAX}
                step={0.5}
                value={noiseFloor}
                onChange={(e) => setNoiseFloor(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Signal Level" value={`${signalLevel > 0 ? '+' : ''}${formatNumber(signalLevel)} dB`} />
              <Stat label="Noise Floor" value={`${formatNumber(noiseFloor)} dB`} />
              <Stat label="SNR" value={`${formatNumber(snrDb)} dB`} tone={snrDb < 20 ? 'warn' : 'ok'} />
              <Stat
                label="Headroom"
                value={analogOverloaded ? `Excede ${formatNumber(analogExcessDb)} dB` : `${formatNumber(analogHeadroomDb)} dB`}
                tone={analogOverloaded ? 'warn' : 'ok'}
              />
            </div>

            <div className={`rounded-lg border p-3 text-sm ${
              snrDb < 20 ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-purple-500/40 bg-purple-500/10 text-purple-200'
            }`}>
              {snrStatus}
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              <strong className="text-slate-300">El Noise Floor es el nivel de ruido propio del sistema. El SNR
              indica cuántos dB está la señal por encima de ese ruido.</strong> Mayor distancia entre señal y
              ruido = mejor relación señal/ruido. El <strong className="text-slate-300">Headroom</strong> mide el
              espacio disponible por encima de la señal antes del overload, mientras que el{' '}
              <strong className="text-slate-300">SNR</strong> mide la separación entre la señal y el noise floor:
              son dos márgenes distintos medidos en direcciones opuestas del mismo medidor.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function FlowBox({
  label,
  description,
  color,
  active,
}: {
  label: string
  description: string
  color: string
  active?: boolean
}) {
  return (
    <div
      className={`rounded-lg ${color} p-3 text-center text-white transition-shadow ${
        active ? 'ring-2 ring-purple-300 ring-offset-2 ring-offset-slate-900' : ''
      }`}
    >
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-[10px] text-white/80">{description}</p>
    </div>
  )
}

function ArrowUp() {
  return <span className="text-center text-slate-500">↑</span>
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
