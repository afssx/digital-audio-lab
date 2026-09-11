import { useMemo, useState } from 'react'
import {
  bitRateBps,
  fileSizeBytes,
  formatBitRate,
  formatFileSize,
  formatFrequency,
  formatNumber,
} from '../lib/signal'

const SAMPLE_RATE_OPTIONS = [22050, 44100, 48000, 88200, 96000, 192000]
const BIT_DEPTH_OPTIONS = [8, 16, 24, 32]
const CHANNEL_OPTIONS: { label: string; value: number }[] = [
  { label: 'Mono', value: 1 },
  { label: 'Estéreo', value: 2 },
]

type ComparisonRow = { label: string; sampleRate: number; bitDepth: number }

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'CD 44.1 kHz / 16-bit', sampleRate: 44100, bitDepth: 16 },
  { label: 'Video 48 kHz / 16-bit', sampleRate: 48000, bitDepth: 16 },
  { label: 'Hi-Res 96 kHz / 24-bit', sampleRate: 96000, bitDepth: 24 },
  { label: 'Studio 192 kHz / 24-bit', sampleRate: 192000, bitDepth: 24 },
]

const BASELINE = COMPARISON_ROWS[0]

export default function FileSizeDemo({ presentationMode }: { presentationMode: boolean }) {
  const [sampleRate, setSampleRate] = useState(44100)
  const [bitDepth, setBitDepth] = useState(16)
  const [channels, setChannels] = useState(2)
  const [durationMinutes, setDurationMinutes] = useState(5)

  const durationSeconds = durationMinutes * 60
  const bitRate = bitRateBps(sampleRate, bitDepth, channels)
  const sizeBytes = fileSizeBytes(bitRate, durationSeconds)

  const baselineSizeBytes = useMemo(
    () => fileSizeBytes(bitRateBps(BASELINE.sampleRate, BASELINE.bitDepth, channels), durationSeconds),
    [channels, durationSeconds],
  )

  const comparisonData = useMemo(
    () =>
      COMPARISON_ROWS.map((row) => {
        const rate = bitRateBps(row.sampleRate, row.bitDepth, channels)
        const size = fileSizeBytes(rate, durationSeconds)
        return { ...row, bitRate: rate, sizeBytes: size, multiplier: size / baselineSizeBytes }
      }),
    [channels, durationSeconds, baselineSizeBytes],
  )

  return (
    <div className={`grid gap-6 p-6 ${presentationMode ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">¿Cuánto pesa el audio sin comprimir?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          El tamaño de un archivo de audio PCM (sin comprimir) depende de tres factores: cuántas veces medimos
          la señal por segundo (frecuencia de muestreo), qué tan precisa es cada medición (profundidad de bits)
          y cuántos canales grabamos (mono o estéreo).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-sm text-slate-300">
            Bit rate = frecuencia de muestreo × profundidad de bits × canales
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-sm text-slate-300">
            Tamaño de archivo = bit rate × duración (s) ÷ 8
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Frecuencia de muestreo</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_RATE_OPTIONS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSampleRate(rate)}
                  className={`rounded-lg border px-3 py-1.5 text-xs hover:border-purple-500 ${
                    sampleRate === rate ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200'
                  }`}
                >
                  {formatFrequency(rate)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Profundidad de bits</p>
            <div className="flex flex-wrap gap-2">
              {BIT_DEPTH_OPTIONS.map((bits) => (
                <button
                  key={bits}
                  type="button"
                  onClick={() => setBitDepth(bits)}
                  className={`rounded-lg border px-3 py-1.5 text-xs hover:border-purple-500 ${
                    bitDepth === bits ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200'
                  }`}
                >
                  {bits}-bit
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Canales</p>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setChannels(option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs hover:border-purple-500 ${
                    channels === option.value ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-slate-200">
              Duración de la grabación
              <span className="text-purple-300">{formatNumber(durationMinutes)} min</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={60}
              step={0.5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Bit rate" value={formatBitRate(bitRate)} />
            <Stat label="Tamaño de archivo" value={formatFileSize(sizeBytes)} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            {formatNumber(sampleRate)} × {bitDepth} × {channels} = {formatNumber(bitRate)} bits/s (
            {formatBitRate(bitRate)})
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            {formatBitRate(bitRate)} × {formatNumber(durationSeconds)} s ÷ 8 = {formatFileSize(sizeBytes)}
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            Con {formatFrequency(sampleRate)}, {bitDepth} bits y {channels === 1 ? 'un canal (mono)' : '2 canales (estéreo)'},{' '}
            {formatNumber(durationMinutes)} minutos de audio sin comprimir ocupan{' '}
            <strong className="text-slate-100">{formatFileSize(sizeBytes)}</strong>.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-200">
          Comparación ({formatNumber(durationMinutes)} min, {channels === 1 ? 'mono' : 'estéreo'})
        </h3>
        <p className="mb-3 text-xs text-slate-400">
          Tomando como referencia el CD (44.1 kHz / 16-bit), así crece el archivo con otros formatos.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Formato</th>
                <th className="pb-2 pr-4">Bit rate</th>
                <th className="pb-2 pr-4">Tamaño</th>
                <th className="pb-2">Vs. CD</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {comparisonData.map((row) => (
                <tr key={row.label} className="border-t border-slate-800">
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="py-2 pr-4">{formatBitRate(row.bitRate)}</td>
                  <td className="py-2 pr-4">{formatFileSize(row.sizeBytes)}</td>
                  <td className="py-2 font-semibold text-purple-300">{formatNumber(row.multiplier)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Por ejemplo, 5 minutos en 192 kHz/24-bit ocupan varias veces más espacio que la misma grabación en
          44.1 kHz/16-bit, aunque ambas duren lo mismo: la diferencia está en cuántos bits se guardan por
          segundo.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )
}
