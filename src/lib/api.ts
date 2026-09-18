import { isTelegram, WebApp } from './telegram'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export interface PublicUser { id: number; name: string; username: string | null; photo: string | null; coins: number; starsTotal: number }
export interface Profile {
  user: PublicUser
  scores: { game: string; level: number; score: number; wave: number }[]
  referrals: number
  inviteLink: string
  donationTiers: { stars: number; title: string }[]
  owned: string[]
  equipped: Record<string, string>
}
export interface ShopItem { id: string; kind: 'units' | 'snake' | 'map'; name: string; desc: string; price?: number; default?: boolean; event?: string; level?: number }
export interface Shop { items: ShopItem[]; events: Record<string, { title: string; desc: string; until: string }>; owned: string[]; equipped: Record<string, string>; coins: number }
export interface BoardEntry { id: number; name: string; username: string | null; photo: string | null; score: number; wave: number; rank: number; me: boolean }
export interface Board { entries: BoardEntry[]; me: { score: number; rank: number | null } }
export interface ScoreResult { best: number; improved: boolean; coinsEarned: number; coins: number; rank: number | null; granted: string[]; questsCompleted: string[]; eventsCompleted: string[] }
export interface RunStats { killed: number; merges: number; evolutions: number }
export interface Quest { id: string; title: string; target: number; reward: number; progress: number; claimed: boolean }
export interface EventView { id: string; title: string; desc: string; until: string; target: number; rewards: { items: string[]; coins: number }; progress: number; done: boolean }
export interface DuelSide { id?: number; name?: string; photo?: string | null; score: number | null; wave: number | null }
export interface DuelView { id: string; level: number; seed: number; status: 'open' | 'done' | 'expired'; expiresAt: number; me: 'creator' | 'opponent' | null; creator: DuelSide; opponent: DuelSide | null; winner: 'creator' | 'opponent' | 'draw' | null }

/** Dev only: a signed initData pasted into localStorage lets the browser talk to the real API. */
const devInitData = (): string | null => {
  if (!import.meta.env.DEV) return null
  try { return localStorage.getItem('devInitData') } catch { return null }
}
const initData = (): string => devInitData() ?? WebApp.initData

