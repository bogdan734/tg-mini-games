import { UNIT_TYPES } from '../engine/units'

export type Sprites = Record<string, HTMLImageElement>

export function loadSprites(): Promise<Sprites> {
  const base = `${import.meta.env.BASE_URL}games/snake-td/units/`
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
