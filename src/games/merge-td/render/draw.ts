import { assetUrl, drawFrame, drawImage, drawNineSlice, drawThreeSlice, sheet, tilePattern, type Sheet } from '../../../lib/atlas'
import { pointAt } from '../../snake-td/engine/path'
import { bossForWave, ENEMY_DEFS, MAX_WAVE } from '../engine/enemies'
import { availableMerges, sellValue, towerAt } from '../engine/game'
import { BASE, BOARD_H, BOARD_W, PATH, ROAD_WIDTH, SPAWN, TILE, TILES } from '../engine/layout'
import { canMerge, ELEMENTS, mergeElements, mergeLevel, towerDamage, towerName, towerRange, towerRate } from '../engine/towers'
import type { Element, Enemy, EnemyKind, GameState, Shot, Tower } from '../engine/types'

export const HUD_H = 48
export const PANEL_H = 150
export const W = BOARD_W
export const H = HUD_H + BOARD_H + PANEL_H
export const PANEL_Y = HUD_H + BOARD_H
export const FONT = 'Fredoka, -apple-system, sans-serif'

export interface Rect { x: number; y: number; w: number; h: number }
export interface DragState { towerId: number; x: number; y: number; moved: boolean }
export interface ViewState { drag: DragState | null; selected: number | null; toast: { text: string; t: number } | null; muted: boolean }

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
export const waveButtonRect = (): Rect => ({ x: 218, y: 6, w: 112, h: 36 })
export const muteRect = (): Rect => ({ x: W - 48, y: 6, w: 40, h: 36 })
export const sellZoneRect = (): Rect => ({ x: 10, y: PANEL_Y + 14, w: W - 20, h: 122 })
export const choiceRect = (i: number): Rect => ({ x: 14 + i * 96, y: PANEL_Y + 14, w: 86, h: 96 })
export const choiceRerollRect = (): Rect => ({ x: 302, y: PANEL_Y + 14, w: 78, h: 96 })
export const choiceCloseRect = (): Rect => ({ x: 14, y: PANEL_Y + 118, w: W - 28, h: 24 })

export function tileAt(x: number, y: number): number | null {
  const by = y - HUD_H
  for (let i = 0; i < TILES.length; i++) {
    const t = TILES[i]
    if (Math.abs(t.x - x) <= TILE / 2 + 4 && Math.abs(t.y - by) <= TILE / 2 + 4) return i
  }
  return null
}

// ---------------------------------------------------------------- assets
type Color = 'blue' | 'yellow' | 'purple' | 'red'
type Family = 'warrior' | 'archer' | 'pawn' | 'torch' | 'tnt'
const FAMILY_DIR: Record<Family, string> = { warrior: 'troops', archer: 'troops', pawn: 'troops', torch: 'goblins', tnt: 'goblins' }
const troopSheets: Record<string, Sheet> = {}
const troop = (f: Family, c: Color): Sheet => (troopSheets[`${f}_${c}`] ??= sheet(assetUrl(`${FAMILY_DIR[f]}/${f}_${c}.png`), 192, 192))
/** Who stands on the tile: the primary element picks the troop, level picks the mount. */
const LOOK: Record<Element, { f: Family; c: Color }> = {
  fire: { f: 'torch', c: 'red' }, ice: { f: 'archer', c: 'blue' }, bolt: { f: 'archer', c: 'purple' }, nature: { f: 'warrior', c: 'yellow' }, dark: { f: 'warrior', c: 'purple' },
}
const ENEMY_LOOK: Record<EnemyKind, { f: Family; c: Color; scale: number }> = {
  skeleton: { f: 'torch', c: 'blue', scale: 1 }, wolf: { f: 'torch', c: 'yellow', scale: 0.9 }, brute: { f: 'tnt', c: 'red', scale: 1.2 },
  golem: { f: 'tnt', c: 'yellow', scale: 1.7 }, frostworm: { f: 'tnt', c: 'blue', scale: 1.7 }, darklord: { f: 'tnt', c: 'purple', scale: 1.8 },
}
const A = {
  arrow: sheet(assetUrl('troops/arrow.png'), 64, 64),
  fire: sheet(assetUrl('effects/fire.png'), 128, 128),
  explosion: sheet(assetUrl('effects/explosions.png'), 192, 192),
  flat: sheet(assetUrl('terrain/flat.png'), 64, 64),
  elevation: sheet(assetUrl('terrain/elevation.png'), 64, 64),
  water: sheet(assetUrl('terrain/water.png'), 64, 64),
  foam: sheet(assetUrl('terrain/foam.png'), 192, 192),
  shadow: sheet(assetUrl('terrain/shadows.png'), 192, 192),
  castle: sheet(assetUrl('buildings/castle_blue.png'), 320, 256),
  lair: sheet(assetUrl('buildings/goblin_house.png'), 128, 192),
  woodTower: sheet(assetUrl('buildings/wood_tower_red.png'), 256, 192),
  stoneTower: sheet(assetUrl('buildings/tower_blue.png'), 128, 256),
  tree: sheet(assetUrl('deco/tree.png'), 192, 192),
  gold: sheet(assetUrl('ui/gold.png'), 128, 128),
  carved: sheet(assetUrl('ui/Carved_9Slides.png'), 64, 64),
  btnBlue: sheet(assetUrl('ui/Button_Blue_3Slides.png'), 64, 64),
  btnOff: sheet(assetUrl('ui/Button_Disable_3Slides.png'), 64, 64),
  btnRed9: sheet(assetUrl('ui/Button_Red_9Slides.png'), 64, 64),
  iconSwords: sheet(assetUrl('ui/Regular_01.png'), 64, 64),
}
export function preloadMergeAssets(): void {
  for (const l of Object.values(LOOK)) troop(l.f, l.c)
  for (const l of Object.values(ENEMY_LOOK)) troop(l.f, l.c)
}

