import { assetUrl, drawFrame, drawImage, drawNineSlice, drawThreeSlice, sheet, tilePattern, type Sheet } from '../../../lib/atlas'
import { BOSS_INFO } from '../engine/boss'
import { maxWave, sellValue, unitAt } from '../engine/game'
import { BOARD_H, BOARD_W, PATH_WIDTH, SLOT_R } from '../engine/layout'
import { getLevel, type LevelDef } from '../engine/levels'
import { pointAt } from '../engine/path'
import { segmentD, segmentPos } from '../engine/snake'
import type { GameState, Shot, Unit, UnitType, Vec } from '../engine/types'
import { canMerge, UNIT_DEFS, unitDamage, unitRange } from '../engine/units'

export const HUD_H = 48
export const SHOP_H = 150
export const W = BOARD_W
export const H = HUD_H + BOARD_H + SHOP_H
export const SHOP_Y = HUD_H + BOARD_H
export const FONT = 'Fredoka, -apple-system, sans-serif'

export interface Rect { x: number; y: number; w: number; h: number }
export interface DragState { kind: 'shop' | 'unit'; shopIdx: number; unitId: number; type: UnitType; x: number; y: number; moved: boolean }
export interface ViewState {
  drag: DragState | null
  selected: number | null
  toast: { text: string; t: number } | null
  muted: boolean
  /** cosmetics: units skin id (army colors) and snake skin id */
  unitSkin: string
  snakeSkin: string
}

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
export const shopCardRect = (i: number): Rect => ({ x: 10 + i * 94, y: SHOP_Y + 14, w: 86, h: 122 })
export const waveButtonRect = (): Rect => ({ x: 218, y: 6, w: 112, h: 36 })
export const muteRect = (): Rect => ({ x: W - 48, y: 6, w: 40, h: 36 })
export const sellZoneRect = (): Rect => ({ x: 10, y: SHOP_Y + 14, w: W - 20, h: 122 })

export function slotAt(x: number, y: number, slots: Vec[]): number | null {
  const by = y - HUD_H
  for (let i = 0; i < slots.length; i++) if (Math.hypot(slots[i].x - x, slots[i].y - by) <= SLOT_R + 10) return i
  return null
}

// ---------------------------------------------------------------- assets
type Color = 'blue' | 'yellow' | 'purple' | 'red'
type Family = 'warrior' | 'archer' | 'pawn' | 'torch' | 'tnt'
const COLORS: Color[] = ['blue', 'yellow', 'purple', 'red']
const FAMILY: Record<UnitType, Family> = { volt: 'archer', frost: 'pawn', blaze: 'tnt', venom: 'torch', shadow: 'warrior' }
const FAMILY_DIR: Record<Family, string> = { warrior: 'troops', archer: 'troops', pawn: 'troops', torch: 'goblins', tnt: 'goblins' }
const troopSheets: Record<string, Sheet> = {}
const troop = (f: Family, c: Color): Sheet => {
  const key = `${f}_${c}`
  return (troopSheets[key] ??= sheet(assetUrl(`${FAMILY_DIR[f]}/${key}.png`), 192, 192))
}
const A = {
  arrow: sheet(assetUrl('troops/arrow.png'), 64, 64),
  dynamite: sheet(assetUrl('goblins/dynamite.png'), 64, 64),
  fire: sheet(assetUrl('effects/fire.png'), 128, 128),
  explosion: sheet(assetUrl('effects/explosions.png'), 192, 192),
  flat: sheet(assetUrl('terrain/flat.png'), 64, 64),
  water: sheet(assetUrl('terrain/water.png'), 64, 64),
  foam: sheet(assetUrl('terrain/foam.png'), 192, 192),
  shadow: sheet(assetUrl('terrain/shadows.png'), 192, 192),
  castle: sheet(assetUrl('buildings/castle_blue.png'), 320, 256),
  tree: sheet(assetUrl('deco/tree.png'), 192, 192),
  deco: [1, 2, 6, 7, 10, 11, 14, 15].map((n) => sheet(assetUrl(`deco/deco_${String(n).padStart(2, '0')}.png`), 64, 64)),
  gold: sheet(assetUrl('ui/gold.png'), 128, 128),
  carved: sheet(assetUrl('ui/Carved_9Slides.png'), 64, 64),
  btnBlue: sheet(assetUrl('ui/Button_Blue_3Slides.png'), 64, 64),
  btnRed: sheet(assetUrl('ui/Button_Red_3Slides.png'), 64, 64),
  btnOff: sheet(assetUrl('ui/Button_Disable_3Slides.png'), 64, 64),
  btnBlue9: sheet(assetUrl('ui/Button_Blue_9Slides.png'), 64, 64),
  btnRed9: sheet(assetUrl('ui/Button_Red_9Slides.png'), 64, 64),
  ribbon: sheet(assetUrl('ui/Ribbon_Blue_3Slides.png'), 64, 64),
  iconSwords: sheet(assetUrl('ui/Regular_01.png'), 64, 64),
}
/** Warm up every sheet so the first frame has everything. */
export function preloadSnakeAssets(): void {
  for (const f of Object.keys(FAMILY_DIR) as Family[]) for (const c of COLORS) troop(f, c)
}

