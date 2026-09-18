import { BOARD_H as H, BOARD_W as W, PATH_INSET as M } from './layout'
import { roundedRoute, type Path } from './path'
import type { Vec } from './types'

export interface Palette {
  bg1: string; bg2: string; road: string; roadEdge: string; tuft: string; dash: string
}

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
const inner = M + 17 + 12 // path inset + half road + margin

function grid(cols: number, rows: number, left = inner, right = W - inner, top = inner, bottom = H - inner): Vec[] {
  const cw = (right - left) / cols, ch = (bottom - top) / rows
  const out: Vec[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: left + cw * (c + 0.5), y: top + ch * (r + 0.5) })
  return out
}

const ring = (): Path => roundedRoute([
  { x: W - M, y: M }, { x: M, y: M }, { x: M, y: H - M }, { x: W - M, y: H - M }, { x: W - M, y: M + GATE_GAP },
], 40)

const octagon = (): Path => roundedRoute([
  { x: W - M, y: M }, { x: M + 70, y: M }, { x: M, y: M + 70 }, { x: M, y: H - M - 70 }, { x: M + 70, y: H - M },
  { x: W - M - 70, y: H - M }, { x: W - M, y: H - M - 70 }, { x: W - M, y: M + GATE_GAP },
], 24)

const bowtie = (): Path => roundedRoute([
  { x: W - M, y: M }, { x: M, y: M }, { x: M, y: H / 2 - 60 }, { x: M + 78, y: H / 2 }, { x: M, y: H / 2 + 60 },
  { x: M, y: H - M }, { x: W - M, y: H - M }, { x: W - M, y: H / 2 + 60 }, { x: W - M - 78, y: H / 2 },
  { x: W - M, y: H / 2 - 60 }, { x: W - M, y: M + GATE_GAP },
], 30)

const ends = (p: Path) => ({ spawn: p.pts[0], gate: p.pts[p.pts.length - 1] })

const meadow: Palette = { bg1: '#3f9a4d', bg2: '#2f7a3d', road: '#d9b877', roadEdge: '#8a6b3e', tuft: 'rgba(255,255,255,0.10)', dash: 'rgba(255,255,255,0.35)' }
const desert: Palette = { bg1: '#d9a85a', bg2: '#b8843f', road: '#f1dcae', roadEdge: '#8f6533', tuft: 'rgba(90,50,10,0.15)', dash: 'rgba(120,80,30,0.35)' }
const snow: Palette = { bg1: '#dfe9f5', bg2: '#b9cbe0', road: '#8fa7c4', roadEdge: '#4d6180', tuft: 'rgba(255,255,255,0.6)', dash: 'rgba(255,255,255,0.5)' }
const lava: Palette = { bg1: '#3b2a2f', bg2: '#241a1d', road: '#6b5250', roadEdge: '#ff7a3d', tuft: 'rgba(255,120,60,0.18)', dash: 'rgba(255,170,90,0.4)' }

const p1 = ring(), p2 = octagon(), p3 = bowtie(), p4 = ring()

export const LEVELS: LevelDef[] = [
  { id: 1, name: 'Луг', icon: '🌿', desc: 'Классическое кольцо, 16 слотов', palette: meadow, path: p1, slots: grid(4, 4), ...ends(p1), hpMul: 1, speedMul: 1, waves: 10 },
  { id: 2, name: 'Пустыня', icon: '🏜️', desc: 'Срезанные углы — круг короче, змея приходит чаще', palette: desert, path: p2,
    slots: grid(4, 4), ...ends(p2), hpMul: 1, speedMul: 1, waves: 10 },
  { id: 3, name: 'Снега', icon: '❄️', desc: 'Узкие места посередине, змея крепче на 10%', palette: snow, path: p3,
    slots: [
      ...grid(4, 2, inner, W - inner, inner, H / 2 - 70),
      { x: W / 2 - 34, y: H / 2 }, { x: W / 2 + 34, y: H / 2 },
      ...grid(4, 2, inner, W - inner, H / 2 + 70, H - inner),
    ], ...ends(p3), hpMul: 1.1, speedMul: 1.05, waves: 10 },
  { id: 4, name: 'Бесконечность', icon: '♾️', desc: 'Волны без конца — держись сколько сможешь', palette: lava, path: p4, slots: grid(4, 4), ...ends(p4), hpMul: 1, speedMul: 1, waves: Infinity },
]

export const getLevel = (id: number): LevelDef => LEVELS.find((l) => l.id === id) ?? LEVELS[0]

/** Highest level unlocked after winning `won` when `unlocked` were already open. */
export const unlockAfterWin = (won: number, unlocked: number): number => Math.min(LEVELS.length, Math.max(unlocked, won + 1))
