import { boardPath, type Path } from './path'
import type { Vec } from './types'

export const BOARD_W = 390
export const BOARD_H = 470
export const PATH_INSET = 36
export const PATH_WIDTH = 34
export const SLOT_COLS = 4
export const SLOT_ROWS = 4
export const SLOT_R = 26

export const PATH: Path = boardPath(BOARD_W, BOARD_H, PATH_INSET)

function buildSlots(): Vec[] {
  const inner = PATH_INSET + PATH_WIDTH / 2 + 12
  const left = inner
  const right = BOARD_W - inner
  const top = inner
  const bottom = BOARD_H - inner
  const cw = (right - left) / SLOT_COLS
  const ch = (bottom - top) / SLOT_ROWS
  const out: Vec[] = []
  for (let r = 0; r < SLOT_ROWS; r++)
    for (let c = 0; c < SLOT_COLS; c++)
      out.push({ x: left + cw * (c + 0.5), y: top + ch * (r + 0.5) })
  return out
}

export const SLOTS: Vec[] = buildSlots()
export const SPAWN: Vec = PATH.pts[0]
export const GATE: Vec = PATH.pts[PATH.pts.length - 1]
