import type { Point } from './signal'

export interface ChartDomain {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/** Map (t, y) data points to an SVG path within a viewBox of size width x height. */
export function pointsToPath(
  points: Point[],
  domain: ChartDomain,
  width: number,
  height: number,
): string {
  if (points.length === 0) return ''
  const { xMin, xMax, yMin, yMax } = domain
  const toX = (t: number) => ((t - xMin) / (xMax - xMin)) * width
  const toY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height

  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.t).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(' ')
}

export function toScreen(
  point: Point,
  domain: ChartDomain,
  width: number,
  height: number,
): { x: number; y: number } {
  const { xMin, xMax, yMin, yMax } = domain
  const x = ((point.t - xMin) / (xMax - xMin)) * width
  const y = height - ((point.y - yMin) / (yMax - yMin)) * height
  return { x, y }
}
