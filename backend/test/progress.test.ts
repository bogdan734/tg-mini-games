import { describe, expect, it } from 'vitest'
import { duelRewards, duelWinner, type DuelRow } from '../src/duels'
import { activeEvents, eventDelta, EVENTS } from '../src/events'
import { applyQuest, dailyQuests, dayKey, QUESTS_PER_DAY } from '../src/quests'
import { clampStats } from '../src/stats'

const stats = (o: Partial<ReturnType<typeof clampStats>> = {}) => ({ killed: 0, merges: 0, evolutions: 0, wave: 0, won: false, ...o })

describe('clampStats', () => {
  it('caps values and ignores garbage', () => {
    expect(clampStats({ killed: 99999, merges: -3, evolutions: 'x', wave: 7.9, won: 'yes' })).toEqual({ killed: 600, merges: 0, evolutions: 0, wave: 7, won: false })
    expect(clampStats(null).wave).toBe(0)
  })
})

describe('dailyQuests', () => {
  it('is deterministic per user and day and picks distinct quests', () => {
    const a = dailyQuests(42, '2026-09-18'), b = dailyQuests(42, '2026-09-18')
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
    expect(new Set(a.map((q) => q.id)).size).toBe(QUESTS_PER_DAY)
    expect(dailyQuests(42, '2026-09-19').map((q) => q.id)).not.toEqual(a.map((q) => q.id))
  })
  it('dayKey is a UTC date', () => {
    expect(dayKey(Date.parse('2026-09-18T23:59:00Z'))).toBe('2026-09-18')
  })
})

describe('applyQuest', () => {
  it('adds counters, keeps the best wave, caps at target', () => {
    const kills = { id: 'k', title: '', target: 150, reward: 1, stat: 'killed' as const }
    expect(applyQuest(kills, 100, stats({ killed: 80 }))).toBe(150)
    const wave = { id: 'w', title: '', target: 6, reward: 1, stat: 'bestWave' as const }
    expect(applyQuest(wave, 4, stats({ wave: 3 }))).toBe(4)
    expect(applyQuest(wave, 4, stats({ wave: 9 }))).toBe(6)
    const wins = { id: 'v', title: '', target: 1, reward: 1, stat: 'wins' as const }
    expect(applyQuest(wins, 0, stats({ won: false }))).toBe(0)
    expect(applyQuest(wins, 0, stats({ won: true }))).toBe(1)
  })
})

describe('events', () => {
  it('launch rewards a win on map 3 while active; hunt counts kills', () => {
    const now = Date.parse('2026-09-20T00:00:00Z')
    expect(activeEvents(now).map(([id]) => id)).toEqual(['launch', 'hunt'])
    expect(activeEvents(Date.parse('2026-10-02T00:00:00Z')).map(([id]) => id)).toEqual(['hunt'])
    expect(eventDelta(EVENTS.launch, stats({ won: true }), 3)).toBe(1)
    expect(eventDelta(EVENTS.launch, stats({ won: true }), 2)).toBe(0)
    expect(eventDelta(EVENTS.hunt, stats({ killed: 120 }), 1)).toBe(120)
  })
})

describe('duels', () => {
  const base: DuelRow = { id: 'x', level: 1, seed: 1, creator_id: 1, opponent_id: 2, creator_score: null, creator_wave: null, opponent_score: null, opponent_wave: null, status: 'open', created_at: 0, expires_at: 1 }
  it('needs both scores, then compares score, wave, draw', () => {
    expect(duelWinner(base)).toBeNull()
    expect(duelWinner({ ...base, creator_score: 500, opponent_score: 400 })).toBe('creator')
    expect(duelWinner({ ...base, creator_score: 400, opponent_score: 400, creator_wave: 5, opponent_wave: 7 })).toBe('opponent')
    expect(duelWinner({ ...base, creator_score: 400, opponent_score: 400, creator_wave: 5, opponent_wave: 5 })).toBe('draw')
    expect(duelRewards('creator')).toEqual({ creator: 30, opponent: 10 })
    expect(duelRewards('draw')).toEqual({ creator: 10, opponent: 10 })
  })
})
