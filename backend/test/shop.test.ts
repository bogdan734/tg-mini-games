import { describe, expect, it } from 'vitest'
import { canBuy, canEquip, coinsForRun, defaultFor, eventGrants, ITEMS } from '../src/shop'

describe('catalog', () => {
  it('has one default per equippable kind and no price on event items', () => {
    expect(defaultFor('units')).toBe('units:classic')
    expect(defaultFor('snake')).toBe('snake:stone')
    for (const i of ITEMS) if (i.event) expect(i.price).toBeUndefined()
  })
})

describe('canBuy', () => {
  const owned = new Set(['units:cute'])
  it('refuses event items, owned, defaults and empty wallets', () => {
    expect(canBuy('units:gold', owned, 9999)).toBe('event_only')
    expect(canBuy('units:cute', owned, 9999)).toBe('owned')
    expect(canBuy('units:classic', owned, 9999)).toBe('owned')
    expect(canBuy('units:villains', owned, 499)).toBe('poor')
    expect(canBuy('nope', owned, 1)).toBe('unknown')
  })
  it('allows an affordable unowned item', () => {
    expect(canBuy('units:villains', owned, 500)).toBeNull()
    expect(canBuy('map:2', owned, 200)).toBeNull()
  })
})

describe('canEquip', () => {
  it('only owned or default cosmetics of the right kind', () => {
    const owned = new Set(['snake:lava'])
    expect(canEquip('snake', 'snake:lava', owned)).toBe(true)
    expect(canEquip('snake', 'snake:ice', owned)).toBe(false)
    expect(canEquip('snake', 'snake:stone', owned)).toBe(true)
    expect(canEquip('units', 'snake:lava', owned)).toBe(false)
    expect(canEquip('map', 'map:2', new Set(['map:2']))).toBe(false)
  })
})

describe('eventGrants', () => {
  const before = Date.parse('2026-09-20T00:00:00Z'), after = Date.parse('2026-10-02T00:00:00Z')
  it('rewards a win on map 3 during the launch event only', () => {
    expect(eventGrants({ won: true, level: 3, now: before })).toEqual(['units:gold', 'snake:gold'])
    expect(eventGrants({ won: false, level: 3, now: before })).toEqual([])
    expect(eventGrants({ won: true, level: 2, now: before })).toEqual([])
    expect(eventGrants({ won: true, level: 3, now: after })).toEqual([])
  })
})

describe('coinsForRun', () => {
  it('pays up to 5 coins per run', () => {
    expect(coinsForRun(1)).toBe(0)
    expect(coinsForRun(4)).toBe(2)
    expect(coinsForRun(11)).toBe(5)
  })
})
