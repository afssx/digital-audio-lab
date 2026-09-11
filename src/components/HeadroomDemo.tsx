import { useMemo, useState } from 'react'
import {
  dbfsToLinear,
  formatNumber,
  generateAnalogWave,
  linearToDbfs,
  quantizeWave,
  quantizeWaveFloat32,
} from '../lib/signal'
import { pointsToPath, toScreen, type ChartDomain } from '../lib/chart'

const SIGNAL_FREQUENCY = 3
const DURATION = 1
const GAIN_STEP_DB = -18
const CHART_WIDTH = 460
const CHART_HEIGHT = 210

export default function HeadroomDemo({ integerBits }: { integerBits: number }) {
  const [levelDb, setLevelDb] = useState(12)
  const [gainReduced, setGainReduced] = useState(false)

  const amplitude0 = dbfsToLinear(levelDb)
  const gainFactor = gainReduced ? dbfsToLinear(GAIN_STEP_DB) : 1
  const wasClipped = amplitude0 > 1

  const rawWave = useMemo(
    () => generateAnalogWave(SIGNAL_FREQUENCY, amplitude0, DURATION),
    [amplitude0],
  )

  // Clipping happens once, at capture time — it is baked into the stored samples.
  const capturedIntegerWave = useMemo(
    () => quantizeWave(rawWave, integerBits, 1),
    [rawWave, integerBits],
  )
  const capturedFloatWave = useMemo(() => quantizeWaveFloat32(rawWave), [rawWave])

  const displayedIntegerWave = useMemo(
    () => capturedIntegerWave.map((p) => ({ t: p.t, y: p.y * gainFactor })),
    [capturedIntegerWave, gainFactor],
  )
  const displayedFloatWave = useMemo(
    () => capturedFloatWave.map((p) => ({ t: p.t, y: p.y * gainFactor })),
    [capturedFloatWave, gainFactor],
  )

  const framePeak = Math.max(1.15, amplitude0 * 1.15)
  const domain: ChartDomain = { xMin: 0, xMax: DURATION, yMin: -framePeak, yMax: framePeak }

  const integerPath = pointsToPath(displayedIntegerWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const floatPath = pointsToPath(displayedFloatWave, domain, CHART_WIDTH, CHART_HEIGHT)
  const ceilingTop = toScreen({ t: 0, y: 1 }, domain, CHART_WIDTH, CHART_HEIGHT).y
  const ceilingBottom = toScreen({ t: 0, y: -1 }, domain, CHART_WIDTH, CHART_HEIGHT).y

  const peakNowDb = linearToDbfs(amplitude0 * gainFactor)

  return (
    <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">
          Comparación: {integerBits}-bit Integer vs 32-bit Float
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Ambos paneles muestran la misma señal, capturada al mismo nivel. La línea punteada marca el techo de 0
          dBFS (amplitud ±1), el máximo que un formato entero puede almacenar.
        </p>
      </div>

      <div>
        <label className="flex items-center justify-between text-sm font-medium text-slate-200">
          Nivel de señal
          <span className="text-purple-300">{levelDb > 0 ? '+' : ''}{formatNumber(levelDb)} dBFS</span>
        </label>
        <input
          type="range"
          min={-60}
          max={24}
          step={1}
          value={levelDb}
          onChange={(e) => setLevelDb(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>-60 dBFS</span>
          <span>0 dBFS</span>
          <span>+24 dBFS</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setGainReduced((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            gainReduced
              ? 'border-cyan-400 text-cyan-300'
              : 'border-slate-700 text-slate-200 hover:border-purple-500'
          }`}
        >
          {gainReduced ? 'Restablecer ganancia (0 dB)' : `Bajar ganancia ${formatNumber(GAIN_STEP_DB)} dB`}
        </button>
        <span className="text-xs text-slate-400">
          Ganancia aplicada: {gainReduced ? `${formatNumber(GAIN_STEP_DB)} dB` : '0 dB'} · Nivel actual:{' '}
          {peakNowDb > 0 ? '+' : ''}{formatNumber(peakNowDb)} dBFS
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartPanel
          title={`${integerBits}-bit Integer`}
          path={integerPath}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          ceilingTop={ceilingTop}
          ceilingBottom={ceilingBottom}
          strokeColor="#a855f7"
        >
          {wasClipped ? (
            <>
              <Badge tone="warn">⚠ Superó el máximo representable</Badge>
              <p className="mt-2 text-xs text-slate-400">
                El recorte ocurrió al capturar la señal y quedó grabado en las muestras. Bajar la ganancia ahora
                solo reduce el volumen: la onda sigue deformada.
              </p>
            </>
          ) : (
            <Badge tone="ok">✓ Dentro del rango representable</Badge>
          )}
        </ChartPanel>

        <ChartPanel
          title="32-bit Float"
          path={floatPath}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          ceilingTop={ceilingTop}
          ceilingBottom={ceilingBottom}
          strokeColor="#22d3ee"
        >
          <Badge tone="ok">✓ El valor todavía puede representarse</Badge>
          <p className="mt-2 text-xs text-slate-400">
            {wasClipped
              ? 'La señal superó 0 dBFS, pero el float la guarda completa gracias a su exponente: sin recortar.'
              : 'La forma se conserva igual que en el dominio entero mientras el nivel esté dentro de 0 dBFS.'}
          </p>
        </ChartPanel>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm leading-relaxed text-slate-300">
        <p><strong className="text-slate-100">24-bit:</strong> alta precisión dentro de un rango fijo.</p>
        <p><strong className="text-slate-100">32-bit Float:</strong> precisión similar, pero con un rango numérico extremadamente amplio gracias al exponente.</p>
        <p className="mt-2 italic text-slate-400">
          24-bit es como una regla muy precisa con longitud fija. 32-bit float es una regla igual de precisa,
          pero que puede cambiar de escala. Eso sí: nada de esto recupera un clipping que ya ocurrió antes, en el
          micrófono, el preamplificador o el conversor A/D — solo evita que el propio dominio digital agregue un
          recorte adicional.
        </p>
      </div>
    </div>
  )
}

function ChartPanel({
  title,
  path,
  width,
  height,
  ceilingTop,
  ceilingBottom,
  strokeColor,
  children,
}: {
  title: string
  path: string
  width: number
  height: number
  ceilingTop: number
  ceilingBottom: number
  strokeColor: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`Forma de onda en ${title}`}>
        <line x1={0} y1={ceilingTop} x2={width} y2={ceilingTop} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.6} />
        <line x1={0} y1={ceilingBottom} x2={width} y2={ceilingBottom} stroke="#f87171" strokeWidth={1} strokeDasharray="5 4" opacity={0.6} />
        <path d={path} fill="none" stroke={strokeColor} strokeWidth={2} />
      </svg>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Badge({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const classes =
    tone === 'warn'
      ? 'border-red-500/40 bg-red-500/10 text-red-300'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${classes}`}>{children}</span>
  )
}
