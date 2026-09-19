import { pointAt } from '../../snake-td/engine/path'
import { pick, rand, seeded, setRng } from '../../snake-td/engine/rng'
import { damageMul, ENEMY_DEFS, makeEnemy, MAX_WAVE, waveSpawns } from './enemies'
import { PATH, TILES } from './layout'
import { canMerge, ELEMENT_IDS, ELEMENTS, mergeElements, mergeLevel, towerDamage, towerRange, towerRate } from './towers'
import type { Element, Enemy, GameState, Tower } from './types'

export const START_GOLD = 60
export const START_LIVES = 10
export const WAVE_BONUS = 25
const CHOICE_SIZE = 3

export function createGame(seed: number | null = null): GameState {
  setRng(seed === null ? Math.random : seeded(seed))
  return {
    phase: 'ready', wave: 1, lives: START_LIVES, gold: START_GOLD, score: 0, killed: 0, merges: 0, evolutions: 0, seed,
    towers: [], enemies: [], spawnQueue: [], waveTime: 0, choice: null, placeCost: 20, rerollCost: 5,
    fx: { popups: [], shots: [], parts: [], sounds: [], shake: 0 }, nextId: 1,
  }
}

export const towerAt = (s: GameState, tile: number): Tower | undefined => s.towers.find((t) => t.tile === tile)
export const canAct = (s: GameState): boolean => s.phase === 'ready' || s.phase === 'wave'

/** Elements offered by the tile choice: dark shows up from wave 4 (the golem teaches resists first). */
export const elementPool = (wave: number): Element[] => (wave >= 4 ? ELEMENT_IDS : ELEMENT_IDS.filter((e) => e !== 'dark'))

function rollOptions(wave: number): Element[] {
  const pool = [...elementPool(wave)]
  const out: Element[] = []
  for (let i = 0; i < CHOICE_SIZE; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return out
}

export function openChoice(s: GameState, tile: number): boolean {
  if (!canAct(s) || tile < 0 || tile >= TILES.length || towerAt(s, tile)) return false
  if (s.gold < s.placeCost) return false
  s.choice = { tile, options: rollOptions(s.wave) }
  return true
}

export const closeChoice = (s: GameState): void => { s.choice = null }

export function rerollChoice(s: GameState): boolean {
  if (!s.choice || s.gold < s.rerollCost) return false
  s.gold -= s.rerollCost
  s.choice.options = rollOptions(s.wave)
  s.fx.sounds.push('click')
  return true
}

export function pickChoice(s: GameState, idx: number): Tower | null {
  const c = s.choice
  if (!c || !canAct(s) || towerAt(s, c.tile)) return null
  const el = c.options[idx]
  if (!el || s.gold < s.placeCost) return null
  s.gold -= s.placeCost
  s.placeCost += 5
  const t: Tower = { id: s.nextId++, elements: [el], level: 1, tile: c.tile, cooldown: 0 }
  s.towers.push(t)
  s.choice = null
  s.fx.sounds.push('buy')
  return t
}

export type MoveResult = 'moved' | 'merged' | 'blocked'

/** Any two towers merge while their levels add up to four or less; elements unite. */
export function moveOrMerge(s: GameState, towerId: number, tile: number): MoveResult {
  const a = s.towers.find((t) => t.id === towerId)
  if (!canAct(s) || !a || a.tile === tile || tile < 0 || tile >= TILES.length) return 'blocked'
  const b = towerAt(s, tile)
  if (!b) { a.tile = tile; return 'moved' }
  const lvl = mergeLevel(a, b)
  if (lvl === null) return 'blocked'
  const gained = mergeElements(b.elements, a.elements).length > b.elements.length
  s.towers = s.towers.filter((t) => t.id !== a.id)
  b.elements = mergeElements(b.elements, a.elements)
  b.level = lvl
  b.cooldown = 0
  s.merges++
  if (gained) s.evolutions++
  s.fx.sounds.push(gained ? 'evo' : 'merge')
  burst(s, TILES[tile].x, TILES[tile].y, ELEMENTS[b.elements[0]].color, gained ? 22 : 12)
  return 'merged'
}

export const sellValue = (t: Tower): number => Math.round(10 * t.level * (1 + 0.3 * (t.elements.length - 1)))

export function sellTower(s: GameState, towerId: number): boolean {
  const t = s.towers.find((x) => x.id === towerId)
  if (!canAct(s) || !t) return false
  s.gold += sellValue(t)
  s.towers = s.towers.filter((x) => x.id !== towerId)
  s.fx.sounds.push('sell')
  return true
}

export function startWave(s: GameState): void {
  if (s.phase !== 'ready') return
  s.spawnQueue = waveSpawns(s.wave)
  s.waveTime = 0
  s.choice = null
  s.phase = 'wave'
  s.fx.sounds.push('wave')
}

function burst(s: GameState, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, v = 80 * (0.5 + rand())
    s.fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0.4 + rand() * 0.3, color, r: 2 + rand() * 2.5 })
  }
}

