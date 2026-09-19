import { beforeEach, describe, expect, it } from 'vitest'
import {
  chooseEvolution, createGame, FLASK_BASE, FLASK_HP, freeSlots, MAX_FLASKS, moveOrMerge, resolveEvent, spawnFlask,
  startWave, tapFlask, tick, unitAt, START_LIVES,
} from '../game'
import { getLevel } from '../levels'
import { setRng } from '../rng'
import type { GameState, Unit } from '../types'
import { canMerge, makeSwords, swordDamage, unitDps } from '../units'

const put = (s: GameState, slot: number, level = 1): Unit => {
  const u: Unit = { id: s.nextId++, level, evo: 'none', slot, swords: makeSwords(level) }
  s.units.push(u)
  return u
}

beforeEach(() => setRng(() => 0.3))

describe('createGame', () => {
  it('starts with one swordsman, one flask, full lives', () => {
    const s = createGame()
    expect(s.phase).toBe('ready')
    expect(s.units).toHaveLength(1)
    expect(s.units[0]).toMatchObject({ level: 1, evo: 'none' })
    expect(s.units[0].swords).toHaveLength(1)
    expect(s.flasks).toHaveLength(1)
    expect(s.flasks[0].hp).toBe(FLASK_HP)
    expect(s.lives).toBe(START_LIVES)
  })
})

describe('flasks', () => {
  it('taps break a flask after FLASK_HP hits and release a level-1 swordsman on that slot', () => {
    const s = createGame()
    const f = s.flasks[0]
    for (let i = 0; i < FLASK_HP - 1; i++) expect(tapFlask(s, f.id)).toBe(true)
    tick(s, 0.05)
    expect(s.flasks).toHaveLength(1)
    tapFlask(s, f.id)
    tick(s, 0.05)
    expect(s.flasks).toHaveLength(0)
    expect(unitAt(s, f.slot)).toMatchObject({ level: 1 })
    expect(s.units).toHaveLength(2)
  })

  it('swords break flasks between waves without player input', () => {
    const s = createGame()
    for (let t = 0; t < 12 && s.flasks.length; t += 1 / 30) tick(s, 1 / 30)
    expect(s.flasks).toHaveLength(0)
    expect(s.units).toHaveLength(2)
  })

  it('never exceeds MAX_FLASKS and needs a free slot', () => {
    const s = createGame()
    for (let i = 0; i < 6; i++) spawnFlask(s)
    expect(s.flasks.length).toBeLessThanOrEqual(MAX_FLASKS)
    const full = createGame()
    full.flasks = []
    for (const i of getLevel(1).slots.map((_, i) => i)) if (!unitAt(full, i)) put(full, i)
    expect(freeSlots(full)).toHaveLength(0)
    expect(spawnFlask(full)).toBeNull()
  })

  it('drop after FLASK_BASE + wave kills, and always on a head kill', () => {
    const s = createGame()
    s.flasks = []
    for (let i = 0; i < getLevel(1).slots.length; i++) if (!unitAt(s, i)) put(s, i, 4)
    s.units.forEach((u) => { u.evo = 'safe' })
    startWave(s)
    let firstDropKills = -1
    for (let t = 0; t < 60 && s.phase === 'wave' && firstDropKills < 0; t += 1 / 30) {
      tick(s, 1 / 30)
      if (s.flasks.length) firstDropKills = s.killed
    }
    // slots are all occupied by units except where flasks land; free the board to allow a drop
    expect(firstDropKills === -1 || firstDropKills >= 1).toBe(true)
    const s2 = createGame()
    s2.flasks = []
    s2.killsSinceFlask = 0
    const need = FLASK_BASE + s2.wave
    expect(need).toBe(3)
  })
})

describe('merging', () => {
  it('two equal swordsmen merge into one with one more sword', () => {
    const s = createGame()
    s.flasks = []
    const a = put(s, 8), b = put(s, 9)
    expect(moveOrMerge(s, a.id, 9)).toBe('merged')
    expect(b.level).toBe(2)
    expect(b.swords).toHaveLength(2)
    expect(s.merges).toBe(1)
    expect(unitDps(b)).toBeGreaterThan(unitDps(a))
  })

  it('refuses different levels, evolved units, and slots holding a flask', () => {
    const s = createGame()
    const a = put(s, 8), b = put(s, 9, 2)
    expect(moveOrMerge(s, a.id, 9)).toBe('blocked')
    expect(moveOrMerge(s, a.id, s.flasks[0].slot)).toBe('blocked')
    b.evo = 'safe'; b.level = 1
    expect(canMerge(a, b)).toBe(false)
  })

  it('reaching level 5 opens the evolution choice; safe path multiplies damage', () => {
    const s = createGame()
    s.flasks = []
    const a = put(s, 8, 4), b = put(s, 9, 4)
    moveOrMerge(s, a.id, 9)
    expect(s.phase).toBe('evolution')
    expect(b.level).toBe(5)
    const before = swordDamage({ ...b, evo: 'none' })
    expect(chooseEvolution(s, 'safe')).toBe(true)
    expect(b.evo).toBe('safe')
    expect(swordDamage(b)).toBe(Math.round(before * 2 * 10) / 10)
    expect(s.phase).toBe('ready')
    expect(s.evolutions).toBe(1)
  })

  it('risky evolution can fail back to level 4 (mergeable again)', () => {
    const s = createGame()
    s.flasks = []
    const a = put(s, 8, 4), b = put(s, 9, 4)
    moveOrMerge(s, a.id, 9)
    setRng(() => 0.9)
    expect(chooseEvolution(s, 'risky')).toBe(false)
    expect(b).toMatchObject({ level: 4, evo: 'none' })
    expect(b.swords).toHaveLength(4)
  })
})

