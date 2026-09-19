import { BOARD_H as H, BOARD_W as W, PATH_INSET as M } from './layout'
import { roundedRoute, type Path } from './path'
import type { Vec } from './types'

export interface Palette { bg1: string; bg2: string; road: string; roadEdge: string; tuft: string; dash: string }

export interface LevelDef {
  id: number
  name: string
  icon: string
  desc: string
  palette: Palette
  path: Path
  slots: Vec[]
  spawn: Vec
  gate: Vec
  hpMul: number
  speedMul: number
  /** Infinity = endless */
  waves: number
}

const GATE_GAP = 70
const R = W - M // right road x
const B = H - M // bottom road y

const pts = (...p: [number, number][]): Vec[] => p.map(([x, y]) => ({ x, y }))
const ends = (p: Path) => ({ spawn: p.pts[0], gate: p.pts[p.pts.length - 1] })

/** «Излучина»: ring whose left side bends inward twice. */
const meadowRoad = (): Path => roundedRoute(pts(
  [R, M], [M, M], [M, 150], [M + 64, 205], [M + 64, 265], [M, 320], [M, B], [R, B], [R, M + GATE_GAP],
), 34)
const meadowSlots: Vec[] = [
  ...pts([100, 100], [172, 100], [244, 100], [310, 100]),
  ...pts([172, 178], [244, 178], [310, 178]),
  ...pts([172, 292], [244, 292], [310, 292]),
  ...pts([100, 372], [172, 372], [244, 372], [310, 372]),
]

/** «Серпантин»: the road snakes through the middle in three lanes. */
const desertRoad = (): Path => roundedRoute(pts(
  [R, M], [M, M], [M, 190], [R - 72, 190], [R - 72, 290], [M, 290], [M, B], [R, B], [R, M + GATE_GAP],
), 30)
const desertSlots: Vec[] = [
  ...pts([92, 113], [162, 113], [232, 113], [302, 113]),
  ...pts([92, 240], [162, 240], [232, 240]),
  ...pts([92, 362], [162, 362], [232, 362], [302, 362]),
]

/** «Песочные часы»: both long sides pinch toward the middle. */
const snowRoad = (): Path => roundedRoute(pts(
  [R, M], [M, M], [M, H / 2 - 60], [M + 78, H / 2], [M, H / 2 + 60], [M, B], [R, B], [R, H / 2 + 60], [R - 78, H / 2], [R, H / 2 - 60], [R, M + GATE_GAP],
), 30)
const inner = M + 17 + 12
const grid = (cols: number, rows: number, left: number, right: number, top: number, bottom: number): Vec[] => {
  const cw = (right - left) / cols, ch = (bottom - top) / rows
  const out: Vec[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: left + cw * (c + 0.5), y: top + ch * (r + 0.5) })
  return out
}
const snowSlots: Vec[] = [
  ...grid(4, 2, inner, W - inner, inner, H / 2 - 70),
  { x: W / 2 - 34, y: H / 2 }, { x: W / 2 + 34, y: H / 2 },
  ...grid(4, 2, inner, W - inner, H / 2 + 70, H - inner),
]

/** «Клыки»: the top lane dips into a V and the bottom lane rises into a peak. */
const lavaRoad = (): Path => roundedRoute(pts(
  [R, M], [W / 2 + 52, M], [W / 2, M + 58], [W / 2 - 52, M], [M, M], [M, B], [W / 2 - 52, B], [W / 2, B - 58], [W / 2 + 52, B], [R, B], [R, M + GATE_GAP],
), 26)
const lavaSlots: Vec[] = [
  ...pts([96, 96], [294, 96]),
  ...pts([96, 172], [162, 180], [228, 180], [294, 172]),
  ...pts([96, 262], [162, 254], [228, 254], [294, 262]),
  ...pts([96, 372], [294, 372]),
]

const meadow: Palette = { bg1: '#3f9a4d', bg2: '#2f7a3d', road: '#d9b877', roadEdge: '#8a6b3e', tuft: 'rgba(255,255,255,0.10)', dash: 'rgba(255,255,255,0.35)' }
const desert: Palette = { bg1: '#d9a85a', bg2: '#b8843f', road: '#f1dcae', roadEdge: '#8f6533', tuft: 'rgba(90,50,10,0.15)', dash: 'rgba(120,80,30,0.35)' }
const snow: Palette = { bg1: '#dfe9f5', bg2: '#b9cbe0', road: '#8fa7c4', roadEdge: '#4d6180', tuft: 'rgba(255,255,255,0.6)', dash: 'rgba(255,255,255,0.5)' }
const lava: Palette = { bg1: '#3b2a2f', bg2: '#241a1d', road: '#6b5250', roadEdge: '#ff7a3d', tuft: 'rgba(255,120,60,0.18)', dash: 'rgba(255,170,90,0.4)' }

const p1 = meadowRoad(), p2 = desertRoad(), p3 = snowRoad(), p4 = lavaRoad()

export const LEVELS: LevelDef[] = [
  { id: 1, name: 'Излучина', icon: '🌿', desc: 'Дорога дважды вгрызается в поле, 14 позиций', palette: meadow, path: p1, slots: meadowSlots, ...ends(p1), hpMul: 1, speedMul: 1, waves: 10 },
  { id: 2, name: 'Серпантин', icon: '🏜️', desc: 'Червь петляет через всё поле — длинный путь, 11 позиций', palette: desert, path: p2, slots: desertSlots, ...ends(p2), hpMul: 1.1, speedMul: 1.05, waves: 10 },
  { id: 3, name: 'Песочные часы', icon: '❄️', desc: 'Узкие места посередине, 18 позиций, червь крепче на 10%', palette: snow, path: p3, slots: snowSlots, ...ends(p3), hpMul: 1.1, speedMul: 1.05, waves: 10 },
  { id: 4, name: 'Клыки', icon: '♾️', desc: 'Волны без конца — держись сколько сможешь', palette: lava, path: p4, slots: lavaSlots, ...ends(p4), hpMul: 1, speedMul: 1, waves: Infinity },
]

export const getLevel = (id: number): LevelDef => LEVELS.find((l) => l.id === id) ?? LEVELS[0]

/** Highest level unlocked after winning `won` when `unlocked` were already open. */
export const unlockAfterWin = (won: number, unlocked: number): number => Math.min(LEVELS.length, Math.max(unlocked, won + 1))
