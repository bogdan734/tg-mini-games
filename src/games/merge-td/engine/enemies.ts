import type { Element, Enemy, EnemyKind } from './types'

export interface EnemyDef {
  name: string
  hp: number
  speed: number
  r: number
  gold: number
  lives: number
  boss: boolean
  /** elements that do nothing to this enemy */
  resist: Element[]
  /** element that deals double damage */
  weak: Element | null
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  skeleton:  { name: 'Скелет',        hp: 12,  speed: 46, r: 12, gold: 3,  lives: 1, boss: false, resist: [], weak: null },
  wolf:      { name: 'Волк',          hp: 9,   speed: 82, r: 11, gold: 3,  lives: 1, boss: false, resist: [], weak: 'ice' },
  brute:     { name: 'Громила',       hp: 40,  speed: 34, r: 16, gold: 8,  lives: 2, boss: false, resist: ['nature'], weak: 'bolt' },
  golem:     { name: 'Каменный голем', hp: 200, speed: 30, r: 22, gold: 40, lives: 3, boss: true, resist: ['fire', 'ice'], weak: 'bolt' },
  frostworm: { name: 'Ледяной червь', hp: 260, speed: 32, r: 22, gold: 50, lives: 3, boss: true, resist: ['ice', 'nature'], weak: 'fire' },
  darklord:  { name: 'Тёмный лорд',   hp: 340, speed: 28, r: 24, gold: 80, lives: 6, boss: true, resist: ['fire', 'bolt', 'nature'], weak: 'dark' },
}

export const MAX_WAVE = 12
export const hpMul = (wave: number): number => Math.pow(1.3, wave - 1)
/** bosses have their own gentler curve: they are meant to be killed with the right element */
export const bossHpMul = (wave: number): number => Math.pow(1.15, wave - 1)
export const speedMul = (wave: number): number => 1 + (wave - 1) * 0.02

/** Which boss closes a wave (waves 4, 8, 12). */
export const bossForWave = (wave: number): EnemyKind | null => (wave === 4 ? 'golem' : wave === 8 ? 'frostworm' : wave === 12 ? 'darklord' : null)

/** Spawn list for a wave: kind + time offset in seconds. */
export function waveSpawns(wave: number): { kind: EnemyKind; at: number }[] {
  const out: { kind: EnemyKind; at: number }[] = []
  let t = 0
  const push = (kind: EnemyKind, gap: number) => { out.push({ kind, at: t }); t += gap }
  const skel = 6 + wave * 3
  for (let i = 0; i < skel; i++) push('skeleton', 0.9)
  if (wave >= 2) for (let i = 0; i < Math.floor(wave / 2) + 1; i++) push('wolf', 0.5)
  if (wave >= 4) for (let i = 0; i < Math.floor(wave / 3); i++) push('brute', 1.6)
  const boss = bossForWave(wave)
  if (boss) push(boss, 2)
  return out
}

export function makeEnemy(kind: EnemyKind, wave: number, id: number): Enemy {
  const def = ENEMY_DEFS[kind]
  const hp = Math.round(def.hp * (def.boss ? bossHpMul(wave) : hpMul(wave)))
  return { id, kind, hp, maxHp: hp, d: 0, speed: def.speed * speedMul(wave), slow: 0, burn: 0, burnDps: 0, root: 0, curse: 0, hitT: 0, labelT: 0 }
}

/**
 * How much of a tower's damage gets through: each resisted element is dropped, the weak
 * element doubles the rest. Returns 0 when every element is resisted.
 */
export function damageMul(elements: Element[], def: EnemyDef): number {
  const active = elements.filter((e) => !def.resist.includes(e))
  if (!active.length) return 0
  const base = active.length / elements.length
  return def.weak && elements.includes(def.weak) ? base * 2 : base
}
