export const DUEL_TTL_MS = 3 * 24 * 3600 * 1000
export const DUEL_WIN_COINS = 30
export const DUEL_LOSE_COINS = 10

export interface DuelRow {
  id: string
  level: number
  seed: number
  creator_id: number
  opponent_id: number | null
  creator_score: number | null
  creator_wave: number | null
  opponent_score: number | null
  opponent_wave: number | null
  status: 'open' | 'done' | 'expired'
  created_at: number
  expires_at: number
}

export const newDuelId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] >>> 1

/** Which side wins once both scores are in: higher score, then higher wave, else draw. */
export function duelWinner(d: DuelRow): 'creator' | 'opponent' | 'draw' | null {
  if (d.creator_score === null || d.opponent_score === null) return null
  if (d.creator_score !== d.opponent_score) return d.creator_score > d.opponent_score ? 'creator' : 'opponent'
  const cw = d.creator_wave ?? 0, ow = d.opponent_wave ?? 0
  if (cw !== ow) return cw > ow ? 'creator' : 'opponent'
  return 'draw'
}

/** Coins per side after a finished duel. */
export function duelRewards(w: 'creator' | 'opponent' | 'draw'): { creator: number; opponent: number } {
  if (w === 'draw') return { creator: DUEL_LOSE_COINS, opponent: DUEL_LOSE_COINS }
  return w === 'creator'
    ? { creator: DUEL_WIN_COINS, opponent: DUEL_LOSE_COINS }
    : { creator: DUEL_LOSE_COINS, opponent: DUEL_WIN_COINS }
}
