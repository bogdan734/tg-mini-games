import { UNIT_TYPES } from '../engine/units'

export type Sprites = Record<string, HTMLImageElement>

/** `set` is the skin id without the "units:" prefix, e.g. "classic". */
export function loadSprites(set = 'classic'): Promise<Sprites> {
  const base = `${import.meta.env.BASE_URL}games/snake-td/units/${set}/`
  const entries = UNIT_TYPES.flatMap((t) => [1, 2, 3].map((tier) => `${t}_${tier}`))
  return Promise.all(
    entries.map(
      (key) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const img = new Image()
          img.onload = () => resolve([key, img])
          img.onerror = () => resolve([key, img])
          img.src = `${base}${key}.png`
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs))
}
