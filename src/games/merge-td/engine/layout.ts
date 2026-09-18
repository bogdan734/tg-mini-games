import { makePath, type Path } from '../../snake-td/engine/path'
import type { Vec } from './types'

export const BOARD_W = 390
export const BOARD_H = 470
export const COLS = 5
export const ROWS = 4
export const TILE = 60
export const GAP = 8
export const GRID_X = 10
export const GRID_Y = 16
export const ROAD_WIDTH = 34

export const TILES: Vec[] = Array.from({ length: COLS * ROWS }, (_, i) => ({
  x: GRID_X + (i % COLS) * (TILE + GAP) + TILE / 2,
  y: GRID_Y + Math.floor(i / COLS) * (TILE + GAP) + TILE / 2,
}))

const roadX = GRID_X + COLS * (TILE + GAP) - GAP + ROAD_WIDTH / 2 + 4 // right of the grid
const roadY = GRID_Y + ROWS * (TILE + GAP) - GAP + ROAD_WIDTH / 2 + 6 // below the grid

/** Spawn top-right → down the right side → left along the bottom → base at the left. */
export const PATH: Path = makePath([
  { x: roadX, y: -20 },
  { x: roadX, y: roadY - 18 },
  { x: roadX - 6, y: roadY - 6 },
  { x: roadX - 18, y: roadY },
  { x: 34, y: roadY },
])
export const SPAWN: Vec = { x: roadX, y: 8 }
export const BASE: Vec = { x: 34, y: roadY }
