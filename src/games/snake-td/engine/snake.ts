import { DASH_MUL } from './boss'
import { getLevel } from './levels'
import type { GameState, Segment } from './types'

export const SPACING = 30
export const BASE_SPEED = 40

export function waveLength(wave: number): number { return Math.min(60, 10 + wave * 4) }
export function waveSpeed(wave: number): number { return BASE_SPEED + Math.min(12, wave) * 5 }

export function makeSnake(wave: number, nextId: number, hpMul = 1, headMul = 1): Segment[] {
  const n = waveLength(wave)
  const out: Segment[] = []
  for (let i = 0; i < n; i++) {
    const head = i === 0
    // HP grows toward the tail, like the reference: cheap front, tanky back.
    // Exponential per-wave growth so merged/evolved units are required later on.
    const body = Math.round((4 + wave * 3) * Math.pow(1.18, wave) * (0.6 + 0.8 * (i / n)) * hpMul)
    const hp = head ? Math.round(30 * Math.pow(1.4, wave) * hpMul * headMul) : body
    out.push({ id: nextId + i, hp, maxHp: hp, head, poison: 0, poisonDps: 0, slow: 0, hitT: 0 })
  }
  return out
}

/** Raw path distance of the i-th alive segment (grows without bound; negative = not spawned yet). */
export function segmentD(s: GameState, i: number): number {
  return s.headD - i * SPACING
}

/** Position on the ring for drawing/targeting: raw distance wrapped onto the path. */
export function segmentPos(s: GameState, i: number): number {
  const L = getLevel(s.level).path.length
  return ((segmentD(s, i) % L) + L) % L
}

export const HEAD_PASS_COST = 3
export const BODY_PASS_COST = 1

/**
 * Advance the snake around the ring. Segments never leave the board; every time the
 * leading segment passes the base gate the player loses lives (head costs more).
 * Returns the number of gate passes this tick.
 */
export function advanceSnake(s: GameState, dt: number): number {
  if (s.snake.length === 0) return 0
  const lvl = getLevel(s.level)
  const L = lvl.path.length
  const first = s.snake[0]
  const slowMul = first.slow > 0 ? 0.55 : 1
  const dashMul = s.boss.dashT > 0 && first.head ? DASH_MUL : 1
  // headD can dip below zero after leader deaths (index shift); a pass only counts from d >= 0
  const before = Math.floor(Math.max(0, s.headD) / L)
  s.headD += waveSpeed(s.wave) * lvl.speedMul * s.speedMul * slowMul * dashMul * dt
  const after = Math.floor(Math.max(0, s.headD) / L)
  for (const seg of s.snake) {
    if (seg.slow > 0) seg.slow -= dt
    if (seg.hitT > 0) seg.hitT -= dt
  }
  const passes = Math.max(0, after - before)
  if (passes > 0) s.lives = Math.max(0, s.lives - passes * (first.head ? HEAD_PASS_COST : BODY_PASS_COST))
  return passes
}

/** Remove dead segments; those behind close the gap. Returns killed segments. */
export function removeDead(s: GameState): Segment[] {
  const dead: Segment[] = []
  const alive: Segment[] = []
  for (let i = 0; i < s.snake.length; i++) {
    const seg = s.snake[i]
    if (seg.hp <= 0) {
      dead.push(seg)
      if (i === 0) s.headD -= SPACING
    } else alive.push(seg)
  }
  s.snake = alive
  return dead
}
