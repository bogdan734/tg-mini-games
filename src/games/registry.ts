import { lazy } from 'react'
import type { GameMeta } from './types'

/**
 * Add a game: create src/games/<id>/<Name>.tsx exporting default (props: GameProps),
 * then append an entry here. Order = order in the hub.
 */
export const GAMES: GameMeta[] = [
  {
    id: 'merge-td',
    title: 'Merge Defense',
    description: 'Ставь башни на сетку, сливай в комбо, держи волны',
    icon: '🏰',
    ready: false,
    component: lazy(() => import('./coming-soon/ComingSoon')),
  },
  {
    id: 'snake-td',
    title: 'Snake Defense',
    description: 'Змея ползёт по кольцу — режь сегменты, прокачивай бойцов',
    icon: '🐍',
    ready: false,
    component: lazy(() => import('./coming-soon/ComingSoon')),
  },
  {
    id: 'catch-dot',
    title: 'Поймай точку',
    description: 'Демо: тапай по точке, пока идёт время',
    icon: '🎯',
    ready: true,
    component: lazy(() => import('./catch-dot/CatchDot')),
  },
]

export const findGame = (id: string) => GAMES.find((g) => g.id === id)
