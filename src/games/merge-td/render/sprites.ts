import { TOWER_DEFS } from '../engine/towers'

export type Sprites = Record<string, HTMLImageElement>

export function loadTowerSprites(): Promise<Sprites> {
  const base = `${import.meta.env.BASE_URL}games/merge-td/towers/`
  return Promise.all(
    Object.keys(TOWER_DEFS).map(
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
