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

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 6): Vec[] {
  const out: Vec[] = []
  for (let k = 0; k <= n; k++) {
    const a = a0 + (a1 - a0) * (k / n)
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return out
}

/**
 * C-shaped road with rounded corners:
 * spawn (top-right) → left along top → down the left side → right along bottom → gate (bottom-right).
 */
export function boardPath(w: number, h: number, m: number, r = 40): Path {
  const pts: Vec[] = [{ x: w - m, y: m }]
  pts.push({ x: m + r, y: m })
  pts.push(...arc(m + r, m + r, r, -Math.PI / 2, -Math.PI))
  pts.push({ x: m, y: h - m - r })
  pts.push(...arc(m + r, h - m - r, r, Math.PI, Math.PI / 2))
  pts.push({ x: w - m, y: h - m })
  return makePath(pts)
}
