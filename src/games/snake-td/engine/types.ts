export interface Vec { x: number; y: number }

export type Evo = 'none' | 'safe' | 'risky'

/** One orbiting sword: its own cooldown and orbit phase. */
export interface Sword { cooldown: number; phase: number }

/** The only unit type is the swordsman; level = number of swords (1..5). */
export interface Unit {
  id: number
  level: number
  evo: Evo
  slot: number
  swords: Sword[]
}

/** A flask dropped by the worm; `hp` hits (sword or tap) break it and release a swordsman. */
export interface Flask { id: number; slot: number; hp: number; maxHp: number; age: number }

export interface Segment {
  id: number
  hp: number
  maxHp: number
  head: boolean
  /** seconds of slow left (head only matters) */
  slow: number
  /** hit flash timer (render) */
  hitT: number
}

export type BossKind = 'none' | 'regen' | 'dash' | 'shield' | 'king'
export interface BossState { kind: BossKind; timer: number; next: number; dashT: number; shield: number }

/** A sword flying from a unit to a target and back; `t` runs 0..dur. */
export interface Shot { unitId: number; sword: number; from: Vec; to: Vec; t: number; dur: number; kind: 'segment' | 'flask' }
export interface Popup { x: number; y: number; text: string; t: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; color: string; r: number }

export type Phase = 'menu' | 'ready' | 'wave' | 'evolution' | 'event' | 'over' | 'won'
export type EventId = 'flaskrain' | 'rush' | 'gift' | 'frost'

export interface GameState {
  phase: Phase
  level: number
  wave: number
  boss: BossState
  lives: number
  score: number
  killed: number
  merges: number
  evolutions: number
  /** duel seed when playing a duel, else null */
  seed: number | null
  units: Unit[]
  flasks: Flask[]
  snake: Segment[]
  /** path distance of the first segment */
  headD: number
  /** kills since the last flask drop */
  killsSinceFlask: number
  pendingEvo: number | null
  pendingEvent: EventId | null
  /** phase to return to after evolution/event overlays */
  resume: Phase
  flaskMul: number
  speedMul: number
  fx: { popups: Popup[]; shots: Shot[]; parts: Particle[]; sounds: string[]; shake: number }
  time: number
  nextId: number
}
