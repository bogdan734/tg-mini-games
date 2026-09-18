import { isTelegram, WebApp } from './telegram'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export interface PublicUser { id: number; name: string; username: string | null; photo: string | null; coins: number; starsTotal: number }
export interface Profile {
  user: PublicUser
  scores: { game: string; level: number; score: number; wave: number }[]
  referrals: number
  inviteLink: string
  donationTiers: { stars: number; title: string }[]
}
export interface BoardEntry { id: number; name: string; username: string | null; photo: string | null; score: number; wave: number; rank: number; me: boolean }
export interface Board { entries: BoardEntry[]; me: { score: number; rank: number | null } }
export interface ScoreResult { best: number; improved: boolean; coinsEarned: number; coins: number; rank: number | null }

/** API is only usable inside Telegram (needs signed initData) and when a backend URL is configured. */
export const apiEnabled = (): boolean => Boolean(BASE) && isTelegram

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiEnabled()) throw new Error('api disabled')
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `tma ${WebApp.initData}`, ...(init.headers ?? {}) },
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

export async function submitScore(game: string, level: number, score: number, wave = 0): Promise<ScoreResult | null> {
  if (!apiEnabled()) return null
  try {
    const r = await call<ScoreResult>('/api/score', { method: 'POST', body: JSON.stringify({ game, level, score, wave }) })
    if (profileCache) { profileCache = { ...profileCache, user: { ...profileCache.user, coins: r.coins } }; notify() }
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
