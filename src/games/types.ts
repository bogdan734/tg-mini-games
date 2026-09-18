import type { ComponentType, LazyExoticComponent } from 'react'

export interface GameProps {
  /** Call when a round ends; the shell records best score. */
  onScore: (score: number) => void
}

export interface GameMeta {
  id: string
  title: string
  description: string
  icon: string
  /** false → shown as "coming soon", not clickable */
  ready: boolean
  component: LazyExoticComponent<ComponentType<GameProps>>
}
