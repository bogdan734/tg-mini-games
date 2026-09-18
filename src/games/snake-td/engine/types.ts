export interface Vec { x: number; y: number }

export type UnitType = 'frost' | 'blaze' | 'venom' | 'volt' | 'shadow'
export type Evo = 'none' | 'safe' | 'risky'

export interface UnitDef {
  type: UnitType
  name: string
  color: string
  price: number
  /** damage per hit at level 1 */
  dmg: number
  /** attacks per second */
  rate: number
  /** px from slot center */
  range: number
  desc: string
}

export interface Unit {
  id: number
  type: UnitType
  level: number
  evo: Evo
  slot: number
  cooldown: number
}

export interface Segment {
  id: number
  hp: number
  maxHp: number
  head: boolean
  /** seconds of poison left */
  poison: number
  poisonDps: number
  /** seconds of slow left (head only matters) */
  slow: number
  /** hit flash timer (render) */
  hitT: number
}

export type BossKind = 'none' | 'regen' | 'dash' | 'shield' | 'king'
export interface BossState { kind: BossKind; timer: number; next: number; dashT: number; shield: number }

export interface Shot { x: number; y: number; tx: number; ty: number; t: number; type: UnitType }
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; color: string; r: number }


export interface Popup { x: number; y: number; text: string; t: number; color: string }
export interface Beam { from: Vec; to: Vec; t: number; color: string }

export type Phase = 'menu' | 'ready' | 'wave' | 'evolution' | 'event' | 'over' | 'won'
export type EventId = 'goldrush' | 'rush' | 'gift' | 'frost'

export interface GameState {
  phase: Phase
  level: number
  wave: number
  boss: BossState
  lives: number
  gold: number
  score: number
  killed: number
  merges: number
  evolutions: number
  /** duel seed when playing a duel, else null */
  seed: number | null
  units: Unit[]
  snake: Segment[]
  /** path distance of the first segment */
  headD: number
  shop: (UnitType | null)[]
  rerollCost: number
  pendingEvo: number | null
  /** phase to return to after evolution/event overlays */
  resume: Phase
  pendingEvent: EventId | null
  goldMul: number
  speedMul: number
  fx: { popups: Popup[]; beams: Beam[]; shots: Shot[]; parts: Particle[]; sounds: string[]; shake: number }
  time: number
  nextId: number
}
