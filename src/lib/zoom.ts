// Shared logic for the millisecond-based time-window zoom sliders used across demos.
import { formatNumber } from './signal'

export const WINDOW_MS_MIN = 0.005 // 5 µs
export const WINDOW_MS_MAX = 1000 // 1 s
export const LOG_WINDOW_MS_MIN = Math.log10(WINDOW_MS_MIN)
// Hardcoded because Math.log10(1000) is 2.9999999999999996 in JS, not exactly 3.
export const LOG_WINDOW_MS_MAX = 3

/** Whole milliseconds once the window is 1 ms or larger, so the value never shows decimals. */
export function roundWindowMs(ms: number): number {
  return ms < 1 ? Math.round(ms * 1000) / 1000 : Math.round(ms)
}

/** Maps a window size to the exact log-scale slider position, avoiding floating-point drift at the bounds. */
export function windowMsToLogSlider(ms: number): number {
  if (ms >= WINDOW_MS_MAX) return LOG_WINDOW_MS_MAX
  if (ms <= WINDOW_MS_MIN) return LOG_WINDOW_MS_MIN
  return Math.log10(ms)
}

/** Maps a slider position to a window size, snapping exactly to the min/max at the ends of the range. */
export function logSliderToWindowMs(position: number): number {
  if (position >= LOG_WINDOW_MS_MAX - 0.0005) return WINDOW_MS_MAX
  if (position <= LOG_WINDOW_MS_MIN + 0.0005) return WINDOW_MS_MIN
  return roundWindowMs(10 ** position)
}

/** Whole microseconds below 1 ms, whole milliseconds at or above 1 ms — never shows decimals. */
export function formatWindowMs(ms: number): string {
  if (ms < 1) return `${formatNumber(Math.round(ms * 1000))} µs`
  return `${formatNumber(Math.round(ms))} ms`
}
