import { PATH, SLOTS } from './layout'
import { pointAt } from './path'
import { rand } from './rng'
import { segmentD } from './snake'
import type { GameState, Unit, Vec } from './types'
import { UNIT_DEFS, unitDamage, unitRange } from './units'

const POISON_TIME = 3
const SLOW_TIME = 1.2

function applyHit(s: GameState, i: number, dmg: number, u: Unit, from: Vec): void {
  const seg = s.snake[i]
  if (!seg) return
  seg.hp -= dmg
  const p = pointAt(PATH, segmentD(s, i))
  const color = UNIT_DEFS[u.type].color
  s.fx.beams.push({ from, to: p, t: 0.15, color })
  s.fx.popups.push({ x: p.x, y: p.y - 12, text: String(Math.round(dmg)), t: 0.6, color })
}

export function tickCombat(s: GameState, dt: number): void {
  for (const seg of s.snake) {
    if (seg.poison > 0) {
      seg.poison -= dt
      seg.hp -= seg.poisonDps * dt
    }
  }
  for (const u of s.units) {
    u.cooldown -= dt
    if (u.cooldown > 0) continue
    const center = SLOTS[u.slot]
    const range = unitRange(u)
    let best = -1
    let bestD = -Infinity
    for (let i = 0; i < s.snake.length; i++) {
      const d = segmentD(s, i)
      if (d < 0) continue
      const p = pointAt(PATH, d)
      if (Math.hypot(p.x - center.x, p.y - center.y) <= range && d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) continue
    u.cooldown = 1 / UNIT_DEFS[u.type].rate
    const dmg = unitDamage(u)
    applyHit(s, best, dmg, u, center)
    const seg = s.snake[best]
    switch (u.type) {
      case 'frost':
        seg.slow = SLOW_TIME
        if (s.snake[0]) s.snake[0].slow = SLOW_TIME
        break
      case 'blaze':
        applyHit(s, best - 1, dmg * 0.5, u, center)
        applyHit(s, best + 1, dmg * 0.5, u, center)
        break
      case 'venom':
        seg.poison = POISON_TIME
        seg.poisonDps = Math.max(seg.poisonDps, dmg * 0.6)
        break
      case 'volt':
        if (rand() < 0.3) applyHit(s, best + 1, dmg, u, center)
        break
      case 'shadow':
        break
    }
  }
}

export function tickFx(s: GameState, dt: number): void {
  for (const p of s.fx.popups) { p.t -= dt; p.y -= 24 * dt }
  for (const b of s.fx.beams) b.t -= dt
  s.fx.popups = s.fx.popups.filter((p) => p.t > 0)
  s.fx.beams = s.fx.beams.filter((b) => b.t > 0)
}
