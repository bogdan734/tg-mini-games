import { absorb } from './boss'
import { getLevel } from './levels'
import { pointAt } from './path'
import { segmentD, segmentPos } from './snake'
import type { Flask, GameState, Vec } from './types'
import { SWORD_RATE, swordDamage, unitRange } from './units'

export const FLIGHT = 0.5

function hitSegment(s: GameState, i: number, dmg: number, color: string): void {
  const seg = s.snake[i]
  if (!seg) return
  const dealt = seg.head ? absorb(s, dmg) : dmg
  seg.hp -= dealt
  seg.hitT = 0.15
  const p = pointAt(getLevel(s.level).path, segmentPos(s, i))
  s.fx.popups.push({ x: p.x, y: p.y - 12, text: String(Math.round(dealt)), t: 0.6, color: dealt < dmg ? '#9fb3ff' : color })
}

export function hitFlask(s: GameState, f: Flask): void {
  f.hp -= 1
  s.fx.sounds.push('glass')
  const c = getLevel(s.level).slots[f.slot]
  s.fx.popups.push({ x: c.x, y: c.y - 30, text: f.hp > 0 ? `${f.hp}` : '💥', t: 0.5, color: '#bfe8ff' })
}

/** Pick a target for a sword: front-most segment in range; every other sword prefers a flask in range. */
function pickTarget(s: GameState, swordIdx: number, center: Vec, range: number): { kind: 'segment'; i: number; p: Vec } | { kind: 'flask'; f: Flask; p: Vec } | null {
  const lvl = getLevel(s.level)
  const flask = s.flasks.find((f) => Math.hypot(lvl.slots[f.slot].x - center.x, lvl.slots[f.slot].y - center.y) <= range)
  let best = -1, bestD = -Infinity
  for (let i = 0; i < s.snake.length; i++) {
    if (segmentD(s, i) < 0) continue
    const d = segmentPos(s, i)
    const p = pointAt(lvl.path, d)
    if (Math.hypot(p.x - center.x, p.y - center.y) <= range && d > bestD) { bestD = d; best = i }
  }
  // flasks: any idle sword, or the third sword of a unit even mid-fight (taps do the rest)
  const wantFlask = flask && (best < 0 || swordIdx % 3 === 2)
  if (wantFlask && flask) return { kind: 'flask', f: flask, p: lvl.slots[flask.slot] }
  if (best >= 0) return { kind: 'segment', i: best, p: pointAt(lvl.path, segmentPos(s, best)) }
  return null
}

export function tickCombat(s: GameState, dt: number): void {
  const lvl = getLevel(s.level)
  for (const u of s.units) {
    const center = lvl.slots[u.slot]
    const range = unitRange(u)
    for (let k = 0; k < u.swords.length; k++) {
      const sw = u.swords[k]
      sw.cooldown -= dt
      if (sw.cooldown > 0) continue
      const target = pickTarget(s, k, center, range)
      if (!target) continue
      sw.cooldown = 1 / SWORD_RATE
      const dmg = swordDamage(u)
      s.fx.sounds.push('sword')
      s.fx.shots.push({ unitId: u.id, sword: k, from: { x: center.x, y: center.y - 10 }, to: { ...target.p }, t: 0, dur: FLIGHT, kind: target.kind })
      if (target.kind === 'segment') {
        hitSegment(s, target.i, dmg, u.evo === 'risky' ? '#ff6b6b' : u.evo === 'safe' ? '#c9a8ff' : '#fff')
        if (u.evo !== 'none' && s.snake[0]) s.snake[0].slow = 0.6
      } else hitFlask(s, target.f)
    }
    for (const sw of u.swords) sw.phase += dt * 2.2
  }
}

export function tickFx(s: GameState, dt: number): void {
  for (const p of s.fx.popups) { p.t -= dt; p.y -= 24 * dt }
  for (const sh of s.fx.shots) sh.t += dt
  for (const pt of s.fx.parts) { pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 220 * dt }
  s.fx.popups = s.fx.popups.filter((p) => p.t > 0)
  s.fx.shots = s.fx.shots.filter((sh) => sh.t < sh.dur)
  s.fx.parts = s.fx.parts.filter((pt) => pt.t > 0)
  if (s.fx.shake > 0) s.fx.shake = Math.max(0, s.fx.shake - dt)
}
