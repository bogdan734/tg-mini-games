import type { Element, ElementDef, Tower } from './types'

export const ELEMENTS: Record<Element, ElementDef> = {
  fire:   { id: 'fire',   name: 'Огонь',   emoji: '🔥', color: '#ff6a3d', glow: '#ffb070', effect: 'Поджог: урон со временем' },
  ice:    { id: 'ice',    name: 'Лёд',     emoji: '❄️', color: '#6fd3ff', glow: '#dff6ff', effect: 'Заморозка: враг вдвое медленнее' },
  bolt:   { id: 'bolt',   name: 'Молния',  emoji: '⚡', color: '#c9a3ff', glow: '#f0e6ff', effect: 'Цепь: бьёт ещё двоих рядом' },
  nature: { id: 'nature', name: 'Природа', emoji: '🌿', color: '#5fd07a', glow: '#c8ffd4', effect: 'Корни: держат врага на месте' },
  dark:   { id: 'dark',   name: 'Тьма',    emoji: '🌑', color: '#8f5cff', glow: '#3a1c6b', effect: 'Проклятие: враг получает +40% урона' },
}
export const ELEMENT_IDS = Object.keys(ELEMENTS) as Element[]

export const MAX_LEVEL = 4
export const BASE_DMG = 4
export const BASE_RATE = 1.2
export const BASE_RANGE = 125

/** Levels add up on merge: 1+1=2, 2+1=3, 2+2=4 (four towers in one). */
export function mergeLevel(a: Tower, b: Tower): number | null {
  const l = a.level + b.level
  return l <= MAX_LEVEL ? l : null
}

export const canMerge = (a: Tower, b: Tower): boolean => a.id !== b.id && mergeLevel(a, b) !== null

/** Union keeps the first tower's primary element first (it decides the look). */
export function mergeElements(a: Element[], b: Element[]): Element[] {
  const out = [...a]
  for (const e of b) if (!out.includes(e)) out.push(e)
  return out
}

export const towerDamage = (t: Tower): number => Math.round(BASE_DMG * (1 + 0.85 * (t.level - 1)) * 10) / 10
export const towerRate = (t: Tower): number => Math.round((BASE_RATE + (t.level - 1) * 0.15) * 100) / 100
export const towerRange = (t: Tower): number => BASE_RANGE + (t.level - 1) * 12
export const towerName = (t: Tower): string => t.elements.map((e) => ELEMENTS[e].name).join('+')
export const towerEmoji = (t: Tower): string => t.elements.map((e) => ELEMENTS[e].emoji).join('')
