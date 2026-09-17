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

type ChannelMode = 'mono' | 'stereo' | 'atmos'
const CHANNEL_MODE_OPTIONS: { label: string; value: ChannelMode }[] = [
  { label: 'Mono', value: 'mono' },
  { label: 'Estéreo', value: 'stereo' },
  { label: 'Dolby Atmos ADM BWF', value: 'atmos' },
]

// A 7.1.2 bed is the fixed base layer of PCM channels an Atmos ADM BWF carries alongside the dynamic objects.
const ATMOS_BED_CHANNELS = 10
const ATMOS_TOTAL_CHANNELS_MAX = 128
const ATMOS_OBJECTS_MAX = ATMOS_TOTAL_CHANNELS_MAX - ATMOS_BED_CHANNELS
const ATMOS_SAMPLE_RATE = 48000
const ATMOS_BIT_DEPTH = 24

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
  const [channelMode, setChannelMode] = useState<ChannelMode>('stereo')
  const [objects, setObjects] = useState(20)
  const [durationMinutes, setDurationMinutes] = useState(5)

  const isAtmos = channelMode === 'atmos'
  const totalAtmosChannels = Math.min(ATMOS_TOTAL_CHANNELS_MAX, ATMOS_BED_CHANNELS + objects)
  const channels = isAtmos ? totalAtmosChannels : channelMode === 'mono' ? 1 : 2

  const durationSeconds = durationMinutes * 60
  const bitRate = bitRateBps(sampleRate, bitDepth, channels)
  const sizeBytes = fileSizeBytes(bitRate, durationSeconds)
  const sizePerMinuteBytes = fileSizeBytes(bitRateBps(sampleRate, bitDepth, channels), 60)

  const selectChannelMode = (mode: ChannelMode) => {
    setChannelMode(mode)
    if (mode === 'atmos') {
      setSampleRate(ATMOS_SAMPLE_RATE)
      setBitDepth(ATMOS_BIT_DEPTH)
    }
  }

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
              {CHANNEL_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectChannelMode(option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs hover:border-purple-500 ${
                    channelMode === option.value ? 'border-purple-500 text-purple-300' : 'border-slate-700 text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {isAtmos && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-slate-200">
                  Objects
                  <span className="text-purple-300">{objects}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={ATMOS_OBJECTS_MAX}
                  step={1}
                  value={objects}
                  onChange={(e) => setObjects(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>0</span>
                  <span>{ATMOS_OBJECTS_MAX}</span>
                </div>
              </div>

              <div>
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-950/60">
                  <div className="bg-cyan-500" style={{ width: `${(ATMOS_BED_CHANNELS / ATMOS_TOTAL_CHANNELS_MAX) * 100}%` }} />
                  <div className="bg-purple-500" style={{ width: `${(objects / ATMOS_TOTAL_CHANNELS_MAX) * 100}%` }} />
                  <div className="bg-slate-700" style={{ width: `${((ATMOS_TOTAL_CHANNELS_MAX - totalAtmosChannels) / ATMOS_TOTAL_CHANNELS_MAX) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-cyan-500" /> Bed ({ATMOS_BED_CHANNELS})</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-purple-500" /> Objects ({objects})</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-slate-700" /> Disponibles ({ATMOS_TOTAL_CHANNELS_MAX - totalAtmosChannels})</span>
                </div>
              </div>
            </div>
          )}

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
            {isAtmos && (
              <>
                <Stat label="Bed Channels" value={`${ATMOS_BED_CHANNELS}`} />
                <Stat label="Object Channels" value={`${objects}`} />
                <Stat label="Total PCM Channels" value={`${totalAtmosChannels} / ${ATMOS_TOTAL_CHANNELS_MAX}`} />
                <Stat label="MB por minuto" value={formatFileSize(sizePerMinuteBytes)} />
              </>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            {formatNumber(sampleRate)} × {bitDepth / 8} bytes × {channels} canales = {formatNumber(bitRate / 8)} bytes/s
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            {formatNumber(bitRate / 8)} bytes/s × {formatNumber(durationSeconds)} s = {formatFileSize(sizeBytes)}
          </div>

          {isAtmos ? (
            <p className="text-sm leading-relaxed text-slate-300">
              Con un 7.1.2 bed ({ATMOS_BED_CHANNELS} canales PCM) + {objects} objects ={' '}
              <strong className="text-slate-100">{totalAtmosChannels} / {ATMOS_TOTAL_CHANNELS_MAX} canales PCM totales</strong>, a{' '}
              {formatFrequency(sampleRate)} / {bitDepth}-bit, {formatNumber(durationMinutes)} minutos de un master
              ADM BWF ocupan aproximadamente{' '}
              <strong className="text-slate-100">{formatFileSize(sizeBytes)}</strong>.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">
              Con {formatFrequency(sampleRate)}, {bitDepth} bits y {channelMode === 'mono' ? 'un canal (mono)' : '2 canales (estéreo)'},{' '}
              {formatNumber(durationMinutes)} minutos de audio sin comprimir ocupan{' '}
              <strong className="text-slate-100">{formatFileSize(sizeBytes)}</strong>.
            </p>
          )}

          {isAtmos && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
              <strong className="text-slate-300">
                Un Dolby Atmos ADM BWF no se calcula según el número de altavoces.
              </strong>{' '}
              El master almacena los canales PCM de beds y objects junto con metadata espacial. Este resultado es
              una <strong className="text-slate-300">estimación del tamaño ADM BWF</strong>: el archivo real
              también incluye metadata y headers, y no se calcula a partir de configuraciones de altavoces como
              7.1.4 (12 canales).
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-200">
          Comparación ({formatNumber(durationMinutes)} min,{' '}
          {channelMode === 'mono' ? 'mono' : channelMode === 'stereo' ? 'estéreo' : `Atmos ${totalAtmosChannels} ch`})
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
