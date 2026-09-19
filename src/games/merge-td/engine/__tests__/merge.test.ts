import { beforeEach, describe, expect, it } from 'vitest'
import { setRng } from '../../../snake-td/engine/rng'
import { bossForWave, damageMul, ENEMY_DEFS, MAX_WAVE, waveSpawns } from '../enemies'
import { availableMerges, createGame, elementPool, moveOrMerge, openChoice, pickChoice, rerollChoice, sellTower, START_GOLD, startWave, tick, towerAt } from '../game'
import { PATH, TILES } from '../layout'
import { canMerge, mergeElements, mergeLevel, towerDamage } from '../towers'
import type { Element, GameState, Tower } from '../types'

const put = (s: GameState, elements: Element[], tile: number, level = 1): Tower => {
  const t = { id: s.nextId++, elements, level, tile, cooldown: 0 }
  s.towers.push(t)
  return t
}

beforeEach(() => setRng(() => 0.3))

describe('merging rules', () => {
  it('levels add up to four at most; elements unite keeping the target primary', () => {
    const a: Tower = { id: 1, elements: ['fire'], level: 1, tile: 0, cooldown: 0 }
    const b: Tower = { id: 2, elements: ['ice'], level: 1, tile: 1, cooldown: 0 }
    expect(mergeLevel(a, b)).toBe(2)
    expect(mergeLevel({ ...a, level: 2 }, { ...b, level: 2 })).toBe(4)
    expect(mergeLevel({ ...a, level: 3 }, { ...b, level: 2 })).toBeNull()
    expect(canMerge(a, a)).toBe(false)
    expect(mergeElements(['ice'], ['fire', 'ice'])).toEqual(['ice', 'fire'])
  })

  it('moveOrMerge merges any two towers and counts a new element as an evolution', () => {
    const s = createGame()
    const fire = put(s, ['fire'], 0, 2), ice = put(s, ['ice'], 1)
    expect(moveOrMerge(s, fire.id, 5)).toBe('moved')
    expect(moveOrMerge(s, fire.id, 1)).toBe('merged')
    expect(ice).toMatchObject({ elements: ['ice', 'fire'], level: 3 })
    expect(s.towers).toHaveLength(1)
    expect(s.merges).toBe(1)
    expect(s.evolutions).toBe(1)
    const same = put(s, ['ice'], 2)
    expect(moveOrMerge(s, same.id, 1)).toBe('merged')
    expect(ice.level).toBe(4)
    expect(s.evolutions).toBe(1)
    const extra = put(s, ['dark'], 3)
    expect(moveOrMerge(s, extra.id, 1)).toBe('blocked')
    expect(availableMerges(s)).toHaveLength(0)
  })
})

describe('placing towers', () => {
  it('offers three distinct elements, no dark before wave 4, charges on pick', () => {
    const s = createGame()
    expect(elementPool(1)).not.toContain('dark')
    expect(elementPool(4)).toContain('dark')
    expect(openChoice(s, 3)).toBe(true)
    expect(new Set(s.choice!.options).size).toBe(3)
    expect(pickChoice(s, 0)).toMatchObject({ tile: 3, level: 1 })
    expect(s.gold).toBe(START_GOLD - 20)
    expect(s.placeCost).toBe(25)
  })

  it('reroll costs gold, sell refunds by level and elements', () => {
    const s = createGame()
    openChoice(s, 0)
    expect(rerollChoice(s)).toBe(true)
    expect(s.gold).toBe(START_GOLD - 5)
    const t = put(s, ['fire', 'ice'], 4, 3)
    expect(sellTower(s, t.id)).toBe(true)
    expect(s.gold).toBe(START_GOLD - 5 + 39)
    expect(towerAt(s, 4)).toBeUndefined()
  })
})

describe('resists and weaknesses', () => {
  it('golem ignores fire and ice, takes double from bolt, mixed towers scale', () => {
    const golem = ENEMY_DEFS.golem
    expect(damageMul(['fire'], golem)).toBe(0)
    expect(damageMul(['fire', 'ice'], golem)).toBe(0)
    expect(damageMul(['bolt'], golem)).toBe(2)
    expect(damageMul(['fire', 'bolt'], golem)).toBe(1)
    expect(damageMul(['fire', 'nature'], golem)).toBe(0.5)
    expect(damageMul(['nature'], ENEMY_DEFS.skeleton)).toBe(1)
  })

  it('a fire-only board cannot scratch the golem; a bolt tower kills it', () => {
    const run = (elements: Element[]) => {
      const s = createGame()
      s.wave = 4
      for (let i = 0; i < TILES.length; i++) put(s, elements, i, 4)
      startWave(s)
      for (let t = 0; t < 60 && s.phase === 'wave'; t += 1 / 30) tick(s, 1 / 30)
      return s
    }
    const fire = run(['fire'])
    // the golem walks through untouched and costs its 3 lives
    expect(fire.lives).toBe(10 - ENEMY_DEFS.golem.lives)
    const bolt = run(['bolt'])
    expect(bolt.wave).toBe(5)
    expect(bolt.lives).toBe(10)
  })

  it('bosses close waves 4, 8 and 12', () => {
    expect(bossForWave(4)).toBe('golem')
    expect(bossForWave(8)).toBe('frostworm')
    expect(bossForWave(12)).toBe('darklord')
    expect(bossForWave(5)).toBeNull()
    expect(waveSpawns(12).some((x) => x.kind === 'darklord')).toBe(true)
    expect(MAX_WAVE).toBe(12)
  })
})

describe('waves', () => {
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
    for (let i = 0; i < TILES.length; i++) put(s, ['fire', 'ice', 'bolt', 'nature'], i, 4)
    startWave(s)
    for (let t = 0; t < 120 && s.phase === 'wave'; t += 1 / 30) tick(s, 1 / 30)
    expect(s.phase).toBe('ready')
    expect(s.wave).toBe(2)
    expect(s.lives).toBe(10)
    expect(s.killed).toBe(waveSpawns(1).length)
    expect(s.gold).toBeGreaterThan(START_GOLD)
    expect(towerDamage(s.towers[0])).toBeGreaterThan(towerDamage({ ...s.towers[0], level: 1 }))
  })

  it('road runs from the top-right down and then left to the base', () => {
    expect(PATH.pts[0].y).toBeLessThan(0)
    expect(PATH.pts[PATH.pts.length - 1].x).toBe(34)
    expect(PATH.length).toBeGreaterThan(600)
  })
})
