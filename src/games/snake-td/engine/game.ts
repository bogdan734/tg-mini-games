import { bossForWave, bossHpMul, newBoss, tickBoss } from './boss'
import { hitFlask, tickCombat, tickFx } from './combat'
import { getLevel } from './levels'
import { pointAt } from './path'
import { pick, rand, seeded, setRng } from './rng'
import { advanceSnake, makeSnake, removeDead, segmentPos } from './snake'
import type { EventId, Flask, GameState, Unit } from './types'
import { canMerge, EVO_LEVEL, makeSwords, unitRange } from './units'

export const START_LIVES = 10
export const FLASK_HP = 5
export const MAX_FLASKS = 3
/** kills needed for a flask: FLASK_BASE + wave */
export const FLASK_BASE = 2

export const EVENTS: Record<EventId, { title: string; desc: string; icon: string }> = {
  flaskrain: { title: 'Дождь колб', desc: 'Две колбы сразу и колбы падают вдвое чаще на следующей волне', icon: '🧪' },
  rush: { title: 'Бешеный червь', desc: 'Червь быстрее на 40%, но колбы падают втрое чаще', icon: '⚡' },
  gift: { title: 'Подкрепление', desc: 'Мечник 2-го уровня на свободную позицию', icon: '🎁' },
  frost: { title: 'Заморозки', desc: 'Червь медленнее на 30% на следующей волне', icon: '❄️' },
}
const EVENT_IDS = Object.keys(EVENTS) as EventId[]

export const maxWave = (s: GameState): number => getLevel(s.level).waves
export const unitAt = (s: GameState, slot: number): Unit | undefined => s.units.find((u) => u.slot === slot)
export const flaskAt = (s: GameState, slot: number): Flask | undefined => s.flasks.find((f) => f.slot === slot)
export const freeSlots = (s: GameState): number[] =>
  getLevel(s.level).slots.map((_, i) => i).filter((i) => !unitAt(s, i) && !flaskAt(s, i))
export const canAct = (s: GameState): boolean => s.phase === 'ready' || s.phase === 'wave'

function addUnit(s: GameState, slot: number, level = 1): Unit {
  const u: Unit = { id: s.nextId++, level, evo: 'none', slot, swords: makeSwords(level) }
  s.units.push(u)
  return u
}

/** Drop a flask on a free slot, preferring one some swordsman can reach (else the player taps it). */
export function spawnFlask(s: GameState): Flask | null {
  if (s.flasks.length >= MAX_FLASKS) return null
  const free = freeSlots(s)
  if (!free.length) return null
  const slots = getLevel(s.level).slots
  const reachable = free.filter((i) => s.units.some((u) => Math.hypot(slots[u.slot].x - slots[i].x, slots[u.slot].y - slots[i].y) <= unitRange(u)))
  const f: Flask = { id: s.nextId++, slot: pick(reachable.length ? reachable : free), hp: FLASK_HP, maxHp: FLASK_HP, age: 0 }
  s.flasks.push(f)
  s.fx.sounds.push('flask')
  return f
}

