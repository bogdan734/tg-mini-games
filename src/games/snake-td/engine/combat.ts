import { absorb } from './boss'
import { getLevel } from './levels'
import { pointAt } from './path'
import { rand } from './rng'
import { segmentD, segmentPos } from './snake'
import type { GameState, Unit, Vec } from './types'
import { UNIT_DEFS, unitDamage, unitRange } from './units'

const POISON_TIME = 3
const SLOW_TIME = 1.2

function applyHit(s: GameState, i: number, dmg: number, u: Unit, from: Vec, primary: boolean): void {
  const seg = s.snake[i]
  if (!seg) return
  const dealt = seg.head ? absorb(s, dmg) : dmg
  seg.hp -= dealt
  seg.hitT = 0.15
  const p = pointAt(getLevel(s.level).path, segmentPos(s, i))
  const color = UNIT_DEFS[u.type].color
  if (primary) {
    s.fx.shots.push({ x: from.x, y: from.y, tx: p.x, ty: p.y, t: 0, type: u.type, unitId: u.id, segId: seg.id })
  }
  s.fx.popups.push({ x: p.x, y: p.y - 12, text: String(Math.round(dealt)), t: 0.6, color: dealt < dmg ? '#9fb3ff' : color })
}

export function tickCombat(s: GameState, dt: number): void {
  const lvl = getLevel(s.level)
  for (const seg of s.snake) {
    if (seg.poison > 0) {
      seg.poison -= dt
      seg.hp -= seg.poisonDps * dt
    }
  }
  for (const u of s.units) {
    u.cooldown -= dt
    if (u.cooldown > 0) continue
    const center = lvl.slots[u.slot]
    const range = unitRange(u)
    let best = -1
    let bestD = -Infinity
    for (let i = 0; i < s.snake.length; i++) {
      if (segmentD(s, i) < 0) continue
      const d = segmentPos(s, i)
      const p = pointAt(lvl.path, d)
      if (Math.hypot(p.x - center.x, p.y - center.y) <= range && d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) continue
    u.cooldown = 1 / UNIT_DEFS[u.type].rate
    const dmg = unitDamage(u)
    s.fx.sounds.push(`shot:${u.type}`)
    applyHit(s, best, dmg, u, center, true)
    const seg = s.snake[best]
    switch (u.type) {
      case 'frost':
        seg.slow = SLOW_TIME
        if (s.snake[0]) s.snake[0].slow = SLOW_TIME
        break
      case 'blaze':
        applyHit(s, best - 1, dmg * 0.5, u, center, false)
        applyHit(s, best + 1, dmg * 0.5, u, center, false)
        break
      case 'venom':
        seg.poison = POISON_TIME
        seg.poisonDps = Math.max(seg.poisonDps, dmg * 0.6)
        break
      case 'volt':
        if (rand() < 0.3) applyHit(s, best + 1, dmg, u, center, false)
        break
      case 'shadow':
        break
    }
  }
}

export function tickFx(s: GameState, dt: number): void {
  for (const p of s.fx.popups) { p.t -= dt; p.y -= 24 * dt }
  for (const b of s.fx.beams) b.t -= dt
  for (const sh of s.fx.shots) sh.t += dt
  for (const pt of s.fx.parts) { pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 220 * dt }
  s.fx.popups = s.fx.popups.filter((p) => p.t > 0)
  s.fx.beams = s.fx.beams.filter((b) => b.t > 0)
  s.fx.shots = s.fx.shots.filter((sh) => sh.t < 0.9)
  s.fx.parts = s.fx.parts.filter((pt) => pt.t > 0)
  if (s.fx.shake > 0) s.fx.shake = Math.max(0, s.fx.shake - dt)
}
