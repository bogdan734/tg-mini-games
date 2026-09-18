import { pointAt } from '../../snake-td/engine/path'
import { pick, rand, seeded, setRng } from '../../snake-td/engine/rng'
import { ENEMY_DEFS, makeEnemy, MAX_WAVE, waveSpawns } from './enemies'
import { PATH, TILES } from './layout'
import { BASE_TYPES, mergeOutcome, TOWER_DEFS, towerDamage, towerRange } from './towers'
import type { Enemy, GameState, Tower, TowerType } from './types'

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

function rollOptions(): TowerType[] {
  const pool = [...BASE_TYPES]
  const out: TowerType[] = []
  for (let i = 0; i < CHOICE_SIZE; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return out
}

/** Tap a free tile: offer three base elements. Costs nothing until one is picked. */
export function openChoice(s: GameState, tile: number): boolean {
  if (!canAct(s) || tile < 0 || tile >= TILES.length || towerAt(s, tile)) return false
  if (s.gold < s.placeCost) return false
  s.choice = { tile, options: rollOptions() }
  return true
}

export const closeChoice = (s: GameState): void => { s.choice = null }

export function rerollChoice(s: GameState): boolean {
  if (!s.choice || s.gold < s.rerollCost) return false
  s.gold -= s.rerollCost
  s.choice.options = rollOptions()
  s.fx.sounds.push('click')
  return true
}

export function pickChoice(s: GameState, idx: number): Tower | null {
  const c = s.choice
  if (!c || !canAct(s) || towerAt(s, c.tile)) return null
  const type = c.options[idx]
  if (!type || s.gold < s.placeCost) return null
  s.gold -= s.placeCost
  s.placeCost += 5
  const t: Tower = { id: s.nextId++, type, level: 1, tile: c.tile, cooldown: 0 }
  s.towers.push(t)
  s.choice = null
  s.fx.sounds.push('buy')
  return t
}

export type MoveResult = 'moved' | 'merged' | 'blocked'

export function moveOrMerge(s: GameState, towerId: number, tile: number): MoveResult {
  const a = s.towers.find((t) => t.id === towerId)
  if (!canAct(s) || !a || a.tile === tile || tile < 0 || tile >= TILES.length) return 'blocked'
  const b = towerAt(s, tile)
  if (!b) { a.tile = tile; return 'moved' }
  const out = mergeOutcome(a, b)
  if (!out) return 'blocked'
  s.towers = s.towers.filter((t) => t.id !== a.id)
  if (out.kind === 'level') b.level = out.level
  else { b.type = out.type; b.level = Math.max(a.level, b.level); s.evolutions++ }
  b.cooldown = 0
  s.merges++
  s.fx.sounds.push(out.kind === 'recipe' ? 'evo' : 'merge')
  burst(s, TILES[tile].x, TILES[tile].y, TOWER_DEFS[b.type].color, out.kind === 'recipe' ? 22 : 12)
  return 'merged'
}

export const sellValue = (t: Tower): number => Math.round(8 * TOWER_DEFS[t.type].tier * Math.pow(1.7, t.level - 1))

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

function hit(s: GameState, e: Enemy, dmg: number, color: string): void {
  e.hp -= dmg
  e.hitT = 0.12
  const p = pointAt(PATH, e.d)
  s.fx.popups.push({ x: p.x, y: p.y - 14, text: String(Math.round(dmg)), t: 0.5, color })
}

function applyEffect(s: GameState, t: Tower, target: Enemy, dmg: number): void {
  const def = TOWER_DEFS[t.type]
  const color = def.color
  const inRadius = (r: number) => s.enemies.filter((e) => e.d >= 0 && e.hp > 0 && Math.abs(e.d - target.d) <= r)
  switch (def.effect) {
    case 'burn': target.burn = 3; target.burnDps = Math.max(target.burnDps, dmg * 0.5); break
    case 'slow': target.slow = 1.5; break
    case 'root': target.root = 0.8; break
    case 'chain': {
      const others = s.enemies.filter((e) => e !== target && e.d >= 0 && e.hp > 0).sort((a, b) => Math.abs(a.d - target.d) - Math.abs(b.d - target.d)).slice(0, def.tier === 1 ? 1 : def.tier === 2 ? 2 : 4)
      for (const e of others) hit(s, e, dmg * 0.6, color)
      break
    }
    case 'aoe': {
      for (const e of inRadius(45)) if (e !== target) hit(s, e, dmg * 0.6, color)
      if (t.type === 'firestorm' || t.type === 'mechagod') for (const e of inRadius(45)) { e.burn = 2; e.burnDps = Math.max(e.burnDps, dmg * 0.3) }
      if (t.type === 'blizzard' || t.type === 'glacius') for (const e of inRadius(45)) e.slow = 1.5
      break
    }
    case 'none': break
  }
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
    t.cooldown = 1 / TOWER_DEFS[t.type].rate
    const dmg = towerDamage(t)
    const p = pointAt(PATH, best.d)
    s.fx.shots.push({ x: c.x, y: c.y - 16, tx: p.x, ty: p.y, t: 0, type: t.type })
    s.fx.sounds.push(`shot:${t.type}`)
    hit(s, best, dmg, TOWER_DEFS[t.type].color)
    applyEffect(s, t, best, dmg)
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
    if (e.hitT > 0) e.hitT -= dt
    const mul = e.root > 0 ? 0 : e.slow > 0 ? 0.5 : 1
    e.d += e.speed * mul * dt
  }
  const alive: Enemy[] = []
  for (const e of s.enemies) {
    if (e.hp <= 0) {
      const def = ENEMY_DEFS[e.kind]
      s.gold += def.gold
      s.killed++
      s.score += e.kind === 'boss' ? 30 : 1
      const p = pointAt(PATH, e.d)
      burst(s, p.x, p.y, def.color, e.kind === 'boss' ? 24 : 6)
      s.fx.popups.push({ x: p.x, y: p.y - 26, text: `+${def.gold}`, t: 0.7, color: '#ffd54a' })
      s.fx.sounds.push(e.kind === 'boss' ? 'killHead' : 'kill')
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
  s.fx.shots = s.fx.shots.filter((sh) => sh.t < 0.14)
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

/** Hint for the player: merges available right now on the board. */
export function availableMerges(s: GameState): { a: Tower; b: Tower; result: TowerType | 'level' }[] {
  const out: { a: Tower; b: Tower; result: TowerType | 'level' }[] = []
  for (let i = 0; i < s.towers.length; i++) for (let j = i + 1; j < s.towers.length; j++) {
    const o = mergeOutcome(s.towers[i], s.towers[j])
    if (o) out.push({ a: s.towers[i], b: s.towers[j], result: o.kind === 'level' ? 'level' : o.type })
  }
  return out
}

export { pick }