/** Apply a hit with the tower's elements: resists drop elements, weakness doubles, curse amplifies. */
function hit(s: GameState, e: Enemy, elements: Element[], dmg: number, primary: boolean): number {
  const def = ENEMY_DEFS[e.kind]
  const mul = damageMul(elements, def)
  const p = pointAt(PATH, e.d)
  if (mul === 0) {
    e.hitT = 0.06
    if (primary && e.labelT <= 0) { s.fx.popups.push({ x: p.x, y: p.y - 16, text: 'РЕЗИСТ', t: 0.7, color: '#b8c0d0' }); e.labelT = 0.9 }
    return 0
  }
  const dealt = dmg * mul * (e.curse > 0 ? 1.4 : 1)
  e.hp -= dealt
  e.hitT = 0.12
  const weak = def.weak && elements.includes(def.weak)
  if (primary) {
    s.fx.popups.push({ x: p.x, y: p.y - 14, text: weak ? `${Math.round(dealt)}!` : String(Math.round(dealt)), t: 0.5, color: weak ? '#ffd54a' : ELEMENTS[elements[0]].color })
    if (weak && e.labelT <= 0) { s.fx.popups.push({ x: p.x, y: p.y - 30, text: 'СЛАБОСТЬ ×2', t: 0.7, color: '#ffd54a' }); e.labelT = 1.2 }
  }
  for (const el of elements) {
    if (def.resist.includes(el)) continue
    switch (el) {
      case 'fire': e.burn = 3; e.burnDps = Math.max(e.burnDps, dealt * 0.4); break
      case 'ice': e.slow = 1.5; break
      case 'nature': e.root = 0.8; break
      case 'dark': e.curse = 2.5; break
      case 'bolt': break
    }
  }
  return dealt
}

function tickTowers(s: GameState, dt: number): void {
  for (const t of s.towers) {
    t.cooldown -= dt
    if (t.cooldown > 0) continue
    const c = TILES[t.tile]
    const range = towerRange(t)
    let best: Enemy | null = null
    for (const e of s.enemies) {
      if (e.d < 0 || e.hp <= 0) continue
      const p = pointAt(PATH, e.d)
      if (Math.hypot(p.x - c.x, p.y - c.y) <= range && (!best || e.d > best.d)) best = e
    }
    if (!best) continue
    t.cooldown = 1 / towerRate(t)
    const dmg = towerDamage(t)
    const p = pointAt(PATH, best.d)
    s.fx.shots.push({ x: c.x, y: c.y - 16, tx: p.x, ty: p.y, t: 0, elements: [...t.elements], towerId: t.id, level: t.level })
    s.fx.sounds.push(`shot:${t.elements[0]}`)
    hit(s, best, t.elements, dmg, true)
    if (t.elements.includes('bolt') && !ENEMY_DEFS[best.kind].resist.includes('bolt')) {
      const others = s.enemies.filter((e) => e !== best && e.d >= 0 && e.hp > 0).sort((a, b) => Math.abs(a.d - best!.d) - Math.abs(b.d - best!.d)).slice(0, 2)
      for (const e of others) hit(s, e, t.elements, dmg * 0.6, false)
    }
  }
}

