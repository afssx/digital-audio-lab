import { useMemo, useState } from 'react'
import {
  clampToFullScale,
  dbfsToLinear,
  formatNumber,
  generateAnalogWave,
} from '../lib/signal'
import { pointsToPath, toScreen, type ChartDomain } from '../lib/chart'

const SIGNAL_FREQUENCY = 4
const DURATION = 1
const CHART_WIDTH = 800
const CHART_HEIGHT = 260
const LEVEL_MIN = -30
const LEVEL_MAX = 12
const REFERENCE_LEVEL = -18 // common "0 VU" digital reference used when tracking

type Preset = { label: string; level: number; description: string }

const PRESETS: Preset[] = [
  { label: 'Mucho headroom', level: -24, description: 'Nivel bajo: muy seguro, pero si hace falta subir la ganancia luego, sube también el ruido de fondo.' },
  { label: 'Referencia -18 dBFS', level: -18, description: 'Punto de referencia típico al grabar: deja margen cómodo para picos inesperados.' },
  { label: 'Poco headroom', level: -3, description: 'Casi al límite: cualquier transitorio puede hacer clipping.' },
  { label: 'Clipping', level: 6, description: 'La señal supera 0 dBFS: el conversor no puede representarla y la recorta.' },
]

export default function HeadroomClippingDemo({ presentationMode }: { presentationMode: boolean }) {
  const [level, setLevel] = useState(-12)
  const [presetInfo, setPresetInfo] = useState<string | null>(null)

  const amplitude = dbfsToLinear(level)
  const clipping = level > 0
  const headroomDb = -level

  const rawWave = useMemo(
    () => generateAnalogWave(SIGNAL_FREQUENCY, amplitude, DURATION),
    [amplitude],
  )
  const storedWave = useMemo(
    () => rawWave.map((p) => ({ t: p.t, y: clampToFullScale(p.y) })),
    [rawWave],
  )

  const domain: ChartDomain = { xMin: 0, xMax: DURATION, yMin: -1.2, yMax: 1.2 }
  const rawPath = pointsToPath(rawWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const storedPath = pointsToPath(storedWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const ceilingTop = toScreen({ t: 0, y: 1 }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingBottom = toScreen({ t: 0, y: -1 }, domain, CHART_WIDTH, CHART_HEIGHT).y

  const meterRange = LEVEL_MAX - LEVEL_MIN
  const levelPct = ((level - LEVEL_MIN) / meterRange) * 100
  const zeroPct = ((0 - LEVEL_MIN) / meterRange) * 100
  const referencePct = ((REFERENCE_LEVEL - LEVEL_MIN) / meterRange) * 100

  const explanation = clipping
    ? `La señal llega a ${formatNumber(level)} dBFS, ${formatNumber(Math.abs(headroomDb))} dB por encima de 0 dBFS. Como el conversor no puede almacenar valores más allá de su máximo (0 dBFS = amplitud ±1), los picos se recortan de forma permanente: eso es clipping.`
    : `La señal llega a ${formatNumber(level)} dBFS, dejando ${formatNumber(headroomDb)} dB de headroom antes de tocar el techo de 0 dBFS. Ese margen es lo que evita que un pico inesperado se recorte.`

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">¿Qué es el headroom?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          El <strong className="text-slate-100">headroom</strong> es el margen, en dB, entre el nivel de pico de
          tu señal y el máximo que el sistema digital puede representar (0 dBFS). Cuanto más headroom dejás, más
          seguro estás frente a picos inesperados. Si la señal supera 0 dBFS, el conversor no tiene forma de
          guardar ese valor: lo recorta, y eso se llama <strong className="text-slate-100">clipping</strong>.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label="Gráfico de headroom y clipping"
        >
          <line x1={0} y1={ceilingTop} x2={CHART_WIDTH} y2={ceilingTop} stroke="#f87171" strokeWidth={1} strokeDasharray="6 4" opacity={0.7} />
          <line x1={0} y1={ceilingBottom} x2={CHART_WIDTH} y2={ceilingBottom} stroke="#f87171" strokeWidth={1} strokeDasharray="6 4" opacity={0.7} />
          <path d={rawPath} fill="none" stroke="#64748b" strokeWidth={2} strokeDasharray={clipping ? '4 4' : undefined} />
          <path d={storedPath} fill="none" stroke="#a855f7" strokeWidth={2.5} />
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-500" /> Señal (sin límite)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-purple-500" /> Señal almacenada</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-400" /> Techo de 0 dBFS</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Nivel de pico de la señal
              <span className="text-purple-300">{level > 0 ? '+' : ''}{formatNumber(level)} dBFS</span>
            </label>
            <input
              type="range"
              min={LEVEL_MIN}
              max={LEVEL_MAX}
              step={0.5}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{LEVEL_MIN} dBFS</span>
              <span>0 dBFS</span>
              <span>+{LEVEL_MAX} dBFS</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Medidor de headroom</p>
            <div className="relative h-6 rounded-full bg-slate-950/60">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/30"
                style={{ width: `${Math.min(levelPct, zeroPct)}%` }}
              />
              {clipping && (
                <div
                  className="absolute inset-y-0 rounded-r-full bg-red-500/50"
                  style={{ left: `${zeroPct}%`, width: `${Math.max(levelPct - zeroPct, 0)}%` }}
                />
              )}
              <div className="absolute inset-y-0 w-px bg-slate-500" style={{ left: `${referencePct}%` }} />
              <div
                className={`absolute inset-y-0 w-0.5 ${clipping ? 'bg-red-400' : 'bg-purple-400'}`}
                style={{ left: `${levelPct}%` }}
              />
              <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: `${zeroPct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>{LEVEL_MIN} dBFS</span>
              <span>referencia {REFERENCE_LEVEL} dBFS</span>
              <span>0 dBFS</span>
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
                    setLevel(p.level)
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
            <Stat label="Nivel de pico" value={`${level > 0 ? '+' : ''}${formatNumber(level)} dBFS`} />
            <Stat
              label={clipping ? 'Excedente sobre 0 dBFS' : 'Headroom disponible'}
              value={`${formatNumber(Math.abs(headroomDb))} dB`}
              tone={clipping ? 'warn' : 'ok'}
            />
            <Stat label="Techo digital" value="0 dBFS" />
            <Stat
              label="Estado"
              value={clipping ? '⚠ Clipping' : '✓ Sin clipping'}
              tone={clipping ? 'warn' : 'ok'}
            />
          </div>

          {clipping && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              ⚠ CLIPPING: la señal supera el máximo representable. Los picos quedan recortados de forma
              permanente y no se pueden reconstruir bajando la ganancia después.
            </div>
          )}

          <p className="text-sm leading-relaxed text-slate-300">{explanation}</p>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
            <p className="mb-1 font-medium text-slate-300">¿Por qué dejar headroom?</p>
            <p>
              Los transitorios (golpes de batería, consonantes fuertes, etc.) pueden ser mucho más altos que el
              nivel promedio de la señal. Dejar unos {Math.abs(REFERENCE_LEVEL)} dB de margen por debajo de 0
              dBFS es una práctica habitual al grabar para absorber esos picos sin clipear.
            </p>
          </div>
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
