import type { Evo, Unit } from './types'

export const MAX_LEVEL = 5
/** Reaching this level opens the evolution choice. */
export const EVO_LEVEL = 5
export const SWORD_DMG = 4
/** attacks per second per sword */
export const SWORD_RATE = 1.3
export const BASE_RANGE = 135

export const EVO_MUL: Record<Evo, number> = { none: 1, safe: 2, risky: 3.5 }
export const EVO_INFO: Record<Exclude<Evo, 'none'>, { name: string; desc: string; color: string }> = {
  safe: { name: 'Ветеран', desc: 'Урон ×2, 100% успех', color: '#8d5bff' },
  risky: { name: 'Берсерк', desc: 'Урон ×3.5, 50% успех; провал = уровень 4', color: '#ff4d6d' },
}

export const makeSwords = (n: number): Unit['swords'] =>
  Array.from({ length: n }, (_, i) => ({ cooldown: (i / n) * (1 / SWORD_RATE), phase: (i / n) * Math.PI * 2 }))

/** Damage of one sword hit. Level adds a little on top of the sword count. */
export function swordDamage(u: Unit): number {
  return Math.round(SWORD_DMG * (1 + 0.2 * (u.level - 1)) * EVO_MUL[u.evo] * 10) / 10
}

/** Rough damage per second of the whole unit (for the codex/tooltips). */
export const unitDps = (u: Unit): number => Math.round(swordDamage(u) * SWORD_RATE * u.level * 10) / 10

export function unitRange(u: Unit): number {
  return BASE_RANGE + (u.level - 1) * 6
}

export function canMerge(a: Unit, b: Unit): boolean {
  return a.id !== b.id && a.level === b.level && a.evo === 'none' && b.evo === 'none' && a.level < MAX_LEVEL
}

/** Render tier: 1 recruit, 2 seasoned, 3 evolved. */
export function unitTier(u: Unit): 1 | 2 | 3 {
  if (u.evo !== 'none') return 3
  return u.level >= 3 ? 2 : 1
}
