import type { Tower, TowerDef, TowerType } from './types'

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
  fire:      { type: 'fire',      name: 'Огонь',     tier: 1, color: '#ff6a3d', emoji: '🔥', dmg: 4,  rate: 1.0, range: 120, effect: 'burn',  desc: 'Поджигает: урон со временем' },
  ice:       { type: 'ice',       name: 'Лёд',       tier: 1, color: '#6fd3ff', emoji: '❄️', dmg: 3,  rate: 1.1, range: 125, effect: 'slow',  desc: 'Замедляет врага' },
  robot:     { type: 'robot',     name: 'Робот',     tier: 1, color: '#9aa4b8', emoji: '⚙️', dmg: 2,  rate: 3.0, range: 115, effect: 'none',  desc: 'Быстрая стрельба' },
  storm:     { type: 'storm',     name: 'Шторм',     tier: 1, color: '#7c8cff', emoji: '🌪️', dmg: 5,  rate: 0.8, range: 135, effect: 'chain', desc: 'Молния бьёт по цепочке' },
  nature:    { type: 'nature',    name: 'Природа',   tier: 1, color: '#5fd07a', emoji: '🌿', dmg: 3,  rate: 0.9, range: 120, effect: 'root',  desc: 'Корни держат врага на месте' },
  firebot:   { type: 'firebot',   name: 'Файрбот',   tier: 2, color: '#ff8c42', emoji: '🤖', dmg: 6,  rate: 2.4, range: 130, effect: 'burn',  desc: 'Очередь огненных зарядов' },
  firestorm: { type: 'firestorm', name: 'Огнешторм', tier: 2, color: '#ff4d6d', emoji: '🌋', dmg: 12, rate: 0.9, range: 140, effect: 'aoe',   desc: 'Взрыв по площади + поджог' },
  blizzard:  { type: 'blizzard',  name: 'Буран',     tier: 2, color: '#a8e8ff', emoji: '🌨️', dmg: 8,  rate: 0.9, range: 145, effect: 'aoe',   desc: 'Замораживает всех вокруг' },
  cryobot:   { type: 'cryobot',   name: 'Криобот',   tier: 2, color: '#7fb3ff', emoji: '🧊', dmg: 5,  rate: 2.2, range: 130, effect: 'slow',  desc: 'Ледяные очереди' },
  tesla:     { type: 'tesla',     name: 'Тесла',     tier: 2, color: '#b48bff', emoji: '⚡', dmg: 9,  rate: 1.2, range: 150, effect: 'chain', desc: 'Цепная молния на 3 цели' },
  wildfire:  { type: 'wildfire',  name: 'Пал',       tier: 2, color: '#c9a227', emoji: '🍂', dmg: 7,  rate: 1.0, range: 135, effect: 'root',  desc: 'Корни + поджог' },
  mechagod:  { type: 'mechagod',  name: 'Мехабог',   tier: 3, color: '#ffd54a', emoji: '👑', dmg: 30, rate: 1.6, range: 170, effect: 'aoe',   desc: 'Огненный шторм из пушек' },
  glacius:   { type: 'glacius',   name: 'Глациус',   tier: 3, color: '#e0f7ff', emoji: '💎', dmg: 22, rate: 1.4, range: 165, effect: 'aoe',   desc: 'Ледяной взрыв, всё замирает' },
  titan:     { type: 'titan',     name: 'Титан',     tier: 3, color: '#8ef0a0', emoji: '🗿', dmg: 26, rate: 1.2, range: 175, effect: 'chain', desc: 'Молнии по всей дороге' },
}

export const BASE_TYPES: TowerType[] = ['fire', 'ice', 'robot', 'storm', 'nature']

/** Cross-type merge recipes (order does not matter). Same type + same level = level up instead. */
const RECIPE_LIST: [TowerType, TowerType, TowerType][] = [
  ['fire', 'robot', 'firebot'],
  ['fire', 'storm', 'firestorm'],
  ['ice', 'storm', 'blizzard'],
  ['ice', 'robot', 'cryobot'],
  ['storm', 'robot', 'tesla'],
  ['nature', 'fire', 'wildfire'],
  ['firebot', 'storm', 'mechagod'],
  ['blizzard', 'robot', 'glacius'],
  ['tesla', 'nature', 'titan'],
]
const key = (a: TowerType, b: TowerType) => [a, b].sort().join('+')
export const RECIPES = new Map<string, TowerType>(RECIPE_LIST.map(([a, b, c]) => [key(a, b), c]))
export const recipeFor = (a: TowerType, b: TowerType): TowerType | undefined => RECIPES.get(key(a, b))
export const recipesOf = (t: TowerType): { with: TowerType; result: TowerType }[] =>
  RECIPE_LIST.filter(([a, b]) => a === t || b === t).map(([a, b, c]) => ({ with: a === t ? b : a, result: c }))

export const MAX_LEVEL = 5

export type MergeOutcome = { kind: 'level'; level: number } | { kind: 'recipe'; type: TowerType } | null

/** What happens when `a` is dropped onto `b`. Recipes take the higher level of the two. */
export function mergeOutcome(a: Tower, b: Tower): MergeOutcome {
  if (a.id === b.id) return null
  if (a.type === b.type) return a.level === b.level && a.level < MAX_LEVEL ? { kind: 'level', level: a.level + 1 } : null
  const r = recipeFor(a.type, b.type)
  return r ? { kind: 'recipe', type: r } : null
}

export const towerDamage = (t: Tower): number => Math.round(TOWER_DEFS[t.type].dmg * Math.pow(1.6, t.level - 1) * 10) / 10
export const towerRange = (t: Tower): number => TOWER_DEFS[t.type].range + (t.level - 1) * 8
