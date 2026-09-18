import catalog from '../../shared/catalog.json'

export type ItemKind = 'units' | 'snake' | 'map'
export interface Item {
  id: string
  kind: ItemKind
  name: string
  desc: string
  price?: number
  default?: boolean
  event?: string
  level?: number
}

export const ITEMS: Item[] = catalog.items as Item[]
export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id)
export const defaultFor = (kind: ItemKind): string => ITEMS.find((i) => i.kind === kind && i.default)!.id

export type BuyError = 'unknown' | 'event_only' | 'owned' | 'free' | 'poor'

/** Pure purchase rule: no pay-to-win, event items are never sold. */
export function canBuy(id: string, owned: Set<string>, coins: number): BuyError | null {
  const item = itemById(id)
  if (!item) return 'unknown'
  if (item.event) return 'event_only'
  if (owned.has(id) || item.default) return 'owned'
  if (!item.price) return 'free'
  if (coins < item.price) return 'poor'
  return null
}

/** Can the item be equipped into `slot`? Defaults are always available. */
export function canEquip(slot: string, id: string, owned: Set<string>): boolean {
  const item = itemById(id)
  if (!item || item.kind !== slot || item.kind === 'map') return false
  return Boolean(item.default) || owned.has(id)
}

/** Small steady income per finished run so the shop is reachable without improving records. */
export const coinsForRun = (wave: number): number => Math.min(5, Math.floor(wave / 2))
