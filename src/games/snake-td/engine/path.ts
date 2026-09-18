import type { Vec } from './types'

export interface Path { pts: Vec[]; cum: number[]; length: number }

export function makePath(pts: Vec[]): Path {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  return { pts, cum, length: cum[cum.length - 1] }
}

export function pointAt(p: Path, d: number): Vec & { angle: number } {
  const dist = Math.min(Math.max(d, 0), p.length)
  let i = 1
  while (i < p.cum.length - 1 && p.cum[i] < dist) i++
  const a = p.pts[i - 1], b = p.pts[i]
  const segLen = p.cum[i] - p.cum[i - 1] || 1
  const t = (dist - p.cum[i - 1]) / segLen
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) }
}

/**
 * Polyline through `corners` with every interior vertex rounded (quadratic bezier, radius-ish `r`).
 * First and last points are the open ends of the route.
 */
export function roundedRoute(corners: Vec[], r = 40): Path {
  const pts: Vec[] = [corners[0]]
  for (let i = 1; i < corners.length - 1; i++) {
    const P = corners[i - 1], V = corners[i], N = corners[i + 1]
    const la = Math.hypot(P.x - V.x, P.y - V.y), lb = Math.hypot(N.x - V.x, N.y - V.y)
    const t = Math.min(r, la / 2, lb / 2)
    const a = { x: V.x + ((P.x - V.x) / la) * t, y: V.y + ((P.y - V.y) / la) * t }
    const b = { x: V.x + ((N.x - V.x) / lb) * t, y: V.y + ((N.y - V.y) / lb) * t }
    for (let k = 0; k <= 6; k++) {
      const u = k / 6, w = 1 - u
      pts.push({ x: w * w * a.x + 2 * w * u * V.x + u * u * b.x, y: w * w * a.y + 2 * w * u * V.y + u * u * b.y })
    }
  }
  pts.push(corners[corners.length - 1])
  return makePath(pts)
}

/** Distance from a point to the nearest point of the polyline. */
export function distanceToPath(p: Path, q: Vec): number {
  let best = Infinity
  for (let i = 1; i < p.pts.length; i++) {
    const a = p.pts[i - 1], b = p.pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2))
    best = Math.min(best, Math.hypot(q.x - (a.x + dx * t), q.y - (a.y + dy * t)))
  }
  return best
}