interface AnimSpec { row: number; n: number }
type AnimName = 'idle' | 'walk' | 'attackR' | 'attackD' | 'attackU' | 'attackUR' | 'attackDR'
const ANIMS: Record<Family, Partial<Record<AnimName, AnimSpec>>> = {
  warrior: { idle: { row: 0, n: 6 }, walk: { row: 1, n: 6 }, attackR: { row: 2, n: 6 }, attackD: { row: 4, n: 6 }, attackU: { row: 6, n: 6 } },
  archer: { idle: { row: 0, n: 6 }, walk: { row: 1, n: 6 }, attackU: { row: 2, n: 8 }, attackUR: { row: 3, n: 8 }, attackR: { row: 4, n: 8 }, attackDR: { row: 5, n: 8 }, attackD: { row: 6, n: 8 } },
  pawn: { idle: { row: 0, n: 6 }, walk: { row: 1, n: 6 }, attackR: { row: 2, n: 6 }, attackD: { row: 3, n: 6 } },
  torch: { idle: { row: 0, n: 7 }, walk: { row: 1, n: 6 }, attackR: { row: 2, n: 6 }, attackD: { row: 3, n: 6 }, attackU: { row: 4, n: 6 } },
  tnt: { idle: { row: 0, n: 6 }, walk: { row: 1, n: 6 }, attackR: { row: 2, n: 7 } },
}
interface UnitAnim { name: AnimName; t: number; dur: number; flip: boolean }
const anims = new Map<number, UnitAnim>()
const seenShots = new WeakSet<Shot>()
function attackAnim(f: Family, dx: number, dy: number): { name: AnimName; flip: boolean } {
  const a = ANIMS[f], ax = Math.abs(dx), ay = Math.abs(dy), flip = dx < 0
  if (f === 'archer') {
    if (ay > ax * 2.4) return { name: dy < 0 ? 'attackU' : 'attackD', flip: false }
    if (ay > ax * 0.45) return { name: dy < 0 ? 'attackUR' : 'attackDR', flip }
    return { name: 'attackR', flip }
  }
  if (ay > ax) { const want: AnimName = dy < 0 ? 'attackU' : 'attackD'; if (a[want]) return { name: want, flip: false } }
  return { name: 'attackR', flip }
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', stroke = true, strokeColor = 'rgba(0,0,0,0.55)') {
  ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'
  if (stroke) { ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y) }
  ctx.fillStyle = color; ctx.fillText(str, x, y)
}
const roundRect = (ctx: CanvasRenderingContext2D, r: Rect, radius: number) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius) }

