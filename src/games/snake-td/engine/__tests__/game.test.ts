import { beforeEach, describe, expect, it } from 'vitest'
import {
  buyAndPlace, chooseEvolution, createGame, moveOrMerge, reroll, resolveEvent,
  sellUnit, startWave, tick, unitAt, START_GOLD, START_LIVES,
} from '../game'
import { setRng } from '../rng'
import type { GameState, UnitType } from '../types'
import { UNIT_DEFS } from '../units'

const put = (s: GameState, type: UnitType, slot: number, level = 1) => {
  const u = { id: s.nextId++, type, level, evo: 'none' as const, slot, cooldown: 0 }
  s.units.push(u)
  return u
}

beforeEach(() => setRng(() => 0.3))

describe('createGame', () => {
  it('starts in ready phase with gold, lives and a full shop', () => {
    const s = createGame()
    expect(s.phase).toBe('ready')
    expect(s.gold).toBe(START_GOLD)
    expect(s.lives).toBe(START_LIVES)
    expect(s.shop).toHaveLength(3)
    expect(s.shop.every(Boolean)).toBe(true)
  })
})

describe('buyAndPlace', () => {
  it('charges the price and places a level-1 unit', () => {
    const s = createGame()
    const type = s.shop[0]!
    expect(buyAndPlace(s, 0, 5)).toBe(true)
    expect(s.gold).toBe(START_GOLD - UNIT_DEFS[type].price)
    expect(unitAt(s, 5)).toMatchObject({ type, level: 1, slot: 5 })
    expect(s.shop[0]).toBeNull()
  })

  it('refuses occupied slots and empty wallets', () => {
    const s = createGame()
    buyAndPlace(s, 0, 5)
    expect(buyAndPlace(s, 1, 5)).toBe(false)
    s.gold = 0
    expect(buyAndPlace(s, 1, 6)).toBe(false)
  })

  it('refills the shop once every offer is sold', () => {
    const s = createGame()
    s.gold = 999
    buyAndPlace(s, 0, 0); buyAndPlace(s, 1, 1); buyAndPlace(s, 2, 2)
    expect(s.shop.every(Boolean)).toBe(true)
  })
})

describe('reroll', () => {
  it('costs gold and gets pricier', () => {
    const s = createGame()
    expect(reroll(s)).toBe(true)
    expect(s.gold).toBe(START_GOLD - 10)
    expect(s.rerollCost).toBe(15)
  })
})

describe('moveOrMerge', () => {
  it('moves a unit into a free slot', () => {
    const s = createGame()
    const u = put(s, 'volt', 0)
    expect(moveOrMerge(s, u.id, 3)).toBe('moved')
    expect(u.slot).toBe(3)
  })

  it('merges equal units into one of the next level', () => {
    const s = createGame()
    const a = put(s, 'volt', 0)
    const b = put(s, 'volt', 1)
    expect(moveOrMerge(s, a.id, 1)).toBe('merged')
    expect(s.units).toHaveLength(1)
    expect(b.level).toBe(2)
  })

  it('blocks merging different types or levels', () => {
    const s = createGame()
    const a = put(s, 'volt', 0)
    put(s, 'frost', 1)
    put(s, 'volt', 2, 2)
    expect(moveOrMerge(s, a.id, 1)).toBe('blocked')
    expect(moveOrMerge(s, a.id, 2)).toBe('blocked')
  })

  it('opens the evolution choice when a level-3 unit is born', () => {
    const s = createGame()
    const a = put(s, 'blaze', 0, 2)
    const b = put(s, 'blaze', 1, 2)
    moveOrMerge(s, a.id, 1)
    expect(s.phase).toBe('evolution')
    expect(s.pendingEvo).toBe(b.id)
    expect(chooseEvolution(s, 'safe')).toBe(true)
    expect(b.evo).toBe('safe')
    expect(s.phase).toBe('ready')
  })

  it('risky evolution can fail and drop a level', () => {
    const s = createGame()
    const a = put(s, 'blaze', 0, 2)
    const b = put(s, 'blaze', 1, 2)
    moveOrMerge(s, a.id, 1)
    setRng(() => 0.9)
    expect(chooseEvolution(s, 'risky')).toBe(false)
    expect(b.evo).toBe('none')
    expect(b.level).toBe(2)
  })
})

describe('waves', () => {
  it('startWave spawns the snake and tick moves it', () => {
    const s = createGame()
    startWave(s)
    expect(s.phase).toBe('wave')
    expect(s.snake).toHaveLength(14)
    tick(s, 0.5)
    expect(s.headD).toBeGreaterThan(0)
  })

  it('a strong defense clears the wave, pays gold and triggers an event before wave 2', () => {
    const s = createGame()
    for (let i = 0; i < 16; i++) put(s, 'shadow', i, 4)
    startWave(s)
    const gold = s.gold
    for (let t = 0; t < 120 && s.phase === 'wave'; t += 1 / 30) tick(s, 1 / 30)
    expect(s.wave).toBe(2)
    expect(s.phase).toBe('event')
    expect(s.gold).toBeGreaterThan(gold)
    expect(s.killed).toBe(14)
    expect(s.lives).toBe(START_LIVES)
    resolveEvent(s)
    expect(s.phase).toBe('ready')
  })

  it('an empty board loses lives and the game', () => {
    const s = createGame()
    startWave(s)
    for (let t = 0; t < 200 && s.phase === 'wave'; t += 0.1) tick(s, 0.1)
    expect(s.lives).toBe(0)
    expect(s.phase).toBe('over')
  })
})

describe('phase guards', () => {
  it('blocks board actions while an event or evolution overlay is up', () => {
    const s = createGame()
    const a = put(s, 'volt', 0)
    put(s, 'volt', 1)
    s.phase = 'event'
    s.pendingEvent = 'goldrush'
    expect(buyAndPlace(s, 0, 5)).toBe(false)
    expect(moveOrMerge(s, a.id, 1)).toBe('blocked')
    expect(reroll(s)).toBe(false)
    expect(sellUnit(s, a.id)).toBe(false)
    resolveEvent(s)
    expect(s.phase).toBe('ready')
    expect(s.goldMul).toBe(2)
  })
})

describe('sellUnit', () => {
  it('refunds part of the price', () => {
    const s = createGame()
    const u = put(s, 'shadow', 0)
    expect(sellUnit(s, u.id)).toBe(true)
    expect(s.gold).toBe(START_GOLD + 21)
    expect(s.units).toHaveLength(0)
  })
})
