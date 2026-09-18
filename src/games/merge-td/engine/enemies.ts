import type { Enemy, EnemyKind } from './types'

export const ENEMY_DEFS: Record<EnemyKind, { name: string; hp: number; speed: number; r: number; gold: number; lives: number; color: string }> = {
  skeleton: { name: 'Скелет', hp: 12, speed: 46, r: 12, gold: 3, lives: 1, color: '#e8e6dc' },
  wolf:     { name: 'Волк',   hp: 9,  speed: 78, r: 11, gold: 3, lives: 1, color: '#9aa1b3' },
  brute:    { name: 'Громила', hp: 40, speed: 34, r: 16, gold: 8, lives: 2, color: '#b27d5a' },
  boss:     { name: 'Червь',  hp: 180, speed: 30, r: 22, gold: 40, lives: 3, color: '#c3ecff' },
}

export const MAX_WAVE = 12
export const hpMul = (wave: number): number => Math.pow(1.28, wave - 1)
export const speedMul = (wave: number): number => 1 + (wave - 1) * 0.02

/** Spawn list for a wave: kind + time offset in seconds. */
export function waveSpawns(wave: number): { kind: EnemyKind; at: number }[] {
  const out: { kind: EnemyKind; at: number }[] = []
  let t = 0
  const push = (kind: EnemyKind, gap: number) => { out.push({ kind, at: t }); t += gap }
  const skel = 6 + wave * 3
  for (let i = 0; i < skel; i++) push('skeleton', 0.9)
  if (wave >= 2) for (let i = 0; i < Math.floor(wave / 2) + 1; i++) push('wolf', 0.5)
  if (wave >= 4) for (let i = 0; i < Math.floor(wave / 3); i++) push('brute', 1.6)
  if (wave % 4 === 0) push('boss', 2)
  return out
}

export function makeEnemy(kind: EnemyKind, wave: number, id: number): Enemy {
  const def = ENEMY_DEFS[kind]
  const hp = Math.round(def.hp * hpMul(wave))
  return { id, kind, hp, maxHp: hp, d: 0, speed: def.speed * speedMul(wave), slow: 0, burn: 0, burnDps: 0, root: 0, hitT: 0 }
}
