// Core math for the analog-to-digital audio demos (sampling + quantization).

export interface Point {
  t: number
  y: number
}

/** y(t) = A * sin(2*pi*f*t) evaluated densely for a smooth analog-looking curve. */
export function generateAnalogWave(
  frequency: number,
  amplitude: number,
  duration: number,
  resolution = 600,
  phase = 0,
): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= resolution; i++) {
    const t = (i / resolution) * duration
    points.push({ t, y: amplitude * Math.sin(2 * Math.PI * frequency * t + phase) })
  }
  return points
}

/** Discrete samples y[n] = A * sin(2*pi*f*n/sampleRate) taken over `duration` seconds. */
export function sampleWave(
  frequency: number,
  amplitude: number,
  sampleRate: number,
  duration: number,
): Point[] {
  const sampleInterval = 1 / sampleRate
  const count = Math.floor(duration / sampleInterval)
  const samples: Point[] = []
  for (let n = 0; n <= count; n++) {
    const t = n * sampleInterval
    if (t > duration) break
    samples.push({ t, y: amplitude * Math.sin(2 * Math.PI * frequency * t) })
  }
  return samples
}

export function nyquistFrequency(sampleRate: number): number {
  return sampleRate / 2
}

export function isAliasing(signalFrequency: number, sampleRate: number): boolean {
  return signalFrequency > nyquistFrequency(sampleRate)
}

/**
 * When the signal frequency exceeds Nyquist, the samples appear to trace a
 * lower "alias" frequency: |f - round(f / sampleRate) * sampleRate|.
 */
export function aliasedFrequency(signalFrequency: number, sampleRate: number): number {
  const folded = signalFrequency - Math.round(signalFrequency / sampleRate) * sampleRate
  return Math.abs(folded)
}

export function quantizationLevels(bits: number): number {
  return 2 ** bits
}

/** Snap a value in [-amplitude, amplitude] to the nearest of 2^bits levels. */
export function quantize(value: number, bits: number, amplitude: number): number {
  const levels = quantizationLevels(bits)
  const step = (2 * amplitude) / (levels - 1)
  const clamped = Math.min(amplitude, Math.max(-amplitude, value))
  const index = Math.round((clamped + amplitude) / step)
  return index * step - amplitude
}

export function quantizeWave(points: Point[], bits: number, amplitude: number): Point[] {
  return points.map((p) => ({ t: p.t, y: quantize(p.y, bits, amplitude) }))
}

/**
 * 32-bit float (IEEE 754) doesn't snap values to a fixed grid: it stores a
 * sign, an 8-bit exponent and a 23-bit mantissa, so the step size scales with
 * the magnitude of the value instead of being constant like in integer PCM.
 * `Math.fround` performs the same single-precision rounding a real 32-bit
 * float audio format would apply.
 */
export function quantizeToFloat32(value: number): number {
  return Math.fround(value)
}

export function quantizeWaveFloat32(points: Point[]): Point[] {
  return points.map((p) => ({ t: p.t, y: Math.fround(p.y) }))
}

/** 0 dBFS = amplitude 1.0 (the fixed ceiling of an integer PCM format). */
export function dbfsToLinear(db: number): number {
  return 10 ** (db / 20)
}

export function linearToDbfs(amplitude: number): number {
  if (amplitude <= 0) return -Infinity
  return 20 * Math.log10(amplitude)
}

/** Integer PCM has a fixed ceiling: anything beyond ±1 is hard-clipped, permanently. */
export function clampToFullScale(value: number): number {
  return Math.min(1, Math.max(-1, value))
}

/**
 * A tone with periodic transient bursts (like drum hits above a sustained
 * note), useful to show how limiters/clippers react differently to peaks
 * that occasionally poke above a sustained level.
 */
export function generateTransientWave(duration = 1, resolution = 600): Point[] {
  const points: Point[] = []
  const transientsPerSecond = 3
  const burstWidth = 0.05
  for (let i = 0; i <= resolution; i++) {
    const t = (i / resolution) * duration
    let y = 0.5 * Math.sin(2 * Math.PI * 4 * t)
    const burstPhase = (t * transientsPerSecond) % 1
    if (burstPhase < burstWidth) {
      const burstEnvelope = Math.sin((burstPhase / burstWidth) * Math.PI)
      y += burstEnvelope * 0.9 * Math.sin(2 * Math.PI * 40 * t)
    }
    points.push({ t, y })
  }
  return points
}

export interface LimiterResult {
  wave: Point[]
  gainReductionDb: Point[]
  maxGainReductionDb: number
}

/**
 * Envelope-follower limiter: tracks the signal's peak with a fast attack and
 * slower release, then scales the sample down whenever the envelope exceeds
 * the threshold. Unlike hard clipping, the gain reduction ramps in and out
 * smoothly, so the waveform shape is mostly preserved. A final ceiling clamp
 * (true-peak style) guarantees the output never exceeds that hard limit.
 */
export function applyLimiter(
  wave: Point[],
  thresholdLinear: number,
  ceilingLinear: number,
  attackCoeff = 0.6,
  releaseCoeff = 0.05,
): LimiterResult {
  let envelope = 0
  let maxGainReductionDb = 0
  const outWave: Point[] = []
  const gainReductionDb: Point[] = []

  for (const p of wave) {
    const rectified = Math.abs(p.y)
    envelope +=
      rectified > envelope ? (rectified - envelope) * attackCoeff : (rectified - envelope) * releaseCoeff

    const gain = envelope > thresholdLinear ? thresholdLinear / envelope : 1
    const grDb = linearToDbfs(gain)
    if (grDb < maxGainReductionDb) maxGainReductionDb = grDb
    gainReductionDb.push({ t: p.t, y: grDb })

    const limited = p.y * gain
    const clamped = Math.max(-ceilingLinear, Math.min(ceilingLinear, limited))
    outWave.push({ t: p.t, y: clamped })
  }

  return { wave: outWave, gainReductionDb, maxGainReductionDb }
}

