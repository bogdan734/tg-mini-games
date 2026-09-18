import type { RunStats } from './stats'

export interface QuestDef { id: string; title: string; target: number; reward: number; stat: 'runs' | 'wins' | 'bestWave' | 'killed' | 'merges' | 'evolutions' }

export const QUESTS: QuestDef[] = [
  { id: 'runs2', title: 'Сыграть 2 партии', target: 2, reward: 15, stat: 'runs' },
  { id: 'kills150', title: 'Убить 150 сегментов', target: 150, reward: 20, stat: 'killed' },
  { id: 'wave6', title: 'Дойти до 6-й волны', target: 6, reward: 20, stat: 'bestWave' },
  { id: 'merge10', title: 'Сделать 10 слияний', target: 10, reward: 15, stat: 'merges' },
  { id: 'win1', title: 'Выиграть карту', target: 1, reward: 40, stat: 'wins' },
  { id: 'evo2', title: 'Провести 2 эволюции', target: 2, reward: 15, stat: 'evolutions' },
]

export const QUESTS_PER_DAY = 3
export const dayKey = (now: number): string => new Date(now).toISOString().slice(0, 10)

function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Deterministic daily selection: same user + same day → same quests, no storage needed. */
export function dailyQuests(userId: number, day: string): QuestDef[] {
  const idx = QUESTS.map((_, i) => i)
  let h = hash32(`${day}:${userId}`)
  for (let i = idx.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    const j = h % (i + 1)
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, QUESTS_PER_DAY).map((i) => QUESTS[i])
}

/** How a finished run moves a quest: additive counters or a "best wave" maximum. */
export function questUpdate(q: QuestDef, stats: RunStats): { mode: 'add' | 'max'; value: number } {
  switch (q.stat) {
    case 'runs': return { mode: 'add', value: 1 }
    case 'wins': return { mode: 'add', value: stats.won ? 1 : 0 }
    case 'bestWave': return { mode: 'max', value: stats.wave }
    case 'killed': return { mode: 'add', value: stats.killed }
    case 'merges': return { mode: 'add', value: stats.merges }
    case 'evolutions': return { mode: 'add', value: stats.evolutions }
  }
}

export const applyQuest = (q: QuestDef, progress: number, stats: RunStats): number => {
  const u = questUpdate(q, stats)
  return Math.min(q.target, u.mode === 'add' ? progress + u.value : Math.max(progress, u.value))
}