// ---------------------------------------------------------------- animation
interface AnimSpec { row: number; n: number }
type AnimName = 'idle' | 'attackR' | 'attackD' | 'attackU' | 'attackUR' | 'attackDR'
const ANIMS: Record<Family, Partial<Record<AnimName, AnimSpec>>> = {
  warrior: { idle: { row: 0, n: 6 }, attackR: { row: 2, n: 6 }, attackD: { row: 4, n: 6 }, attackU: { row: 6, n: 6 } },
  archer: { idle: { row: 0, n: 6 }, attackU: { row: 2, n: 8 }, attackUR: { row: 3, n: 8 }, attackR: { row: 4, n: 8 }, attackDR: { row: 5, n: 8 }, attackD: { row: 6, n: 8 } },
  pawn: { idle: { row: 0, n: 6 }, attackR: { row: 2, n: 6 }, attackD: { row: 3, n: 6 } },
  torch: { idle: { row: 0, n: 7 }, attackR: { row: 2, n: 6 }, attackD: { row: 3, n: 6 }, attackU: { row: 4, n: 6 } },
  tnt: { idle: { row: 0, n: 6 }, attackR: { row: 2, n: 7 } },
}
interface UnitAnim { name: AnimName; t: number; dur: number; flip: boolean }
const anims = new Map<number, UnitAnim>()
const seenShots = new WeakSet<Shot>()

function attackAnim(f: Family, dx: number, dy: number): { name: AnimName; flip: boolean } {
  const a = ANIMS[f]
  const ax = Math.abs(dx), ay = Math.abs(dy)
  const flip = dx < 0
  if (f === 'archer') {
    if (ay > ax * 2.4) return { name: dy < 0 ? 'attackU' : 'attackD', flip: false }
    if (ay > ax * 0.45) return { name: dy < 0 ? 'attackUR' : 'attackDR', flip }
    return { name: 'attackR', flip }
  }
  if (ay > ax) {
    const want: AnimName = dy < 0 ? 'attackU' : 'attackD'
    if (a[want]) return { name: want, flip: false }
  }
  return { name: 'attackR', flip }
}

function colorFor(u: Unit, skin: string): Color {
  if (skin === 'units:cute') return 'yellow'
  if (skin === 'units:villains') return 'purple'
  if (skin === 'units:gold') return 'red'
  if (u.evo === 'risky') return 'red'
  if (u.evo === 'safe') return 'purple'
  return u.level >= 3 ? 'yellow' : 'blue'
}

function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, size: number, time: number, skin: string, alpha = 1) {
  const f = FAMILY[u.type]
  const sh = troop(f, colorFor(u, skin))
  let an = anims.get(u.id)
  if (an && an.name !== 'idle' && time - an.t > an.dur) an = undefined
  const spec = (an && ANIMS[f][an.name]) ?? ANIMS[f].idle!
  const frame = an && an.name !== 'idle'
    ? Math.min(spec.n - 1, Math.floor(((time - an.t) / an.dur) * spec.n))
    : Math.floor(time * 8 + u.id) % spec.n
  drawImage(ctx, A.shadow, x, y + size * 0.34, size * 0.9, size * 0.5, 0.9 * alpha)
  drawFrame(ctx, sh, frame, spec.row, x, y, size, size, an?.flip ?? false, alpha)
}

