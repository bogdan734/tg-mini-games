import { beforeEach, describe, expect, it } from 'vitest'
import { setRng } from '../../../snake-td/engine/rng'
import { MAX_WAVE, waveSpawns } from '../enemies'
import { availableMerges, createGame, moveOrMerge, openChoice, pickChoice, rerollChoice, sellTower, START_GOLD, startWave, tick, towerAt } from '../game'
import { PATH, TILES } from '../layout'
import { mergeOutcome, recipeFor, RECIPES, TOWER_DEFS } from '../towers'
import type { GameState, Tower, TowerType } from '../types'

const put = (s: GameState, type: TowerType, tile: number, level = 1): Tower => {
  const t = { id: s.nextId++, type, level, tile, cooldown: 0 }
  s.towers.push(t)
  return t
}

beforeEach(() => setRng(() => 0.3))

describe('recipes', () => {
  it('are symmetric and every result is a defined higher-tier tower', () => {
    expect(recipeFor('fire', 'robot')).toBe('firebot')
    expect(recipeFor('robot', 'fire')).toBe('firebot')
    expect(recipeFor('firebot', 'storm')).toBe('mechagod')
    expect(recipeFor('fire', 'ice')).toBeUndefined()
    for (const [k, r] of RECIPES) {
      const [a, b] = k.split('+') as TowerType[]
      expect(TOWER_DEFS[r].tier).toBeGreaterThan(Math.min(TOWER_DEFS[a].tier, TOWER_DEFS[b].tier))
    }
  })

  it('same type + same level levels up, otherwise recipe or nothing', () => {
    const a: Tower = { id: 1, type: 'fire', level: 1, tile: 0, cooldown: 0 }
    expect(mergeOutcome(a, { ...a, id: 2, tile: 1 })).toEqual({ kind: 'level', level: 2 })
    expect(mergeOutcome(a, { ...a, id: 2, tile: 1, level: 2 })).toBeNull()
    expect(mergeOutcome(a, { id: 3, type: 'storm', level: 1, tile: 1, cooldown: 0 })).toEqual({ kind: 'recipe', type: 'firestorm' })
    expect(mergeOutcome(a, { id: 3, type: 'ice', level: 1, tile: 1, cooldown: 0 })).toBeNull()
  })
})

describe('placing towers', () => {
  it('offers three distinct base elements on a free tile and charges on pick', () => {
    const s = createGame()
    expect(openChoice(s, 3)).toBe(true)
    expect(new Set(s.choice!.options).size).toBe(3)
    expect(pickChoice(s, 0)).toMatchObject({ tile: 3, level: 1 })
    expect(s.gold).toBe(START_GOLD - 20)
    expect(s.placeCost).toBe(25)
    expect(openChoice(s, 3)).toBe(false)
  })

  it('refuses when broke, reroll costs gold', () => {
    const s = createGame()
    s.gold = 10
    expect(openChoice(s, 0)).toBe(false)
    s.gold = 30
    openChoice(s, 0)
    expect(rerollChoice(s)).toBe(true)
    expect(s.gold).toBe(25)
  })
})

describe('moving and merging', () => {
  it('moves into a free tile, merges by recipe keeping the higher level', () => {
    const s = createGame()
    const fire = put(s, 'fire', 0, 2), robot = put(s, 'robot', 1)
    expect(moveOrMerge(s, fire.id, 5)).toBe('moved')
    expect(moveOrMerge(s, fire.id, 1)).toBe('merged')
    expect(robot).toMatchObject({ type: 'firebot', level: 2 })
    expect(s.towers).toHaveLength(1)
    expect(s.merges).toBe(1)
    expect(s.evolutions).toBe(1)
  })

  it('levels up equal towers and blocks impossible merges', () => {
    const s = createGame()
    const a = put(s, 'ice', 0), b = put(s, 'ice', 1), c = put(s, 'fire', 2)
    expect(moveOrMerge(s, a.id, 1)).toBe('merged')
    expect(b.level).toBe(2)
    expect(moveOrMerge(s, c.id, 1)).toBe('blocked')
    expect(availableMerges(s)).toHaveLength(0)
  })

  it('sells for gold', () => {
    const s = createGame()
    const t = put(s, 'mechagod', 0, 2)
    expect(sellTower(s, t.id)).toBe(true)
    expect(s.gold).toBe(START_GOLD + Math.round(8 * 3 * 1.7))
    expect(towerAt(s, 0)).toBeUndefined()
  })
})

describe('waves', () => {
  it('spawn lists grow and bosses come every 4th wave', () => {
    expect(waveSpawns(1).length).toBeLessThan(waveSpawns(6).length)
    expect(waveSpawns(4).some((x) => x.kind === 'boss')).toBe(true)
    expect(waveSpawns(3).some((x) => x.kind === 'boss')).toBe(false)
    expect(MAX_WAVE).toBe(12)
  })

  it('an empty board bleeds lives and loses within a few waves', () => {
    const s = createGame()
    for (let w = 0; w < 4 && s.phase !== 'over'; w++) {
      startWave(s)
      for (let t = 0; t < 120 && s.phase === 'wave'; t += 0.1) tick(s, 0.1)
    }
    expect(s.phase).toBe('over')
    expect(s.lives).toBe(0)
  })

  it('a strong board clears wave 1 with gold and score', () => {
    const s = createGame()
    for (let i = 0; i < TILES.length; i++) put(s, 'mechagod', i, 3)
    startWave(s)
    for (let t = 0; t < 120 && s.phase === 'wave'; t += 1 / 30) tick(s, 1 / 30)
    expect(s.phase).toBe('ready')
    expect(s.wave).toBe(2)
    expect(s.lives).toBe(10)
    expect(s.killed).toBe(waveSpawns(1).length)
    expect(s.gold).toBeGreaterThan(START_GOLD)
  })

  it('road runs from the top-right down and then left to the base', () => {
    expect(PATH.pts[0].y).toBeLessThan(0)
    expect(PATH.pts[PATH.pts.length - 1].x).toBe(34)
    expect(PATH.length).toBeGreaterThan(600)
  })
})
