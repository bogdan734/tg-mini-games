import type { GameState, Segment } from './types'
import { PATH } from './layout'

export const SPACING = 30
export const BASE_SPEED = 42

export function waveLength(wave: number): number { return 10 + wave * 4 }
export function waveSpeed(wave: number): number { return BASE_SPEED + wave * 3 }

export function makeSnake(wave: number, nextId: number): Segment[] {
  const n = waveLength(wave)
  const out: Segment[] = []
  for (let i = 0; i < n; i++) {
    const head = i === 0
    // HP grows toward the tail, like the reference: cheap front, tanky back
    const body = 2 + wave + Math.floor((i / n) * (4 + wave * 3))
    const hp = head ? 15 + wave * 12 : body
    out.push({ id: nextId + i, hp, maxHp: hp, head, poison: 0, poisonDps: 0, slow: 0 })
  }
  return out
}

/** Path distance of the i-th alive segment. */
export function segmentD(s: GameState, i: number): number {
  return s.headD - i * SPACING
}

/** Advance the snake; segments reaching the gate are removed and cost lives. Returns escaped count. */
export function advanceSnake(s: GameState, dt: number): number {
  if (s.snake.length === 0) return 0
  const first = s.snake[0]
  const slowMul = first.slow > 0 ? 0.55 : 1
  s.headD += waveSpeed(s.wave) * s.speedMul * slowMul * dt
  for (const seg of s.snake) {
    if (seg.slow > 0) seg.slow -= dt
  }
  let escaped = 0
  while (s.snake.length && s.headD >= PATH.length) {
    const gone = s.snake.shift()!
    s.lives -= gone.head ? 3 : 1
    s.headD -= SPACING
    escaped++
  }
  if (s.lives < 0) s.lives = 0
  return escaped
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
  // when a middle segment dies the ones behind shift forward by SPACING (index shift) — desired
  s.snake = alive
  return dead
}
