import WebApp from '@twa-dev/sdk'
import { versionAtLeast } from './telegram'

/**
 * Key/value storage: Telegram CloudStorage (synced across devices) when available,
 * localStorage otherwise (browser dev / old clients). Values are strings.
 */
const cloudAvailable = (): boolean => versionAtLeast('6.9')

const local = {
  get: (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

export function getValue(key: string): Promise<string | null> {
  if (!cloudAvailable()) return Promise.resolve(local.get(key))
  return new Promise((resolve) => {
    try {
      WebApp.CloudStorage.getItem(key, (err, value) => {
        if (err || value === undefined || value === '') resolve(local.get(key))
        else resolve(value)
      })
    } catch {
      resolve(local.get(key))
    }
  })
}

export function setValue(key: string, value: string): Promise<void> {
  local.set(key, value)
  if (!cloudAvailable()) return Promise.resolve()
  return new Promise((resolve) => {
    try { WebApp.CloudStorage.setItem(key, value, () => resolve()) } catch { resolve() }
  })
}

const bestKey = (gameId: string) => `best:${gameId}`

export async function getBest(gameId: string): Promise<number> {
  return Number((await getValue(bestKey(gameId))) ?? 0)
}

export async function setBest(gameId: string, score: number): Promise<boolean> {
  const prev = await getBest(gameId)
  if (score <= prev) return false
  await setValue(bestKey(gameId), String(score))
  return true
}