/** Element gem: a small hexagon in the element colour with its glyph — the readable "what does it do" marker. */
function gem(ctx: CanvasRenderingContext2D, el: Element, x: number, y: number, r: number, alpha = 1) {
  const d = ELEMENTS[el]
  ctx.save(); ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + 1, y + 2, r + 1, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = d.color; ctx.beginPath()
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 6; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) }
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.font = `${Math.round(r * 1.25)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(d.emoji, x, y + 1)
  ctx.restore()
}

// ---------------------------------------------------------------- field
let field: HTMLCanvasElement | null = null
function fieldLayer(): HTMLCanvasElement | null {
  if (field) return field
  if (!A.flat.ready || !A.elevation.ready) return null
  const c = document.createElement('canvas'); c.width = BOARD_W; c.height = BOARD_H
  const g = c.getContext('2d')!
  const grass = tilePattern(g, A.flat, 1, 1, 1)
  g.fillStyle = grass ?? '#4aa85a'; g.beginPath(); g.roundRect(0, -20, BOARD_W, BOARD_H + 14, 18); g.fill()
  g.fillStyle = 'rgba(60,40,20,0.55)'; g.fillRect(0, BOARD_H - 8, BOARD_W, 8)
  g.lineCap = 'round'; g.lineJoin = 'round'
  const road = () => { g.beginPath(); g.moveTo(PATH.pts[0].x, PATH.pts[0].y); for (const p of PATH.pts) g.lineTo(p.x, p.y); g.stroke() }
  g.strokeStyle = 'rgba(70,45,20,0.55)'; g.lineWidth = ROAD_WIDTH + 8; road()
  const sand = tilePattern(g, A.flat, 6, 1, 1)
  g.strokeStyle = sand ?? '#e2c98f'; g.lineWidth = ROAD_WIDTH; road()
  const top = tilePattern(g, A.elevation, 1, 1, 1)
  for (const t of TILES) {
    const x = t.x - TILE / 2, y = t.y - TILE / 2
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.roundRect(x + 2, y + 10, TILE, TILE, 8); g.fill()
    g.drawImage(A.elevation.img, 64, 3 * 64, 64, 64, x, y + TILE - 14, TILE, 20)
    g.fillStyle = top ?? '#7ccf5c'; g.beginPath(); g.roundRect(x, y, TILE, TILE - 6, 8); g.fill()
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.stroke()
  }
  let seed = 11
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (let i = 0; i < 5; i++) { const x = 40 + r() * (BOARD_W - 80), y = 400 + r() * 50; g.drawImage(A.tree.img, 0, 0, 192, 192, x - 40, y - 60, 80, 80) }
  field = c
  return c
}

function drawTroop(ctx: CanvasRenderingContext2D, f: Family, c: Color, id: number, x: number, y: number, size: number, time: number, moving: boolean, alpha = 1, flip = false) {
  const sh = troop(f, c)
  let an = anims.get(id)
  if (an && time - an.t > an.dur) { anims.delete(id); an = undefined }
  const spec = (an && ANIMS[f][an.name]) ?? (moving ? ANIMS[f].walk : ANIMS[f].idle) ?? ANIMS[f].idle!
  const frame = an ? Math.min(spec.n - 1, Math.floor(((time - an.t) / an.dur) * spec.n)) : Math.floor(time * (moving ? 10 : 8) + id) % spec.n
  drawFrame(ctx, sh, frame, spec.row, x, y, size, size, an?.flip ?? flip, alpha)
}

function drawTowerAt(ctx: CanvasRenderingContext2D, t: Tower, x: number, y: number, time: number, alpha = 1, showGems = true) {
  const look = LOOK[t.elements[0]]
  let uy = y - 8
  if (t.level === 4) { drawImage(ctx, A.stoneTower, x, y - 14, 46, 92, alpha); uy = y - 50 }
  else if (t.level >= 2) { drawFrame(ctx, A.woodTower, Math.floor(time * 6) % 4, 0, x, y - 4, 68, 51, false, alpha); uy = y - 30 }
  else drawImage(ctx, A.shadow, x, y + 12, 52, 30, 0.8 * alpha)
  // element aura on the ground
  const aura = ELEMENTS[t.elements[0]].color
  ctx.save(); ctx.globalAlpha = 0.28 * alpha; ctx.fillStyle = aura; ctx.beginPath(); ctx.ellipse(x, y + 16, 26, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  drawTroop(ctx, look.f, look.c, t.id, x, uy, t.level === 1 ? 72 : 60, time, false, alpha)
  if (showGems) {
    const n = t.elements.length
    t.elements.forEach((el, i) => gem(ctx, el, x - (n - 1) * 8 + i * 16, uy - 34 + Math.sin(time * 3 + i) * 1.5, 8, alpha))
  }
}

function drawTowers(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  const drag = view.drag
  for (const t of [...s.towers].sort((a, b) => TILES[a.tile].y - TILES[b.tile].y)) {
    const c = TILES[t.tile]
    const isDragged = drag?.towerId === t.id
    drawTowerAt(ctx, t, c.x, c.y, time, isDragged ? 0.3 : 1)
    if (!isDragged) {
      ctx.fillStyle = t.level === 4 ? '#ffd54a' : t.level === 3 ? '#c56bff' : t.level === 2 ? '#3aa0ff' : '#2f5fbf'
      ctx.beginPath(); ctx.arc(c.x + 22, c.y + 16, 10, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      text(ctx, String(t.level), c.x + 22, c.y + 17, 12, t.level === 4 ? '#3a2a00' : '#fff', 'center', false)
    }
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const e of s.enemies) {
    if (e.d < 0) continue
    const p = pointAt(PATH, e.d)
    const def = ENEMY_DEFS[e.kind]
    const look = ENEMY_LOOK[e.kind]
    const size = 60 * look.scale
    const flash = Math.max(0, e.hitT) / 0.12
    drawImage(ctx, A.shadow, p.x, p.y + size * 0.3, size * 0.8, size * 0.4, 0.8)
    if (e.curse > 0) { ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 10); ctx.fillStyle = '#8f5cff'; ctx.beginPath(); ctx.ellipse(p.x, p.y + size * 0.28, size * 0.42, size * 0.18, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    if (e.burn > 0) drawFrame(ctx, A.fire, Math.floor(time * 12 + e.id) % 7, 0, p.x, p.y - size * 0.2, size * 0.9, size * 0.9, false, 0.9)
    const flip = Math.cos(p.angle) < 0
    const sh = troop(look.f, look.c)
    const spec = e.root > 0 ? ANIMS[look.f].idle! : ANIMS[look.f].walk!
    const frame = Math.floor(time * (e.kind === 'wolf' ? 14 : 9) + e.id) % spec.n
    drawFrame(ctx, sh, frame, spec.row, p.x, p.y - size * 0.25, size, size, flip)
    if (flash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${0.5 * flash})`; ctx.beginPath(); ctx.arc(p.x, p.y - size * 0.25, size * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over' }
    if (e.slow > 0) { ctx.strokeStyle = 'rgba(150,215,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y + size * 0.28, size * 0.36, size * 0.16, 0, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.1; ctx.fillStyle = '#dff6ff'; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * size * 0.4, p.y - size * 0.1 + Math.sin(a) * size * 0.2, 2.5, 0, Math.PI * 2); ctx.fill() } }
    if (e.root > 0) { ctx.strokeStyle = '#3f9a4d'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * size * 0.3, p.y + size * 0.3); ctx.quadraticCurveTo(p.x + Math.cos(a) * size * 0.15, p.y, p.x + Math.cos(a + 0.5) * size * 0.05, p.y - size * 0.1); ctx.stroke() } }
    // resist / weak badges, always visible so the player plans around them
    const bx = p.x - (def.resist.length + (def.weak ? 1 : 0) - 1) * 9
    def.resist.forEach((el, i) => { gem(ctx, el, bx + i * 18, p.y - size * 0.72, 7); ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + i * 18 - 7, p.y - size * 0.72 - 7); ctx.lineTo(bx + i * 18 + 7, p.y - size * 0.72 + 7); ctx.stroke() })
    if (def.weak) { const wx = bx + def.resist.length * 18; gem(ctx, def.weak, wx, p.y - size * 0.72, 7); text(ctx, '×2', wx + 10, p.y - size * 0.72 - 8, 9, '#ffd54a') }
    const w = size * 0.7, hp = Math.max(0, e.hp) / e.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - w / 2, p.y - size * 0.6, w, 4)
    ctx.fillStyle = hp > 0.5 ? '#5be07a' : hp > 0.25 ? '#ffd54a' : '#ff5a5a'; ctx.fillRect(p.x - w / 2, p.y - size * 0.6, w * hp, 4)
    if (def.boss) text(ctx, `${def.name} ${Math.ceil(e.hp)}`, Math.min(Math.max(p.x, 70), W - 70), p.y - size * 0.86, 12, '#fff')
  }
}