/** Preview frame (idle) for shop cards. */
function drawUnitPreview(ctx: CanvasRenderingContext2D, type: UnitType, x: number, y: number, size: number, time: number, skin: string, alpha = 1) {
  const ghost: Unit = { id: 0, type, level: 1, evo: 'none', slot: -1, cooldown: 0 }
  const f = FAMILY[type]
  const sh = troop(f, colorFor(ghost, skin))
  const spec = ANIMS[f].idle!
  drawFrame(ctx, sh, Math.floor(time * 6) % spec.n, spec.row, x, y, size, size, false, alpha)
}

// ---------------------------------------------------------------- field
const fieldCache = new Map<number, HTMLCanvasElement>()
function fieldLayer(lvl: LevelDef): HTMLCanvasElement | null {
  if (!A.flat.ready) return null
  const cached = fieldCache.get(lvl.id)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = BOARD_W; c.height = BOARD_H
  const g = c.getContext('2d')!
  const pal = lvl.palette
  // grass island (pattern) with palette-tinted overlay
  const grass = tilePattern(g, A.flat, 1, 1, 1)
  g.fillStyle = grass ?? pal.bg1
  g.beginPath(); g.roundRect(0, 0, BOARD_W, BOARD_H, 18); g.fill()
  g.fillStyle = pal.bg2; g.globalAlpha = lvl.id === 1 ? 0 : 0.35; g.fillRect(0, 0, BOARD_W, BOARD_H); g.globalAlpha = 1
  // road: sand pattern, darker edge
  const P = lvl.path
  const road = () => { g.beginPath(); g.moveTo(P.pts[0].x, P.pts[0].y); for (const p of P.pts) g.lineTo(p.x, p.y); g.stroke() }
  const link = () => { g.beginPath(); g.moveTo(lvl.gate.x, lvl.gate.y); g.lineTo(lvl.spawn.x, lvl.spawn.y); g.stroke() }
  g.lineCap = 'round'; g.lineJoin = 'round'
  g.strokeStyle = 'rgba(70,45,20,0.55)'; g.lineWidth = PATH_WIDTH + 8; road(); link()
  const sand = tilePattern(g, A.flat, 6, 1, 1)
  g.strokeStyle = sand ?? pal.road; g.lineWidth = PATH_WIDTH; road(); link()
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.setLineDash([6, 10]); road(); g.setLineDash([])
  // slots: soft shadow discs
  for (const s of lvl.slots) {
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(s.x, s.y + 14, SLOT_R - 2, SLOT_R * 0.45, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.arc(s.x, s.y + 4, SLOT_R - 4, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
  }
  // decorations in the corners
  let seed = 3 + lvl.id
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const spots: Vec[] = [{ x: 16, y: 16 }, { x: 16, y: BOARD_H - 16 }, { x: BOARD_W - 16, y: BOARD_H - 16 }, { x: BOARD_W / 2, y: BOARD_H - 12 }]
  for (const sp of spots) {
    const d = A.deco[Math.floor(r() * A.deco.length)]
    if (d.ready) g.drawImage(d.img, sp.x - 14, sp.y - 14, 28, 28)
  }
  fieldCache.set(lvl.id, c)
  return c
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', stroke = true, strokeColor = 'rgba(0,0,0,0.55)') {
  ctx.font = `700 ${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (stroke) { ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y) }
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
}
const roundRect = (ctx: CanvasRenderingContext2D, r: Rect, radius: number) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius) }

// ---------------------------------------------------------------- snake
interface SnakeSkin { body: [string, string]; bodyDark: (hp: number) => string; head: [string, string]; outline: string; crack: string }
export const SNAKE_SKINS: Record<string, SnakeSkin> = {
  'snake:stone': { body: ['#e6e9ef', '#8a94a8'], bodyDark: (hp) => `hsl(220, 14%, ${38 + hp * 26}%)`, head: ['#d8dde8', '#5f6a80'], outline: '#2f3647', crack: 'rgba(30,35,50,0.45)' },
  'snake:lava': { body: ['#ffe2a0', '#c0431f'], bodyDark: (hp) => `hsl(${10 + hp * 25}, 85%, ${30 + hp * 18}%)`, head: ['#ffd27a', '#8f1f0d'], outline: '#3a0f08', crack: 'rgba(255,200,80,0.6)' },
  'snake:ice': { body: ['#ffffff', '#6bb0ee'], bodyDark: (hp) => `hsl(205, 70%, ${52 + hp * 26}%)`, head: ['#eaf7ff', '#2f78c2'], outline: '#1e4a78', crack: 'rgba(255,255,255,0.6)' },
  'snake:gold': { body: ['#fff6c2', '#c98a12'], bodyDark: (hp) => `hsl(42, 90%, ${38 + hp * 24}%)`, head: ['#fff7cc', '#a86f00'], outline: '#5a3a00', crack: 'rgba(120,70,0,0.45)' },
}

function boulder(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, top: string, bottom: string, outline: string, crack: string, seed: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.55, r * 1.05, r * 0.5, 0, 0, Math.PI * 2); ctx.fill()
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.1)
  grad.addColorStop(0, top); grad.addColorStop(1, bottom)
  ctx.fillStyle = grad
  ctx.beginPath()
  const bumps = 7
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2
    const wob = 1 + 0.08 * Math.sin(seed + i * 2.3)
    const px = x + Math.cos(a) * r * wob, py = y + Math.sin(a) * r * wob * 0.92
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = outline; ctx.lineWidth = 2.5; ctx.stroke()
  ctx.strokeStyle = crack; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x - r * 0.4, y + r * 0.1); ctx.lineTo(x - r * 0.1, y + r * 0.35); ctx.lineTo(x + r * 0.15, y + r * 0.2); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2); ctx.fill()
}

function drawSnake(ctx: CanvasRenderingContext2D, s: GameState, lvl: LevelDef, time: number, skin: SnakeSkin) {
  for (let i = s.snake.length - 1; i >= 0; i--) {
    const seg = s.snake[i]
    if (segmentD(s, i) < -5) continue
    const p = pointAt(lvl.path, segmentPos(s, i))
    const flash = Math.max(0, seg.hitT) / 0.15
    const r = (seg.head ? 22 : 15) * (1 + 0.1 * flash)
    const hpRatio = Math.max(0, seg.hp) / seg.maxHp
    const top = seg.poison > 0 ? '#c9f7d3' : seg.slow > 0 ? '#e6f4ff' : seg.head ? skin.head[0] : skin.body[0]
    const bottom = seg.poison > 0 ? '#3d9a5c' : seg.slow > 0 ? '#4f8fd6' : seg.head ? (s.boss.kind === 'king' ? '#b0642a' : s.boss.kind !== 'none' ? '#7a3f8f' : skin.head[1]) : skin.bodyDark(hpRatio)
    boulder(ctx, p.x, p.y, r, top, bottom, skin.outline, skin.crack, seg.id)
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.55 * flash})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill() }
    if (seg.poison > 0 && A.fire.ready) drawFrame(ctx, A.fire, Math.floor(time * 12 + seg.id) % 7, 0, p.x, p.y - r * 0.6, r * 2.6, r * 2.6)
    if (seg.head) {
      const a = p.angle, ex = Math.cos(a), ey = Math.sin(a), nx = -ey, ny = ex
      // horns
      ctx.fillStyle = skin.outline
      for (const side of [-1, 1]) {
        const bx = p.x - ex * r * 0.5 + nx * r * 0.7 * side, by = p.y - ey * r * 0.5 + ny * r * 0.7 * side
        ctx.beginPath(); ctx.moveTo(bx - nx * 4 * side, by - ny * 4 * side); ctx.lineTo(bx - ex * 12 + nx * 6 * side, by - ey * 12 + ny * 6 * side); ctx.lineTo(bx + nx * 4 * side, by + ny * 4 * side); ctx.fill()
      }
      // jaw with teeth
      ctx.fillStyle = 'rgba(40,20,30,0.85)'
      ctx.beginPath(); ctx.ellipse(p.x + ex * r * 0.45, p.y + ey * r * 0.45, r * 0.55, r * 0.32, a, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      for (let k = -1; k <= 1; k++) {
        const tx = p.x + ex * r * 0.35 + nx * k * r * 0.28, ty = p.y + ey * r * 0.35 + ny * k * r * 0.28
        ctx.beginPath(); ctx.moveTo(tx - nx * 3, ty - ny * 3); ctx.lineTo(tx + ex * 7, ty + ey * 7); ctx.lineTo(tx + nx * 3, ty + ny * 3); ctx.fill()
      }
      // glowing eyes
      for (const side of [-1, 1]) {
        const cx = p.x + ex * r * 0.05 + nx * r * 0.42 * side, cy = p.y + ey * r * 0.05 + ny * r * 0.42 * side
        const eg = ctx.createRadialGradient(cx, cy, 1, cx, cy, 6)
        eg.addColorStop(0, '#fff6a8'); eg.addColorStop(0.5, '#ff5a2a'); eg.addColorStop(1, 'rgba(255,60,20,0)')
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()
      }
      if (s.boss.shield > 0) { ctx.strokeStyle = 'rgba(120,180,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke() }
      if (s.boss.dashT > 0) { ctx.strokeStyle = 'rgba(255,200,80,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2); ctx.stroke() }
      const bob = Math.sin(time * 6) * 1.5
      const info = BOSS_INFO[s.boss.kind]
      if (info.name) text(ctx, info.name, p.x, p.y - r - 28 + bob, 12, '#ffd54a')
      text(ctx, String(Math.ceil(seg.hp)), p.x, p.y - r - 13 + bob, 15, '#fff')
    } else {
      text(ctx, String(Math.ceil(seg.hp)), p.x, p.y + 1, 12, '#fff')
    }
  }
}

// ---------------------------------------------------------------- shots & effects
function drawShots(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const sh of s.fx.shots) {
    if (!seenShots.has(sh)) {
      seenShots.add(sh)
      const u = s.units.find((x) => x.id === sh.unitId)
      if (u) {
        const f = FAMILY[u.type]
        const spec = attackAnim(f, sh.tx - sh.x, sh.ty - sh.y)
        const n = ANIMS[f][spec.name]?.n ?? 6
        anims.set(u.id, { name: spec.name, t: time, dur: Math.min(0.55, Math.max(0.3, n / 14)), flip: spec.flip })
      }
    }
    const ang = Math.atan2(sh.ty - sh.y, sh.tx - sh.x)
    switch (sh.type) {
      case 'volt': { // arrow flight 0..0.22, then a small hit spark
        if (sh.t < 0.22) {
          const k = sh.t / 0.22
          const x = sh.x + (sh.tx - sh.x) * k, y = sh.y - 22 + (sh.ty - sh.y + 22) * k - Math.sin(k * Math.PI) * 18
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 4)
          if (A.arrow.ready) ctx.drawImage(A.arrow.img, 0, 0, 64, 64, -16, -16, 32, 32)
          else { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke() }
          ctx.restore()
        } else if (sh.t < 0.4) {
          const k = (sh.t - 0.22) / 0.18
          ctx.strokeStyle = `rgba(255,235,140,${1 - k})`; ctx.lineWidth = 2
          for (let i = 0; i < 4; i++) { const a2 = i * Math.PI / 2 + k; ctx.beginPath(); ctx.moveTo(sh.tx + Math.cos(a2) * 4, sh.ty + Math.sin(a2) * 4); ctx.lineTo(sh.tx + Math.cos(a2) * (8 + k * 8), sh.ty + Math.sin(a2) * (8 + k * 8)); ctx.stroke() }
        }
        break
      }
      case 'blaze': { // dynamite arc 0..0.4, explosion 0.4..0.85
        if (sh.t < 0.4) {
          const k = sh.t / 0.4
          const x = sh.x + (sh.tx - sh.x) * k, y = sh.y - 20 + (sh.ty - sh.y + 20) * k - Math.sin(k * Math.PI) * 40
          drawFrame(ctx, A.dynamite, Math.floor(sh.t * 20) % 6, 0, x, y, 28, 28)
        } else if (sh.t < 0.85) {
          const k = (sh.t - 0.4) / 0.45
          drawFrame(ctx, A.explosion, Math.min(8, Math.floor(k * 9)), 0, sh.tx, sh.ty - 10, 96, 96)
        }
        break
      }
      case 'venom': { // torch: flame burst at the target
        if (sh.t < 0.6) drawFrame(ctx, A.fire, Math.floor((sh.t / 0.6) * 7), 0, sh.tx, sh.ty - 14, 54, 54, false, 1 - sh.t / 0.7)
        break
      }
      case 'frost': { // hammer shockwave ring
        if (sh.t > 0.12 && sh.t < 0.5) {
          const k = (sh.t - 0.12) / 0.38
          ctx.strokeStyle = `rgba(180,230,255,${1 - k})`; ctx.lineWidth = 4 - k * 3
          ctx.beginPath(); ctx.ellipse(sh.tx, sh.ty + 4, 8 + k * 26, 4 + k * 13, 0, 0, Math.PI * 2); ctx.stroke()
        }
        break
      }
      case 'shadow': { // sword slash crescent at the target
        if (sh.t > 0.1 && sh.t < 0.4) {
          const k = (sh.t - 0.1) / 0.3
          ctx.save(); ctx.translate(sh.tx, sh.ty); ctx.rotate(ang)
          ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 5 - k * 3; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.arc(-6, 0, 18 + k * 10, -1.2, 1.2); ctx.stroke()
          ctx.strokeStyle = `rgba(200,180,255,${0.8 - k * 0.8})`; ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(-6, 0, 24 + k * 12, -1.0, 1.0); ctx.stroke()
          ctx.restore()
        }
        break
      }
    }
  }
  for (const p of s.fx.parts) { ctx.globalAlpha = Math.min(1, p.t / 0.3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
  void time
}

// ---------------------------------------------------------------- shop & hud
function drawShop(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, SHOP_Y, W, SHOP_H)
  drawNineSlice(ctx, A.carved, 4, SHOP_Y + 4, W - 8, SHOP_H - 8, 18)
  if (view.drag?.kind === 'unit') {
    const u = s.units.find((x) => x.id === view.drag!.unitId)
    const r = sellZoneRect()
    drawNineSlice(ctx, A.btnRed9, r.x, r.y, r.w, r.h, 18)
    text(ctx, `Продать за ${u ? sellValue(u) : 0}`, W / 2 - 14, r.y + r.h / 2, 20, '#fff')
    drawFrame(ctx, A.gold, 0, 0, W / 2 + 78, r.y + r.h / 2, 34, 34)
    return
  }
  for (let i = 0; i < 3; i++) {
    const r = shopCardRect(i)
    const type = s.shop[i]
    if (!type) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; roundRect(ctx, r, 12); ctx.fill(); text(ctx, 'куплено', r.x + r.w / 2, r.y + r.h / 2, 13, '#7a6a4a', 'center', false); continue }
    const def = UNIT_DEFS[type]
    const affordable = s.gold >= def.price
    ctx.fillStyle = affordable ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.10)'; roundRect(ctx, r, 12); ctx.fill()
    ctx.strokeStyle = affordable ? def.color : 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.stroke()
    const dragging = view.drag?.kind === 'shop' && view.drag.shopIdx === i
    drawUnitPreview(ctx, type, r.x + r.w / 2, r.y + 44, 84, time, view.unitSkin, dragging ? 0.3 : affordable ? 1 : 0.45)
    text(ctx, def.name, r.x + r.w / 2, r.y + 86, 13, '#3a2a12', 'center', false)
    drawThreeSlice(ctx, affordable ? A.btnBlue : A.btnOff, r.x + 8, r.y + 96, r.w - 16, 22, 10)
    text(ctx, `${def.price}`, r.x + r.w / 2 - 6, r.y + 107, 12, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
    drawFrame(ctx, A.gold, 0, 0, r.x + r.w / 2 + 12, r.y + 107, 18, 18)
  }
  const rr = shopCardRect(3)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(ctx, rr, 12); ctx.fill()
  drawFrame(ctx, A.iconSwords, 0, 0, rr.x + rr.w / 2, rr.y + 40, 40, 40)
  text(ctx, 'Обновить', rr.x + rr.w / 2, rr.y + 76, 12, '#3a2a12', 'center', false)
  drawThreeSlice(ctx, s.gold >= s.rerollCost ? A.btnBlue : A.btnOff, rr.x + 8, rr.y + 96, rr.w - 16, 22, 10)
  text(ctx, `${s.rerollCost}`, rr.x + rr.w / 2 - 6, rr.y + 107, 12, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
  drawFrame(ctx, A.gold, 0, 0, rr.x + rr.w / 2 + 12, rr.y + 107, 18, 18)
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, 0, W, HUD_H)
  drawNineSlice(ctx, A.carved, 4, 2, W - 8, HUD_H - 4, 14)
  text(ctx, `❤️ ${s.lives}`, 14, HUD_H / 2, 16, '#3a2a12', 'left', false)
  drawFrame(ctx, A.gold, 0, 0, 84, HUD_H / 2, 26, 26)
  text(ctx, `${s.gold}`, 98, HUD_H / 2, 16, '#3a2a12', 'left', false)
  const mw = maxWave(s)
  text(ctx, mw === Infinity ? `Волна ${s.wave}` : `Волна ${Math.min(s.wave, mw)}/${mw}`, 146, HUD_H / 2, 13, '#5a4a2a', 'left', false)
  if (s.phase === 'ready') {
    const r = waveButtonRect()
    drawThreeSlice(ctx, A.btnBlue, r.x, r.y, r.w, r.h, 16)
    text(ctx, `▶ Волна ${s.wave}`, r.x + r.w / 2, r.y + r.h / 2 - 1, 14, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
  }
  const m = muteRect()
  drawThreeSlice(ctx, A.btnBlue, m.x, m.y, m.w, m.h, 12)
  text(ctx, view.muted ? '🔇' : '🔊', m.x + m.w / 2, m.y + m.h / 2, 16, '#fff', 'center', false)
}

// ---------------------------------------------------------------- main
export function drawGame(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  const lvl = getLevel(s.level)
  ctx.clearRect(0, 0, W, H)
  drawHud(ctx, s, view)
  ctx.save()
  const shake = s.fx.shake > 0 ? (s.fx.shake / 0.4) * 5 : 0
  ctx.translate(shake ? (Math.random() - 0.5) * shake * 2 : 0, HUD_H + (shake ? (Math.random() - 0.5) * shake * 2 : 0))
  // water + foam under the island
  const water = tilePattern(ctx, A.water, 0, 0, 1)
  ctx.fillStyle = water ?? '#3f8fbf'; ctx.fillRect(-10, -10, W + 20, BOARD_H + 20)
  if (A.foam.ready) {
    const fr = Math.floor(time * 8) % 8
    for (let x = 20; x < W; x += 60) { drawFrame(ctx, A.foam, fr, 0, x, 2, 90, 90, false, 0.9); drawFrame(ctx, A.foam, (fr + 3) % 8, 0, x + 30, BOARD_H - 2, 90, 90, false, 0.9) }
    for (let y = 40; y < BOARD_H; y += 60) { drawFrame(ctx, A.foam, (fr + 5) % 8, 0, 2, y, 90, 90, false, 0.9); drawFrame(ctx, A.foam, (fr + 1) % 8, 0, W - 2, y + 30, 90, 90, false, 0.9) }
  }
  const field = fieldLayer(lvl)
  if (field) ctx.drawImage(field, 0, 0)
  else { ctx.fillStyle = lvl.palette.bg1; ctx.fillRect(0, 0, W, BOARD_H) }

  const drag = view.drag
  const dragUnit = drag?.kind === 'unit' ? s.units.find((u) => u.id === drag.unitId) : undefined
  if (drag) {
    for (let i = 0; i < lvl.slots.length; i++) {
      const occ = unitAt(s, i)
      let color: string | null = null
      if (!occ) color = drag.kind === 'shop' && s.gold < UNIT_DEFS[drag.type].price ? null : 'rgba(120,255,160,0.4)'
      else if (dragUnit && canMerge(dragUnit, occ)) color = 'rgba(255,215,80,0.55)'
      if (!color) continue
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(lvl.slots[i].x, lvl.slots[i].y + 6, SLOT_R, SLOT_R * 0.7, 0, 0, Math.PI * 2); ctx.fill()
    }
  }
  const focus = dragUnit ?? (view.selected !== null ? s.units.find((u) => u.id === view.selected) : undefined)
  const hoverSlot = drag ? slotAt(drag.x, drag.y, lvl.slots) : null
  if (drag && hoverSlot !== null) {
    const ghost: Unit = dragUnit ?? { id: -1, type: drag.type, level: 1, evo: 'none', slot: hoverSlot, cooldown: 0 }
    const c = lvl.slots[hoverSlot]
    ctx.fillStyle = `${UNIT_DEFS[ghost.type].color}22`; ctx.strokeStyle = `${UNIT_DEFS[ghost.type].color}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, unitRange(ghost), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  } else if (focus) {
    const c = lvl.slots[focus.slot]
    ctx.fillStyle = `${UNIT_DEFS[focus.type].color}22`; ctx.strokeStyle = `${UNIT_DEFS[focus.type].color}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, unitRange(focus), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // units (sorted by y for overlap), then snake, then shots on top
  const sorted = [...s.units].sort((a, b) => lvl.slots[a.slot].y - lvl.slots[b.slot].y)
  for (const u of sorted) {
    const c = lvl.slots[u.slot]
    const isDragged = dragUnit?.id === u.id
    drawUnit(ctx, u, c.x, c.y - 6, 78, time, view.unitSkin, isDragged ? 0.3 : 1)
    if (!isDragged) {
      ctx.fillStyle = u.evo === 'risky' ? '#ff4d6d' : u.evo === 'safe' ? '#8d5bff' : u.level >= 3 ? '#e0a200' : '#2f5fbf'
      ctx.beginPath(); ctx.arc(c.x + 18, c.y + 16, 10, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      text(ctx, String(u.level), c.x + 18, c.y + 17, 12, '#fff', 'center', false)
    }
  }
  drawSnake(ctx, s, lvl, time, SNAKE_SKINS[view.snakeSkin] ?? SNAKE_SKINS['snake:stone'])
  drawShots(ctx, s, time)
  // castle over the top-right corner (spawn + gate): the worm burrows under it
  drawImage(ctx, A.castle, lvl.spawn.x + 6, lvl.spawn.y + 12, 92, 74)
  for (const p of s.fx.popups) { ctx.globalAlpha = Math.min(1, p.t / 0.3); text(ctx, p.text, p.x, p.y, 14, p.color); ctx.globalAlpha = 1 }
  if (focus && !drag) {
    const def = UNIT_DEFS[focus.type]
    const c: Vec = lvl.slots[focus.slot]
    const label = `${def.name} ур.${focus.level}  ⚔${unitDamage(focus)}  ${def.desc}`
    ctx.font = `700 12px ${FONT}`
    const tw = ctx.measureText(label).width + 16
    const bx = Math.min(Math.max(c.x - tw / 2, 6), W - tw - 6), by = c.y - 58
    ctx.fillStyle = 'rgba(15,17,28,0.9)'; roundRect(ctx, { x: bx, y: by, w: tw, h: 24 }, 8); ctx.fill()
    text(ctx, label, bx + tw / 2, by + 12, 12, '#fff', 'center', false)
  }
  if (s.units.length === 0 && s.phase === 'ready' && !drag) {
    text(ctx, 'Тяни бойца из лагеря на позицию ↓', W / 2, BOARD_H / 2, 16, '#fff')
    text(ctx, 'Два одинаковых — слияние, уровень выше', W / 2, BOARD_H / 2 + 26, 13, '#eaf5ff')
  }
  ctx.restore()

  drawShop(ctx, s, view, time)
  if (drag) {
    const ghost: Unit = dragUnit ?? { id: -1, type: drag.type, level: 1, evo: 'none', slot: -1, cooldown: 0 }
    drawUnit(ctx, ghost, drag.x, drag.y - 34, 84, time, view.unitSkin, 0.9)
  }
  if (view.toast) { ctx.globalAlpha = Math.min(1, view.toast.t); text(ctx, view.toast.text, W / 2, HUD_H + BOARD_H - 30, 16, '#ffd54a'); ctx.globalAlpha = 1 }
}