/** API is only usable inside Telegram (needs signed initData) and when a backend URL is configured. */
export const apiEnabled = (): boolean => Boolean(BASE) && (isTelegram || Boolean(devInitData()))

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiEnabled()) throw new Error('api disabled')
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `tma ${initData()}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`api ${path}: ${res.status}`)
  return (await res.json()) as T
}

let profileCache: Profile | null = null
const listeners = new Set<(p: Profile | null) => void>()
export const onProfile = (fn: (p: Profile | null) => void): (() => void) => { listeners.add(fn); return () => listeners.delete(fn) }
const notify = () => listeners.forEach((fn) => fn(profileCache))

export async function getMe(force = false): Promise<Profile | null> {
  if (!apiEnabled()) return null
  if (profileCache && !force) return profileCache
  try {
    profileCache = await call<Profile>('/api/me')
  } catch {
    profileCache = null
  }
  notify()
  return profileCache
}

export async function submitScore(game: string, level: number, score: number, wave = 0, won = false, stats?: RunStats): Promise<ScoreResult | null> {
  if (!apiEnabled()) return null
  try {
    const r = await call<ScoreResult>('/api/score', { method: 'POST', body: JSON.stringify({ game, level, score, wave, won, ...stats }) })
    if (profileCache) {
      profileCache = { ...profileCache, user: { ...profileCache.user, coins: r.coins }, owned: [...new Set([...profileCache.owned, ...r.granted])] }
      notify()
    }
    return r
  } catch {
    return null
  }
}

export async function getLeaderboard(game: string, level: number, scope: 'global' | 'friends'): Promise<Board | null> {
  if (!apiEnabled()) return null
  try { return await call<Board>(`/api/leaderboard?game=${game}&level=${level}&scope=${scope}`) } catch { return null }
}

export async function createDonation(stars: number): Promise<string | null> {
  if (!apiEnabled()) return null
  try { return (await call<{ link: string }>('/api/donate', { method: 'POST', body: JSON.stringify({ stars }) })).link } catch { return null }
}

export async function getShop(): Promise<Shop | null> {
  if (!apiEnabled()) return null
  try { return await call<Shop>('/api/shop') } catch { return null }
}

export async function buyItem(item: string): Promise<{ ok: true; coins: number; owned: string[] } | { error: string }> {
  if (!apiEnabled()) return { error: 'offline' }
  const res = await fetch(`${BASE}/api/shop/buy`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `tma ${initData()}` }, body: JSON.stringify({ item }) })
  const data = (await res.json().catch(() => ({ error: 'network' }))) as { ok?: true; coins?: number; owned?: string[]; error?: string }
  if (data.ok && profileCache) { profileCache = { ...profileCache, user: { ...profileCache.user, coins: data.coins! }, owned: data.owned! }; notify() }
  return data.ok ? { ok: true, coins: data.coins!, owned: data.owned! } : { error: data.error ?? 'error' }
}

export async function equipItem(slot: string, item: string): Promise<Record<string, string> | null> {
  if (!apiEnabled()) return null
  try {
    const r = await call<{ equipped: Record<string, string> }>('/api/shop/equip', { method: 'POST', body: JSON.stringify({ slot, item }) })
    if (profileCache) { profileCache = { ...profileCache, equipped: r.equipped }; notify() }
    return r.equipped
  } catch { return null }
}

/** Currently equipped cosmetics (defaults when offline). */
export const equippedNow = (): { units: string; snake: string } => ({
  units: profileCache?.equipped.units ?? 'units:classic',
  snake: profileCache?.equipped.snake ?? 'snake:stone',
})

/** Highest map unlocked through the shop (0 when none). */
export const ownedMapLevel = (): number =>
  Math.max(0, ...(profileCache?.owned ?? []).filter((id) => id.startsWith('map:')).map((id) => Number(id.slice(4))))

export async function getQuests(): Promise<{ day: string; quests: Quest[] } | null> {
  if (!apiEnabled()) return null
  try { return await call('/api/quests') } catch { return null }
}

export async function claimQuest(id: string): Promise<{ ok: boolean; coins?: number; reward?: number }> {
  if (!apiEnabled()) return { ok: false }
  try {
    const r = await call<{ ok: true; coins: number; reward: number }>('/api/quests/claim', { method: 'POST', body: JSON.stringify({ id }) })
    if (profileCache) { profileCache = { ...profileCache, user: { ...profileCache.user, coins: r.coins } }; notify() }
    return r
  } catch { return { ok: false } }
}

export async function getEvents(): Promise<{ events: EventView[] } | null> {
  if (!apiEnabled()) return null
  try { return await call('/api/events') } catch { return null }
}

export async function createDuel(level: number): Promise<{ duel: DuelView; link: string } | null> {
  if (!apiEnabled()) return null
  try { return await call('/api/duel/create', { method: 'POST', body: JSON.stringify({ level }) }) } catch { return null }
}

export async function getDuel(id: string): Promise<DuelView | null> {
  if (!apiEnabled()) return null
  try { return (await call<{ duel: DuelView }>(`/api/duel?id=${encodeURIComponent(id)}`)).duel } catch { return null }
}

export async function submitDuel(id: string, score: number, wave: number): Promise<{ duel: DuelView; reward: number } | null> {
  if (!apiEnabled()) return null
  try {
    const r = await call<{ duel: DuelView; reward: number }>('/api/duel/result', { method: 'POST', body: JSON.stringify({ id, score, wave }) })
    if (r.reward > 0) void getMe(true)
    return r
  } catch { return null }
}

export async function getDuels(): Promise<DuelView[]> {
  if (!apiEnabled()) return []
  try { return (await call<{ duels: DuelView[] }>('/api/duels')).duels } catch { return [] }
}

/** A duel to open right away (from a t.me/...?startapp=duel_<id> link). */
let pendingDuel: string | null = null
export const setPendingDuel = (id: string | null) => { pendingDuel = id }
export const takePendingDuel = (): string | null => { const d = pendingDuel; pendingDuel = null; return d }
