import WebApp from '@twa-dev/sdk'
import { versionAtLeast } from './telegram'

/**
 * Best-score storage: Telegram CloudStorage (synced across devices) when available,
 * localStorage otherwise (browser dev / old clients).
 */
const cloudAvailable = (): boolean => versionAtLeast('6.9')

const key = (gameId: string) => `best:${gameId}`

export function getBest(gameId: string): Promise<number> {
  const k = key(gameId)
  if (!cloudAvailable()) return Promise.resolve(Number(localStorage.getItem(k) ?? 0))
  return new Promise((resolve) => {
    WebApp.CloudStorage.getItem(k, (err, value) => {
      if (err) resolve(Number(localStorage.getItem(k) ?? 0))
      else resolve(Number(value ?? 0))
    })
  })
}

export async function setBest(gameId: string, score: number): Promise<boolean> {
  const prev = await getBest(gameId)
  if (score <= prev) return false
  const k = key(gameId)
  localStorage.setItem(k, String(score))
  if (cloudAvailable()) WebApp.CloudStorage.setItem(k, String(score))
  return true
}