export function createGame(level = 1, seed: number | null = null): GameState {
  setRng(seed === null ? Math.random : seeded(seed))
  const lvl = getLevel(level)
  const s: GameState = {
    phase: 'ready', level, wave: 1, boss: newBoss('none'), lives: START_LIVES, score: 0, killed: 0, merges: 0, evolutions: 0, seed,
    units: [], flasks: [], snake: [], headD: 0, killsSinceFlask: 0,
    pendingEvo: null, pendingEvent: null, resume: 'ready',
    flaskMul: 1, speedMul: 1, fx: { popups: [], shots: [], parts: [], sounds: [], shake: 0 }, time: 0, nextId: 1,
  }
  // start with one swordsman near the road and one flask to break
  addUnit(s, Math.min(3, lvl.slots.length - 1))
  spawnFlask(s)
  return s
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
  s.score += 100 * s.wave
  s.wave++
  s.flaskMul = 1
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

/** Broken flasks release swordsmen. */
function tickFlasks(s: GameState, dt: number): void {
  const lvl = getLevel(s.level)
  for (const f of s.flasks) f.age += dt
  const broken = s.flasks.filter((f) => f.hp <= 0)
  if (!broken.length) return
  s.flasks = s.flasks.filter((f) => f.hp > 0)
  for (const f of broken) {
    const c = lvl.slots[f.slot]
    burst(s, c.x, c.y, '#bfe8ff', 14)
    addUnit(s, f.slot)
    s.fx.sounds.push('spawn')
    s.fx.popups.push({ x: c.x, y: c.y - 40, text: 'Мечник!', t: 0.9, color: '#ffd54a' })
  }
}

export function tick(s: GameState, dt: number): void {
  tickFx(s, dt)
  if (s.phase !== 'ready' && s.phase !== 'wave') return
  tickFlasks(s, dt)
  if (s.phase !== 'wave') { tickCombat(s, dt); return } // swords still break flasks between waves
  s.time += dt
  const passes = advanceSnake(s, dt)
  if (passes > 0) { s.fx.sounds.push('pass'); s.fx.shake = Math.max(s.fx.shake, 0.3) }
  tickBoss(s, dt)
  tickCombat(s, dt)
  const lvl = getLevel(s.level)
  const positions = s.snake.map((_, i) => segmentPos(s, i))
  for (const { seg, index } of removeDead(s)) {
    s.killed++
    s.score += seg.head ? 25 : 1
    const p = pointAt(lvl.path, positions[index])
    burst(s, p.x, p.y, seg.head ? '#ffd54a' : '#dfe6f3', seg.head ? 26 : 7, seg.head)
    s.fx.sounds.push(seg.head ? 'killHead' : 'kill')
    if (seg.head) s.fx.shake = Math.max(s.fx.shake, 0.4)
    s.killsSinceFlask++
    const need = Math.max(2, Math.round((FLASK_BASE + s.wave) / s.flaskMul))
    if (seg.head || s.killsSinceFlask >= need) {
      if (spawnFlask(s)) { s.killsSinceFlask = 0; s.fx.popups.push({ x: p.x, y: p.y - 28, text: '🧪 колба!', t: 0.9, color: '#bfe8ff' }) }
    }
  }
  if (s.lives <= 0) { s.phase = 'over'; s.fx.sounds.push('lose'); return }
  if (s.snake.length === 0) endWave(s)
}

/** Player taps a flask: one hit. */
export function tapFlask(s: GameState, flaskId: number): boolean {
  const f = s.flasks.find((x) => x.id === flaskId)
  if (!canAct(s) || !f) return false
  hitFlask(s, f)
  return true
}

export type MoveResult = 'moved' | 'merged' | 'blocked'

export function moveOrMerge(s: GameState, unitId: number, slot: number): MoveResult {
  const u = s.units.find((x) => x.id === unitId)
  if (!canAct(s) || !u || u.slot === slot) return 'blocked'
  if (flaskAt(s, slot)) return 'blocked'
  const target = unitAt(s, slot)
  if (!target) { u.slot = slot; return 'moved' }
  if (!canMerge(u, target)) return 'blocked'
  s.units = s.units.filter((x) => x.id !== u.id)
  target.level++
  target.swords = makeSwords(target.level)
  s.merges++
  s.fx.sounds.push('merge')
  const c = getLevel(s.level).slots[slot]
  burst(s, c.x, c.y, '#ffd54a', 12)
  if (target.level >= EVO_LEVEL && target.evo === 'none') {
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
  s.evolutions++
  if (choice === 'safe') { u.evo = 'safe'; s.fx.sounds.push('evo'); return true }
  if (rand() < 0.5) { u.evo = 'risky'; s.fx.sounds.push('evo'); return true }
  u.level = EVO_LEVEL - 1
  u.swords = makeSwords(u.level)
  s.fx.sounds.push('error')
  return false
}

export function resolveEvent(s: GameState): void {
  const e = s.pendingEvent
  s.pendingEvent = null
  s.phase = 'ready'
  switch (e) {
    case 'flaskrain': s.flaskMul = 2; spawnFlask(s); spawnFlask(s); break
    case 'rush': s.speedMul = 1.4; s.flaskMul = 3; break
    case 'frost': s.speedMul = 0.7; break
    case 'gift': {
      const free = freeSlots(s)
      if (free.length) addUnit(s, pick(free), 2)
      else spawnFlask(s)
      break
    }
  }
}
