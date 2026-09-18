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
    description: 'Ставь стихии на плитки, сливай в новых существ, 12 волн',
    icon: '🏰',
    ready: true,
    component: lazy(() => import('./merge-td/MergeDefense')),
  },
  {
    id: 'snake-td',
    title: 'Snake Defense',
    description: 'Змея ползёт к воротам — ставь и сливай бойцов, 10 волн',
    icon: '🐍',
    ready: true,
    component: lazy(() => import('./snake-td/SnakeDefense')),
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