/** Element-specific projectile at (x,y) heading along `ang`. */
function drawProjectile(ctx: CanvasRenderingContext2D, el: Element, x: number, y: number, ang: number, level: number, time: number) {
  const sz = 1 + (level - 1) * 0.25
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang)
  switch (el) {
    case 'fire': {
      ctx.fillStyle = 'rgba(255,120,40,0.45)'; ctx.beginPath(); ctx.ellipse(-10 * sz, 0, 14 * sz, 6 * sz, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.arc(0, 0, 7 * sz, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(1.5 * sz, 0, 3.5 * sz, 0, Math.PI * 2); ctx.fill()
      break
    }
    case 'ice': {
      ctx.fillStyle = '#dff6ff'; ctx.strokeStyle = '#4fa3e0'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(9 * sz, 0); ctx.lineTo(0, -4 * sz); ctx.lineTo(-8 * sz, 0); ctx.lineTo(0, 4 * sz); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = 'rgba(200,235,255,0.6)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 * sz - i * 5, 0); ctx.lineTo(-12 * sz - i * 5, (i - 1) * 3); ctx.stroke() }
      break
    }
    case 'bolt': break // drawn as a lightning line by the caller
    case 'nature': {
      ctx.fillStyle = '#5fd07a'; ctx.strokeStyle = '#2e7d3a'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(0, 0, 8 * sz, 4 * sz, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-6 * sz, 2 * sz); ctx.lineTo(6 * sz, -2 * sz); ctx.stroke()
      break
    }
    case 'dark': {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 9 * sz); g.addColorStop(0, '#d9c8ff'); g.addColorStop(0.5, '#8f5cff'); g.addColorStop(1, 'rgba(58,28,107,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9 * sz, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(58,28,107,0.6)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-8 - i * 5, Math.sin(time * 20 + i) * 3, 3 - i * 0.6, 0, Math.PI * 2); ctx.fill() }
      break
    }
  }
  ctx.restore()
}

function drawShots(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const sh of s.fx.shots) {
    if (!seenShots.has(sh)) {
      seenShots.add(sh)
      const t = s.towers.find((x) => x.id === sh.towerId)
      if (t) {
        const f = LOOK[t.elements[0]].f
        const spec = attackAnim(f, sh.tx - sh.x, sh.ty - sh.y)
        const n = ANIMS[f][spec.name]?.n ?? 6
        anims.set(t.id, { name: spec.name, t: time, dur: Math.min(0.5, Math.max(0.28, n / 16)), flip: spec.flip })
      }
    }
    const primary = sh.elements[0]
    const ang = Math.atan2(sh.ty - sh.y, sh.tx - sh.x)
    const k = Math.min(1, sh.t / 0.22)
    const fx = sh.x + (sh.tx - sh.x) * k, fy = sh.y + (sh.ty - sh.y) * k - Math.sin(k * Math.PI) * 14
    if (sh.elements.includes('bolt') && sh.t < 0.25) {
      ctx.globalAlpha = 1 - sh.t / 0.25
      ctx.strokeStyle = ELEMENTS.bolt.color; ctx.lineWidth = 3; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y)
      const dx = sh.tx - sh.x, dy = sh.ty - sh.y, L = Math.hypot(dx, dy) || 1
      for (let i = 1; i <= 6; i++) { const kk = i / 6, j = i === 6 ? 0 : (i % 2 ? 7 : -7); ctx.lineTo(sh.x + dx * kk - (dy / L) * j, sh.y + dy * kk + (dx / L) * j) }
      ctx.stroke(); ctx.globalAlpha = 1
    }
    if (primary !== 'bolt' && sh.t < 0.22) {
      drawProjectile(ctx, primary, fx, fy, ang, sh.level, time)
      // extra elements ride along as trailing sparks
      sh.elements.slice(1).forEach((el, i) => { ctx.fillStyle = ELEMENTS[el].color; ctx.beginPath(); ctx.arc(fx - Math.cos(ang) * (10 + i * 7), fy - Math.sin(ang) * (10 + i * 7) + Math.sin(time * 25 + i) * 3, 3, 0, Math.PI * 2); ctx.fill() })
    }
    // impact effects per element
    const q = (sh.t - 0.22) / 0.4
    if (q > 0 && q < 1) {
      for (const el of sh.elements) {
        switch (el) {
          case 'fire': drawFrame(ctx, A.fire, Math.floor(q * 7), 0, sh.tx, sh.ty - 14, 50 + sh.level * 6, 50 + sh.level * 6, false, 1 - q); break
          case 'ice': ctx.strokeStyle = `rgba(180,230,255,${1 - q})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sh.tx, sh.ty, 6 + q * 22, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + q; ctx.fillStyle = `rgba(223,246,255,${1 - q})`; ctx.beginPath(); ctx.moveTo(sh.tx + Math.cos(a) * (8 + q * 18), sh.ty + Math.sin(a) * (8 + q * 18)); ctx.lineTo(sh.tx + Math.cos(a + 0.2) * (4 + q * 10), sh.ty + Math.sin(a + 0.2) * (4 + q * 10)); ctx.lineTo(sh.tx + Math.cos(a - 0.2) * (4 + q * 10), sh.ty + Math.sin(a - 0.2) * (4 + q * 10)); ctx.fill() } break
          case 'nature': ctx.strokeStyle = `rgba(63,154,77,${1 - q})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const a = i * 1.26; ctx.beginPath(); ctx.moveTo(sh.tx, sh.ty + 8); ctx.quadraticCurveTo(sh.tx + Math.cos(a) * 14, sh.ty + 2 - q * 10, sh.tx + Math.cos(a) * (10 + q * 16), sh.ty - q * 22 + Math.sin(a) * 6); ctx.stroke() } break
          case 'dark': { const g = ctx.createRadialGradient(sh.tx, sh.ty, 2, sh.tx, sh.ty, 18 + q * 20); g.addColorStop(0, `rgba(217,200,255,${0.8 - q * 0.8})`); g.addColorStop(0.6, `rgba(143,92,255,${0.5 - q * 0.5})`); g.addColorStop(1, 'rgba(58,28,107,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sh.tx, sh.ty, 18 + q * 20, 0, Math.PI * 2); ctx.fill(); text(ctx, '☠', sh.tx, sh.ty - 18 - q * 14, 14 + q * 6, `rgba(217,200,255,${1 - q})`, 'center', false); break }
          case 'bolt': if (q < 0.5) { ctx.strokeStyle = `rgba(240,230,255,${1 - q * 2})`; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * 1.26 + q * 3; ctx.beginPath(); ctx.moveTo(sh.tx, sh.ty); ctx.lineTo(sh.tx + Math.cos(a) * (10 + q * 20), sh.ty + Math.sin(a) * (10 + q * 20)); ctx.stroke() } } break
        }
      }
    }
  }
  for (const p of s.fx.parts) { ctx.globalAlpha = Math.min(1, p.t / 0.3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
}

function drawPanel(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, PANEL_Y, W, PANEL_H)
  drawNineSlice(ctx, A.carved, 4, PANEL_Y + 4, W - 8, PANEL_H - 8, 18)
  if (view.drag) {
    const t = s.towers.find((x) => x.id === view.drag!.towerId)
    const r = sellZoneRect()
    drawNineSlice(ctx, A.btnRed9, r.x, r.y, r.w, r.h, 18)
    text(ctx, `Продать за ${t ? sellValue(t) : 0}`, W / 2 - 14, r.y + r.h / 2, 20, '#fff')
    drawFrame(ctx, A.gold, 0, 0, W / 2 + 78, r.y + r.h / 2, 34, 34)
    return
  }
  if (s.choice) {
    s.choice.options.forEach((el, i) => {
      const r = choiceRect(i)
      const def = ELEMENTS[el], look = LOOK[el]
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; roundRect(ctx, r, 12); ctx.fill()
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke()
      drawTroop(ctx, look.f, look.c, -1 - i, r.x + r.w / 2, r.y + 32, 64, time, false)
      gem(ctx, el, r.x + r.w - 14, r.y + 14, 9)
      text(ctx, def.name, r.x + r.w / 2, r.y + 62, 12, '#3a2a12', 'center', false)
      drawThreeSlice(ctx, s.gold >= s.placeCost ? A.btnBlue : A.btnOff, r.x + 8, r.y + 74, r.w - 16, 18, 8)
      text(ctx, `${s.placeCost}`, r.x + r.w / 2 - 5, r.y + 83, 11, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
      drawFrame(ctx, A.gold, 0, 0, r.x + r.w / 2 + 12, r.y + 83, 16, 16)
    })
    const rr = choiceRerollRect()
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(ctx, rr, 12); ctx.fill()
    drawFrame(ctx, A.iconSwords, 0, 0, rr.x + rr.w / 2, rr.y + 34, 36, 36)
    drawThreeSlice(ctx, s.gold >= s.rerollCost ? A.btnBlue : A.btnOff, rr.x + 8, rr.y + 74, rr.w - 16, 18, 8)
    text(ctx, `${s.rerollCost}`, rr.x + rr.w / 2 - 5, rr.y + 83, 11, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
    drawFrame(ctx, A.gold, 0, 0, rr.x + rr.w / 2 + 12, rr.y + 83, 16, 16)
    const hint = s.choice.options.map((el) => `${ELEMENTS[el].emoji} ${ELEMENTS[el].effect.split(':')[0]}`).join(' · ')
    text(ctx, hint, W / 2, PANEL_Y + 128, 11, '#6b5636', 'center', false)
    return
  }
  const sel = view.selected !== null ? s.towers.find((t) => t.id === view.selected) : undefined
  let y = PANEL_Y + 24
  if (sel) {
    drawTowerAt(ctx, sel, 40, y + 26, time, 1, false)
    sel.elements.forEach((el, i) => gem(ctx, el, 76 + i * 20, y - 2, 8))
    text(ctx, `${towerName(sel)} · ур.${sel.level}`, 76 + sel.elements.length * 20 + 4, y - 2, 13, '#3a2a12', 'left', false)
    text(ctx, `⚔${towerDamage(sel)} · ${towerRate(sel)}/с · радиус ${towerRange(sel)}`, 76, y + 16, 12, '#6b5636', 'left', false)
    sel.elements.slice(0, 3).forEach((el, i) => text(ctx, `${ELEMENTS[el].emoji} ${ELEMENTS[el].effect}`, 76, y + 34 + i * 15, 11, '#3a2a12', 'left', false))
    const partners = s.towers.filter((t) => t.id !== sel.id && canMerge(t, sel))
    text(ctx, sel.level < 4 ? (partners.length ? `Можно слить с ${partners.length} башн${partners.length === 1 ? 'ей' : 'ями'} (уровни складываются до 4)` : 'Нет башен для слияния: сумма уровней > 4') : 'Максимум: четыре в одном', 76, y + 84, 11, sel.level < 4 && partners.length ? '#1f5fbf' : '#8a7a5a', 'left', false)
    return
  }
  const boss = bossForWave(s.wave)
  if (boss) {
    const d = ENEMY_DEFS[boss]
    text(ctx, `Босс волны ${s.wave}: ${d.name}`, W / 2, y - 4, 13, '#3a2a12', 'center', false)
    let x = W / 2 - 80
    text(ctx, 'Не берёт:', x, y + 18, 12, '#6b5636', 'left', false); x += 62
    d.resist.forEach((el) => { gem(ctx, el, x, y + 18, 8); x += 20 })
    x += 12
    text(ctx, 'Слаб к:', x, y + 18, 12, '#6b5636', 'left', false); x += 52
    if (d.weak) gem(ctx, d.weak, x, y + 18, 8)
    text(ctx, 'Нужна стихия, к которой он слаб — или слей несколько в одну', W / 2, y + 40, 11, '#6b5636', 'center', false)
  } else {
    text(ctx, `Волна ${s.wave} из ${MAX_WAVE}${s.wave === 3 || s.wave === 7 || s.wave === 11 ? ` · дальше босс` : ''}`, W / 2, y - 4, 13, '#3a2a12', 'center', false)
    text(ctx, 'Тап по плите — башня · башню на башню — слияние (до ур.4)', W / 2, y + 16, 11, '#6b5636', 'center', false)
  }
  const merges = availableMerges(s)
  if (merges.length) {
    text(ctx, 'Можно слить сейчас:', 16, y + 60, 12, '#1f5fbf', 'left', false)
    merges.slice(0, 3).forEach((m, i) => text(ctx, `${m.a.elements.map((e) => ELEMENTS[e].emoji).join('')}${m.a.level} + ${m.b.elements.map((e) => ELEMENTS[e].emoji).join('')}${m.b.level} → ${m.elements.map((e) => ELEMENTS[e].emoji).join('')} ур.${m.level}`, 16, y + 78 + i * 15, 11, '#3a2a12', 'left', false))
  } else {
    let x = 20
    for (const el of Object.values(ELEMENTS)) { gem(ctx, el.id, x, y + 66, 8); text(ctx, el.effect.split(':')[0], x + 14, y + 66, 11, '#3a2a12', 'left', false); x += 72 }
    text(ctx, 'Любые две башни сливаются: все их стихии остаются в одной', W / 2, y + 90, 11, '#6b5636', 'center', false)
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, 0, W, HUD_H)
  drawNineSlice(ctx, A.carved, 4, 2, W - 8, HUD_H - 4, 14)
  text(ctx, `❤️ ${s.lives}`, 14, HUD_H / 2, 16, '#3a2a12', 'left', false)
  drawFrame(ctx, A.gold, 0, 0, 84, HUD_H / 2, 26, 26)
  text(ctx, `${s.gold}`, 98, HUD_H / 2, 16, '#3a2a12', 'left', false)
  text(ctx, `Волна ${Math.min(s.wave, MAX_WAVE)}/${MAX_WAVE}`, 146, HUD_H / 2, 13, '#5a4a2a', 'left', false)
  if (s.phase === 'ready') {
    const r = waveButtonRect()
    drawThreeSlice(ctx, A.btnBlue, r.x, r.y, r.w, r.h, 16)
    text(ctx, `▶ Волна ${s.wave}`, r.x + r.w / 2, r.y + r.h / 2 - 1, 14, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
  }
  const m = muteRect()
  drawThreeSlice(ctx, A.btnBlue, m.x, m.y, m.w, m.h, 12)
  text(ctx, view.muted ? '🔇' : '🔊', m.x + m.w / 2, m.y + m.h / 2, 16, '#fff', 'center', false)
}

export function drawGame(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  ctx.clearRect(0, 0, W, H)
  drawHud(ctx, s, view)
  ctx.save()
  const shake = s.fx.shake > 0 ? (s.fx.shake / 0.3) * 4 : 0
  ctx.translate(shake ? (Math.random() - 0.5) * shake * 2 : 0, HUD_H + (shake ? (Math.random() - 0.5) * shake * 2 : 0))
  const water = tilePattern(ctx, A.water, 0, 0, 1)
  ctx.fillStyle = water ?? '#3f8fbf'; ctx.fillRect(-10, 0, W + 20, BOARD_H + 20)
  if (A.foam.ready) {
    const fr = Math.floor(time * 8) % 8
    for (let x = 20; x < W; x += 60) drawFrame(ctx, A.foam, (fr + 3) % 8, 0, x + 30, BOARD_H - 4, 90, 90, false, 0.9)
    for (let y = 40; y < BOARD_H; y += 60) { drawFrame(ctx, A.foam, (fr + 5) % 8, 0, 2, y, 90, 90, false, 0.9); drawFrame(ctx, A.foam, (fr + 1) % 8, 0, W - 2, y + 30, 90, 90, false, 0.9) }
  }
  const f = fieldLayer()
  if (f) ctx.drawImage(f, 0, 0); else { ctx.fillStyle = '#4aa85a'; ctx.fillRect(0, 0, W, BOARD_H) }
  const drag = view.drag
  const dragTower = drag ? s.towers.find((t) => t.id === drag.towerId) : undefined
  if (dragTower) {
    for (let i = 0; i < TILES.length; i++) {
      const occ = towerAt(s, i)
      let color: string | null = null
      if (!occ) color = 'rgba(255,255,255,0.3)'
      else if (occ.id !== dragTower.id && mergeLevel(dragTower, occ) !== null) color = mergeElements(occ.elements, dragTower.elements).length > occ.elements.length ? 'rgba(255,120,255,0.55)' : 'rgba(255,215,80,0.5)'
      if (!color) continue
      const t = TILES[i]
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(t.x - TILE / 2, t.y - TILE / 2, TILE, TILE - 6, 8); ctx.fill()
    }
  }
  if (s.choice) {
    const t = TILES[s.choice.tile]
    ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.roundRect(t.x - TILE / 2 - 2, t.y - TILE / 2 - 2, TILE + 4, TILE - 2, 10); ctx.stroke(); ctx.setLineDash([])
  }
  const focus = dragTower ?? (view.selected !== null ? s.towers.find((t) => t.id === view.selected) : undefined)
  const hover = drag ? tileAt(drag.x, drag.y) : null
  if (focus) {
    const c = hover !== null && dragTower ? TILES[hover] : TILES[focus.tile]
    const col = ELEMENTS[focus.elements[0]].color
    ctx.fillStyle = `${col}22`; ctx.strokeStyle = `${col}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, towerRange(focus), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  drawImage(ctx, A.lair, SPAWN.x, SPAWN.y + 22, 54, 80)
  drawTowers(ctx, s, view, time)
  drawEnemies(ctx, s, time)
  drawShots(ctx, s, time)
  drawImage(ctx, A.castle, BASE.x + 12, BASE.y - 6, 100, 80)
  for (const p of s.fx.popups) { ctx.globalAlpha = Math.min(1, p.t / 0.3); text(ctx, p.text, p.x, p.y, p.text === 'РЕЗИСТ' || p.text.startsWith('СЛАБ') ? 12 : 13, p.color); ctx.globalAlpha = 1 }
  if (s.towers.length === 0 && s.phase === 'ready' && !s.choice) {
    text(ctx, 'Тапни плиту и выбери стихию', W / 2, BOARD_H - 100, 15, '#fff')
    text(ctx, 'Любые две башни сливаются в одну сильнее', W / 2, BOARD_H - 78, 13, '#eaf5ff')
  }
  ctx.restore()
  drawPanel(ctx, s, view, time)
  if (dragTower) drawTowerAt(ctx, dragTower, drag!.x, drag!.y - 34, time, 0.9)
  if (view.toast) { ctx.globalAlpha = Math.min(1, view.toast.t); text(ctx, view.toast.text, W / 2, HUD_H + BOARD_H - 30, 16, '#ffd54a'); ctx.globalAlpha = 1 }
}
export type { Enemy }
