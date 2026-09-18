import { bossForWave, bossHpMul, newBoss, tickBoss } from './boss'
import { tickCombat, tickFx } from './combat'
import { getLevel } from './levels'
import { pointAt } from './path'
import { pick, rand } from './rng'
import { advanceSnake, makeSnake, removeDead } from './snake'
import type { EventId, GameState, Unit, UnitType } from './types'
import { canMerge, EVO_LEVEL, UNIT_DEFS, UNIT_TYPES } from './units'

export const START_GOLD = 60
export const START_LIVES = 10
export const SHOP_SIZE = 3
export const WAVE_BONUS = 30

export const EVENTS: Record<EventId, { title: string; desc: string; icon: string }> = {
  goldrush: { title: 'Золотая лихорадка', desc: 'Золото за сегменты ×2 на следующей волне', icon: '💰' },
  rush: { title: 'Бешеная змея', desc: 'Змея быстрее на 40%, но золото ×3', icon: '⚡' },
  gift: { title: 'Подарок', desc: 'Бесплатный боец на свободный слот', icon: '🎁' },
  frost: { title: 'Заморозки', desc: 'Змея медленнее на 30% на следующей волне', icon: '❄️' },
}
const EVENT_IDS = Object.keys(EVENTS) as EventId[]

export const maxWave = (s: GameState): number => getLevel(s.level).waves

function rollShop(s: GameState): void {
  // cheaper units more common early
  s.shop = Array.from({ length: SHOP_SIZE }, () => {
    const pool: UnitType[] = s.wave < 3 ? ['volt', 'frost', 'blaze', 'venom'] : UNIT_TYPES
    return pick(pool)
  })
}

export function createGame(level = 1): GameState {
  const s: GameState = {
    phase: 'ready', level, wave: 1, boss: newBoss('none'), lives: START_LIVES, gold: START_GOLD, score: 0, killed: 0,
    units: [], snake: [], headD: 0, shop: [], rerollCost: 10,
    pendingEvo: null, pendingEvent: null, resume: 'ready',
    goldMul: 1, speedMul: 1, fx: { popups: [], beams: [], shots: [], parts: [], sounds: [], shake: 0 }, time: 0, nextId: 1,
  }
  rollShop(s)
  return s
}

export const unitAt = (s: GameState, slot: number): Unit | undefined => s.units.find((u) => u.slot === slot)
export const freeSlots = (s: GameState): number[] => getLevel(s.level).slots.map((_, i) => i).filter((i) => !unitAt(s, i))

function addUnit(s: GameState, type: UnitType, slot: number, level = 1): Unit {
  const u: Unit = { id: s.nextId++, type, level, evo: 'none', slot, cooldown: 0 }
  s.units.push(u)
  return u
}

export function startWave(s: GameState): void {
  if (s.phase !== 'ready') return
  const lvl = getLevel(s.level)
  const kind = bossForWave(s.wave, lvl.waves === Infinity)
  s.boss = newBoss(kind)
  s.snake = makeSnake(s.wave, s.nextId, lvl.hpMul, bossHpMul(kind))
  s.nextId += s.snake.length
  s.headD = 0
  s.phase = 'wave'
  s.fx.sounds.push('wave')
}

function endWave(s: GameState): void {
  s.gold += WAVE_BONUS
  s.score += 100 * s.wave
  s.wave++
  s.goldMul = 1
  s.speedMul = 1
  if (s.wave > maxWave(s)) { s.phase = 'won'; s.fx.sounds.push('win'); return }
  if (s.wave % 2 === 0) {
    s.pendingEvent = pick(EVENT_IDS)
    s.resume = 'ready'
    s.phase = 'event'
  } else s.phase = 'ready'
}

function burst(s: GameState, x: number, y: number, color: string, n: number, big = false): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = (big ? 140 : 90) * (0.5 + rand())
    s.fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0.5 + rand() * 0.3, color, r: big ? 3 + rand() * 4 : 2 + rand() * 2 })
  }
}