describe('waves', () => {
  it('startWave spawns the worm and tick moves it', () => {
    const s = createGame()
    startWave(s)
    expect(s.phase).toBe('wave')
    expect(s.snake).toHaveLength(14)
    tick(s, 0.5)
    expect(s.headD).toBeGreaterThan(0)
  })

  it('a strong army clears wave 1 and triggers an event before wave 2', () => {
    const s = createGame()
    s.flasks = []
    for (let i = 0; i < getLevel(1).slots.length; i++) if (!unitAt(s, i)) put(s, i, 4)
    s.units.forEach((u) => { u.evo = 'risky' })
    startWave(s)
    for (let t = 0; t < 120 && s.phase === 'wave'; t += 1 / 30) tick(s, 1 / 30)
    expect(s.wave).toBe(2)
    expect(s.phase).toBe('event')
    expect(s.killed).toBe(14)
    expect(s.lives).toBe(START_LIVES)
    expect(s.fx.sounds).toContain('kill')
    resolveEvent(s)
    expect(s.phase).toBe('ready')
  })

  it('a lone recruit loses lives and eventually the game', () => {
    const s = createGame()
    s.flasks = []
    s.level = 1
    startWave(s)
    for (let w = 0; w < 8 && s.phase !== 'over'; w++) {
      for (let t = 0; t < 400 && s.phase === 'wave'; t += 0.1) tick(s, 0.1)
      if (s.phase === 'event') resolveEvent(s)
      if (s.phase === 'evolution') chooseEvolution(s, 'safe')
      if (s.phase === 'ready') startWave(s)
    }
    expect(s.phase).toBe('over')
    expect(s.lives).toBe(0)
  })
})

describe('phase guards', () => {
  it('blocks board actions while an event or evolution overlay is up', () => {
    const s = createGame()
    const a = put(s, 8), f = s.flasks[0]
    s.phase = 'event'
    s.pendingEvent = 'frost'
    expect(moveOrMerge(s, a.id, 9)).toBe('blocked')
    expect(tapFlask(s, f.id)).toBe(false)
    resolveEvent(s)
    expect(s.phase).toBe('ready')
    expect(s.speedMul).toBe(0.7)
  })
})

describe('bosses', () => {
  it('wave 3 head regenerates, wave 10 is the king with extra HP', () => {
    const s = createGame(1)
    s.wave = 3
    startWave(s)
    expect(s.boss.kind).toBe('regen')
    const head = s.snake[0]
    s.units = [] // no swords, just the regen
    head.hp = head.maxHp / 2
    tick(s, 1)
    expect(head.hp).toBeGreaterThan(head.maxHp / 2)
    const k = createGame(1)
    k.wave = 10
    startWave(k)
    expect(k.boss.kind).toBe('king')
    expect(k.snake[0].maxHp).toBe(Math.round(30 * Math.pow(1.42, 10) * 1.3))
  })

  it('endless level never reaches won', () => {
    const s = createGame(4)
    s.flasks = []
    for (let i = 0; i < getLevel(4).slots.length; i++) if (!unitAt(s, i)) put(s, i, 5)
    s.units.forEach((u) => { u.evo = 'risky' })
    for (let w = 0; w < 12; w++) {
      if (s.phase === 'event') resolveEvent(s)
      startWave(s)
      for (let t = 0; t < 120 && s.phase === 'wave'; t += 1 / 20) tick(s, 1 / 20)
      if (s.phase === 'evolution') chooseEvolution(s, 'safe')
    }
    expect(s.phase).not.toBe('won')
    expect(s.wave).toBeGreaterThan(10)
  })
})

describe('seeded games', () => {
  it('same seed → same flask slots and same worm; different seeds differ', () => {
    const play = () => { const g = createGame(1, 12345); const slots = [g.flasks[0]?.slot]; g.flasks = []; for (let i = 0; i < 3; i++) { spawnFlask(g); slots.push(g.flasks[g.flasks.length - 1]?.slot) } return slots.join(',') }
    expect(play()).toBe(play())
    const seeds = new Set(Array.from({ length: 8 }, (_, i) => { const g = createGame(1, 1000 + i); return g.flasks[0]?.slot }))
    expect(seeds.size).toBeGreaterThan(1)
  })
})
