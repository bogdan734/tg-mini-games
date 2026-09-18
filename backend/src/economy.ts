/** Platform coins earned for a finished run. Only counts improvement over the previous best. */
export function coinsForScore(prevBest: number, score: number): number {
  if (score <= prevBest) return 0
  return Math.floor((score - prevBest) / 50)
}

/** Coins credited per Telegram Star donated. */
export const COINS_PER_STAR = 10

export const DONATION_TIERS = [
  { stars: 50, title: 'Кофе разработчику ☕' },
  { stars: 150, title: 'Поддержать проект 💪' },
  { stars: 500, title: 'Большое спасибо 🏆' },
]