export function tick(s: GameState, dt: number): void {
  tickFx(s, dt)
  if (s.phase !== 'wave') return
  s.time += dt
  const passes = advanceSnake(s, dt)
  if (passes > 0) { s.fx.sounds.push('pass'); s.fx.shake = Math.max(s.fx.shake, 0.3) }
  tickBoss(s, dt)
  tickCombat(s, dt)
  const lvl = getLevel(s.level)
  const deadPositions = s.snake.map((_, i) => i)
  const before = [...s.snake]
  for (const dead of removeDead(s)) {
    const g = Math.round((dead.head ? 20 + 5 * s.wave : 2 + Math.floor(s.wave / 3)) * s.goldMul)
    s.gold += g
    s.killed++
    s.score += dead.head ? 25 : 1
    const idx = before.indexOf(dead)
    const d = ((s.headD + (dead.head ? 30 : 0) - deadPositions[idx] * 30) % lvl.path.length + lvl.path.length) % lvl.path.length
    const p = pointAt(lvl.path, d)
    burst(s, p.x, p.y, dead.head ? '#ffd54a' : '#dfe6f3', dead.head ? 26 : 7, dead.head)
    s.fx.popups.push({ x: p.x, y: p.y - 26, text: `+${g}`, t: 0.8, color: '#ffd54a' })
    s.fx.sounds.push(dead.head ? 'killHead' : 'kill')
    if (dead.head) s.fx.shake = Math.max(s.fx.shake, 0.4)
  }
  if (s.lives <= 0) { s.phase = 'over'; s.fx.sounds.push('lose'); return }
  if (s.snake.length === 0) endWave(s)
}

/** Board actions are only legal while the player sees the board. */
export const canAct = (s: GameState): boolean => s.phase === 'ready' || s.phase === 'wave'

export function buyAndPlace(s: GameState, shopIdx: number, slot: number): boolean {
  if (!canAct(s)) return false
  const type = s.shop[shopIdx]
  if (!type || unitAt(s, slot)) return false
  const price = UNIT_DEFS[type].price
  if (s.gold < price) return false
  s.gold -= price
  addUnit(s, type, slot)
  s.shop[shopIdx] = null
  if (s.shop.every((t) => t === null)) rollShop(s)
  s.fx.sounds.push('buy')
  return true
}

export function reroll(s: GameState): boolean {
  if (!canAct(s) || s.gold < s.rerollCost) return false
  s.gold -= s.rerollCost
  s.rerollCost += 5
  rollShop(s)
  s.fx.sounds.push('click')
  return true
}

export type MoveResult = 'moved' | 'merged' | 'blocked'

export function moveOrMerge(s: GameState, unitId: number, slot: number): MoveResult {
  const u = s.units.find((x) => x.id === unitId)
  if (!canAct(s) || !u || u.slot === slot) return 'blocked'
  const target = unitAt(s, slot)
  if (!target) { u.slot = slot; return 'moved' }
  if (!canMerge(u, target)) return 'blocked'
  s.units = s.units.filter((x) => x.id !== u.id)
  target.level++
  s.fx.sounds.push('merge')
  const c = getLevel(s.level).slots[slot]
  burst(s, c.x, c.y, UNIT_DEFS[target.type].color, 12)
  if (target.level === EVO_LEVEL && target.evo === 'none') {
    s.pendingEvo = target.id
    s.resume = s.phase
    s.phase = 'evolution'
  }
  return 'merged'
}

export function chooseEvolution(s: GameState, choice: 'safe' | 'risky'): boolean {
  const u = s.units.find((x) => x.id === s.pendingEvo)
  s.pendingEvo = null
  s.phase = s.resume
  if (!u) return false
  if (choice === 'safe') { u.evo = 'safe'; s.fx.sounds.push('evo'); return true }
  if (rand() < 0.5) { u.evo = 'risky'; s.fx.sounds.push('evo'); return true }
  u.level = Math.max(1, u.level - 1)
  s.fx.sounds.push('error')
  return false
}

export function resolveEvent(s: GameState): void {
  const e = s.pendingEvent
  s.pendingEvent = null
  s.phase = 'ready' // events only happen between waves
  switch (e) {
    case 'goldrush': s.goldMul = 2; break
    case 'rush': s.speedMul = 1.4; s.goldMul = 3; break
    case 'frost': s.speedMul = 0.7; break
    case 'gift': {
      const free = freeSlots(s)
      if (free.length) addUnit(s, pick(UNIT_TYPES), pick(free))
      else s.gold += 25
      break
    }
  }
}

export function sellValue(u: Unit): number {
  return Math.round(UNIT_DEFS[u.type].price * 0.6 * Math.pow(1.8, u.level - 1))
}

export function sellUnit(s: GameState, unitId: number): boolean {
  const u = s.units.find((x) => x.id === unitId)
  if (!canAct(s) || !u) return false
  s.gold += sellValue(u)
  s.units = s.units.filter((x) => x.id !== unitId)
  s.fx.sounds.push('sell')
  return true
}