function tickEnemies(s: GameState, dt: number): void {
  s.waveTime += dt
  while (s.spawnQueue.length && s.spawnQueue[0].at <= s.waveTime) {
    const sp = s.spawnQueue.shift()!
    s.enemies.push(makeEnemy(sp.kind, s.wave, s.nextId++))
  }
  for (const e of s.enemies) {
    if (e.burn > 0) { e.burn -= dt; e.hp -= e.burnDps * dt }
    if (e.slow > 0) e.slow -= dt
    if (e.root > 0) e.root -= dt
    if (e.curse > 0) e.curse -= dt
    if (e.hitT > 0) e.hitT -= dt
    if (e.labelT > 0) e.labelT -= dt
    const mul = e.root > 0 ? 0 : e.slow > 0 ? 0.5 : 1
    e.d += e.speed * mul * dt
  }
  const alive: Enemy[] = []
  for (const e of s.enemies) {
    if (e.hp <= 0) {
      const def = ENEMY_DEFS[e.kind]
      s.gold += def.gold
      s.killed++
      s.score += def.boss ? 30 : 1
      const p = pointAt(PATH, e.d)
      burst(s, p.x, p.y, def.boss ? '#ffd54a' : '#dfe6f3', def.boss ? 24 : 6)
      s.fx.popups.push({ x: p.x, y: p.y - 26, text: `+${def.gold}`, t: 0.7, color: '#ffd54a' })
      s.fx.sounds.push(def.boss ? 'killHead' : 'kill')
      continue
    }
    if (e.d >= PATH.length) {
      s.lives = Math.max(0, s.lives - ENEMY_DEFS[e.kind].lives)
      s.fx.sounds.push('pass')
      s.fx.shake = Math.max(s.fx.shake, 0.3)
      continue
    }
    alive.push(e)
  }
  s.enemies = alive
}

export function tickFx(s: GameState, dt: number): void {
  for (const p of s.fx.popups) { p.t -= dt; p.y -= 24 * dt }
  for (const sh of s.fx.shots) sh.t += dt
  for (const pt of s.fx.parts) { pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 220 * dt }
  s.fx.popups = s.fx.popups.filter((p) => p.t > 0)
  s.fx.shots = s.fx.shots.filter((sh) => sh.t < 0.9)
  s.fx.parts = s.fx.parts.filter((pt) => pt.t > 0)
  if (s.fx.shake > 0) s.fx.shake = Math.max(0, s.fx.shake - dt)
}

export function tick(s: GameState, dt: number): void {
  tickFx(s, dt)
  if (s.phase !== 'wave') return
  tickEnemies(s, dt)
  tickTowers(s, dt)
  if (s.lives <= 0) { s.phase = 'over'; s.fx.sounds.push('lose'); return }
  if (s.spawnQueue.length === 0 && s.enemies.length === 0) {
    s.gold += WAVE_BONUS
    s.score += 100 * s.wave
    s.wave++
    if (s.wave > MAX_WAVE) { s.phase = 'won'; s.fx.sounds.push('win') } else s.phase = 'ready'
  }
}

/** Merges available right now (pairs whose levels add up to four or less). */
export function availableMerges(s: GameState): { a: Tower; b: Tower; level: number; elements: Element[] }[] {
  const out: { a: Tower; b: Tower; level: number; elements: Element[] }[] = []
  for (let i = 0; i < s.towers.length; i++) for (let j = i + 1; j < s.towers.length; j++) {
    const a = s.towers[i], b = s.towers[j]
    if (canMerge(a, b)) out.push({ a, b, level: mergeLevel(a, b)!, elements: mergeElements(b.elements, a.elements) })
  }
  return out
}

export { pick }
