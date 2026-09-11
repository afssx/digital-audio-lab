import type { Point } from './signal'

/** Map (t, y) data points to an SVG path within a viewBox of size width x height. */
export function pointsToPath(
  points: Point[],
  duration: number,
  amplitude: number,
  width: number,
  height: number,
): string {
  if (points.length === 0) return ''
  const toX = (t: number) => (t / duration) * width
  const toY = (y: number) => height / 2 - (y / amplitude) * (height / 2 - 4)

  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.t).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(' ')
}

export function toScreen(
  point: Point,
  duration: number,
  amplitude: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = (point.t / duration) * width
  const y = height / 2 - (point.y / amplitude) * (height / 2 - 4)
  return { x, y }
}
