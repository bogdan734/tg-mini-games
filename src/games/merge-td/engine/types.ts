import type { Vec } from '../../snake-td/engine/types'
export type { Vec }

export type Element = 'fire' | 'ice' | 'bolt' | 'nature' | 'dark'

export interface ElementDef {
  id: Element
  name: string
  emoji: string
  color: string
  glow: string
  effect: string
}

/** A tower is a set of elements (union of everything merged into it) at level 1..4. */
export interface Tower { id: number; elements: Element[]; level: number; tile: number; cooldown: number }

export type EnemyKind = 'skeleton' | 'wolf' | 'brute' | 'golem' | 'frostworm' | 'darklord'
export interface Enemy {
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  /** distance along the road; negative = not spawned yet */
  d: number
  speed: number
  slow: number
  burn: number
  burnDps: number
  root: number
  curse: number
  hitT: number
  /** last resist/weak popup timer so the label does not spam */
  labelT: number
}

export interface Popup { x: number; y: number; text: string; t: number; color: string }
export interface Shot { x: number; y: number; tx: number; ty: number; t: number; elements: Element[]; towerId: number; level: number }
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; color: string; r: number }

export type Phase = 'menu' | 'ready' | 'wave' | 'over' | 'won'

export interface Choice { tile: number; options: Element[] }

export interface GameState {
  phase: Phase
  wave: number
  lives: number
  gold: number
  score: number
  killed: number
  merges: number
  evolutions: number
  seed: number | null
  towers: Tower[]
  enemies: Enemy[]
  spawnQueue: { kind: EnemyKind; at: number }[]
  waveTime: number
  choice: Choice | null
  placeCost: number
  rerollCost: number
  fx: { popups: Popup[]; shots: Shot[]; parts: Particle[]; sounds: string[]; shake: number }
  nextId: number
}