export interface ClipperResult {
  wave: Point[]
  clippedSamplesRatio: number
}

/** Hard clipper: any sample beyond the threshold is truncated flat, distorting the waveform shape. */
export function applyClipper(wave: Point[], thresholdLinear: number, ceilingLinear: number): ClipperResult {
  let clippedCount = 0
  const outWave = wave.map((p) => {
    if (Math.abs(p.y) > thresholdLinear) clippedCount++
    const clippedAtThreshold = Math.max(-thresholdLinear, Math.min(thresholdLinear, p.y))
    const clamped = Math.max(-ceilingLinear, Math.min(ceilingLinear, clippedAtThreshold))
    return { t: p.t, y: clamped }
  })
  return { wave: outWave, clippedSamplesRatio: clippedCount / wave.length }
}

/** Simplified rule of thumb: dynamic range (dB) ≈ 6.02 × bits. */
export function dynamicRangeDb(bits: number): number {
  return 6.02 * bits
}

const COMPRESSOR_MIN_DB = -60

/**
 * Static transfer curve of a feed-forward compressor: 1:1 below threshold, 1/ratio slope above it.
 * With kneeWidthDb > 0 (soft knee), the transition is a quadratic blend centered on the threshold
 * instead of a sharp corner (hard knee, the default when kneeWidthDb is 0).
 */
export function compressorOutputDb(
  inputDb: number,
  thresholdDb: number,
  ratio: number,
  kneeWidthDb = 0,
): number {
  const delta = inputDb - thresholdDb
  if (kneeWidthDb <= 0) {
    return delta <= 0 ? inputDb : thresholdDb + delta / ratio
  }
  if (2 * delta < -kneeWidthDb) return inputDb
  if (2 * Math.abs(delta) <= kneeWidthDb) {
    return inputDb + (1 / ratio - 1) * (delta + kneeWidthDb / 2) ** 2 / (2 * kneeWidthDb)
  }
  return thresholdDb + delta / ratio
}

/** One-pole time constant → per-sample smoothing coefficient (bigger ms = slower response). */
function timeConstantToCoeff(ms: number, dtSeconds: number): number {
  if (ms <= 0) return 1
  const tau = ms / 1000
  return 1 - Math.exp(-dtSeconds / tau)
}

export interface CompressorResult {
  wave: Point[]
  gainReductionDb: Point[]
  maxGainReductionDb: number
}

/**
 * Feed-forward compressor: the gain reduction implied by the static
 * threshold/ratio curve is smoothed through an envelope follower with
 * independent attack (while compressing more) and release (while
 * compressing less) time constants, then makeup gain is added back.
 */
export function applyCompressor(
  wave: Point[],
  dtSeconds: number,
  thresholdDb: number,
  ratio: number,
  attackMs: number,
  releaseMs: number,
  makeupDb: number,
  kneeWidthDb = 0,
): CompressorResult {
  let envelopeDb = 0
  let maxGainReductionDb = 0
  const outWave: Point[] = []
  const gainReductionDb: Point[] = []
  const attackCoeff = timeConstantToCoeff(attackMs, dtSeconds)
  const releaseCoeff = timeConstantToCoeff(releaseMs, dtSeconds)

  for (const p of wave) {
    const inputDb = Math.max(COMPRESSOR_MIN_DB, linearToDbfs(Math.abs(p.y)))
    const targetReductionDb = compressorOutputDb(inputDb, thresholdDb, ratio, kneeWidthDb) - inputDb
    const coeff = targetReductionDb < envelopeDb ? attackCoeff : releaseCoeff
    envelopeDb += (targetReductionDb - envelopeDb) * coeff
    if (envelopeDb < maxGainReductionDb) maxGainReductionDb = envelopeDb

    gainReductionDb.push({ t: p.t, y: envelopeDb })
    outWave.push({ t: p.t, y: p.y * dbfsToLinear(envelopeDb + makeupDb) })
  }

  return { wave: outWave, gainReductionDb, maxGainReductionDb }
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(n)
}

/** Shows Hz below 1000 and kHz above, which is easier to read for audio-range frequencies. */
export function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${formatNumber(hz / 1000)} kHz`
  }
  return `${formatNumber(hz)} Hz`
}

/** Bit rate (bits per second) = sampling frequency × bit depth × number of channels. */
export function bitRateBps(sampleRate: number, bitDepth: number, channels: number): number {
  return sampleRate * bitDepth * channels
}

/** Uncompressed file size in bytes = bit rate × duration (s) ÷ 8. */
export function fileSizeBytes(bitRateBps: number, durationSeconds: number): number {
  return (bitRateBps * durationSeconds) / 8
}

/** Decimal (SI) units, matching how storage/bit-rate figures are usually quoted (1 MB = 1,000,000 bytes). */
export function formatBitRate(bps: number): string {
  if (bps >= 1_000_000) return `${formatNumber(bps / 1_000_000)} Mbps`
  if (bps >= 1_000) return `${formatNumber(bps / 1_000)} kbps`
  return `${formatNumber(bps)} bps`
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${formatNumber(bytes / 1_000_000_000)} GB`
  if (bytes >= 1_000_000) return `${formatNumber(bytes / 1_000_000)} MB`
  if (bytes >= 1_000) return `${formatNumber(bytes / 1_000)} KB`
  return `${formatNumber(bytes)} B`
}
