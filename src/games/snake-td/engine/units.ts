import type { Evo, Unit, UnitDef, UnitType } from './types'

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  volt:   { type: 'volt',   name: 'Лучник',     color: '#ffd54a', price: 15, dmg: 1, rate: 3,   range: 150, desc: 'Быстрые стрелы, иногда две' },
  frost:  { type: 'frost',  name: 'Кузнец',     color: '#5bc8ff', price: 20, dmg: 2, rate: 1.2, range: 130, desc: 'Молот оглушает и замедляет' },
  blaze:  { type: 'blaze',  name: 'Подрывник',  color: '#ff5a5a', price: 25, dmg: 3, rate: 0.9, range: 140, desc: 'Динамит бьёт по соседям' },
  venom:  { type: 'venom',  name: 'Факельщик',  color: '#4de08a', price: 25, dmg: 2, rate: 1,   range: 130, desc: 'Поджигает: урон со временем' },
  shadow: { type: 'shadow', name: 'Рыцарь',     color: '#8d7bff', price: 35, dmg: 7, rate: 0.5, range: 120, desc: 'Тяжёлый удар мечом' },
}

export const UNIT_TYPES = Object.keys(UNIT_DEFS) as UnitType[]
export const MAX_LEVEL = 6
export const EVO_LEVEL = 3

export const EVO_MUL: Record<Evo, number> = { none: 1, safe: 1.8, risky: 3 }

export function unitDamage(u: Unit): number {
  return Math.round(UNIT_DEFS[u.type].dmg * Math.pow(1.5, u.level - 1) * EVO_MUL[u.evo] * 10) / 10
}

export function unitRange(u: Unit): number {
  return UNIT_DEFS[u.type].range + (u.level - 1) * 8
}

export function canMerge(a: Unit, b: Unit): boolean {
  return a.id !== b.id && a.type === b.type && a.level === b.level && a.evo === b.evo && a.level < MAX_LEVEL
}

/** Sprite tier for rendering: 1 base, 2 grown, 3 evolved. */
export function unitTier(u: Unit): 1 | 2 | 3 {
  if (u.evo !== 'none') return 3
  return u.level >= 2 ? 2 : 1
}
