import catalog from '../../shared/catalog.json'
import type { RunStats } from './stats'

export interface EventDef {
  title: string
  desc: string
  from?: string
  until: string
  condition: { type: 'win_map'; level: number } | { type: 'kills' }
  target: number
  rewards: { items: string[]; coins: number }
}

export const EVENTS: Record<string, EventDef> = catalog.events as unknown as Record<string, EventDef>

export const isActive = (ev: EventDef, now: number): boolean =>
  now < Date.parse(ev.until) && (!ev.from || now >= Date.parse(ev.from))

export const activeEvents = (now: number): [string, EventDef][] =>
  Object.entries(EVENTS).filter(([, ev]) => isActive(ev, now))

/** Progress a finished run adds to an event (always additive; targets cap it). */
export function eventDelta(ev: EventDef, stats: RunStats, level: number): number {
  switch (ev.condition.type) {
    case 'win_map': return stats.won && level === ev.condition.level ? 1 : 0
    case 'kills': return stats.killed
  }
}
