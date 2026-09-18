import type { BossKind, BossState, GameState } from './types'

export const BOSS_INFO: Record<BossKind, { name: string; desc: string }> = {
  none: { name: '', desc: '' },
  regen: { name: 'Регенератор', desc: 'Голова лечится' },
  dash: { name: 'Спринтер', desc: 'Делает рывки' },
  shield: { name: 'Панцирник', desc: 'Периодический щит' },
  king: { name: 'Король змей', desc: 'Лечится и делает рывки' },
}

export const DASH_MUL = 2.2
const DASH_EVERY = 6, DASH_TIME = 1.5, SHIELD_EVERY = 10, REGEN_PER_SEC = 0.01, KING_REGEN_PER_SEC = 0.004

export function bossForWave(wave: number, endless: boolean): BossKind {
  if (!endless && wave === 10) return 'king'
  if (endless && wave % 10 === 0) return 'king'
  if (wave % 3 === 0) return (['regen', 'dash', 'shield'] as const)[((wave / 3) - 1) % 3]
  return 'none'
}

export const bossHpMul = (kind: BossKind): number => (kind === 'king' ? 1.3 : kind === 'none' ? 1 : 1.3)

export const newBoss = (kind: BossKind): BossState => ({ kind, timer: 0, next: kind === 'shield' ? 3 : DASH_EVERY, dashT: 0, shield: 0 })

export function tickBoss(s: GameState, dt: number): void {
  const b = s.boss
  const head = s.snake[0]
  if (b.kind === 'none' || !head || !head.head) return
  b.timer += dt
  if (b.kind === 'regen' || b.kind === 'king') head.hp = Math.min(head.maxHp, head.hp + head.maxHp * (b.kind === 'king' ? KING_REGEN_PER_SEC : REGEN_PER_SEC) * dt)
  if (b.kind === 'dash' || b.kind === 'king') {
    if (b.dashT > 0) b.dashT -= dt
    else if (b.timer >= b.next) { b.dashT = DASH_TIME; b.next = b.timer + DASH_EVERY; s.fx.sounds.push('dash') }
  }
  if (b.kind === 'shield' && b.shield <= 0 && b.timer >= b.next) {
    b.shield = head.maxHp * 0.15
    b.next = b.timer + SHIELD_EVERY
    s.fx.sounds.push('shield')
  }
}

/** Damage to the head goes through the shield first. Returns damage actually dealt. */
export function absorb(s: GameState, dmg: number): number {
  if (s.boss.shield <= 0) return dmg
  const a = Math.min(s.boss.shield, dmg)
  s.boss.shield -= a
  return dmg - a
}
