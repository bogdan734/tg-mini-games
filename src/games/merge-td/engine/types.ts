import type { Vec } from '../../snake-td/engine/types'
export type { Vec }

export type TowerType =
  | 'fire' | 'ice' | 'robot' | 'storm' | 'nature'
  | 'firebot' | 'firestorm' | 'blizzard' | 'cryobot' | 'tesla' | 'wildfire'
  | 'mechagod' | 'glacius' | 'titan'

export type Effect = 'none' | 'burn' | 'slow' | 'chain' | 'aoe' | 'root'

export interface TowerDef {
  type: TowerType
  name: string
  tier: 1 | 2 | 3
  color: string
  emoji: string
  dmg: number
  rate: number
  range: number
  effect: Effect
  desc: string
}

export interface Tower { id: number; type: TowerType; level: number; tile: number; cooldown: number }

export type EnemyKind = 'skeleton' | 'wolf' | 'brute' | 'boss'
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
  hitT: number
}

export interface Popup { x: number; y: number; text: string; t: number; color: string }
export interface Shot { x: number; y: number; tx: number; ty: number; t: number; type: TowerType }
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; color: string; r: number }

export type Phase = 'menu' | 'ready' | 'wave' | 'over' | 'won'

export interface Choice { tile: number; options: TowerType[] }

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
  /** remaining spawns for the running wave: seconds until each spawns */
  spawnQueue: { kind: EnemyKind; at: number }[]
  waveTime: number
  choice: Choice | null
  placeCost: number
  rerollCost: number
  fx: { popups: Popup[]; shots: Shot[]; parts: Particle[]; sounds: string[]; shake: number }
  nextId: number
}
