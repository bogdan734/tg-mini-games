import { assetUrl, drawFrame, drawImage, drawNineSlice, drawThreeSlice, sheet, tilePattern, type Sheet } from '../../../lib/atlas'
import { BOSS_INFO, bossForWave } from '../engine/boss'
import { maxWave, unitAt } from '../engine/game'
import { BOARD_H, BOARD_W, PATH_WIDTH, SLOT_R } from '../engine/layout'
import { getLevel, type LevelDef } from '../engine/levels'
import { pointAt } from '../engine/path'
import { segmentD, segmentPos } from '../engine/snake'
import type { Flask, GameState, Shot, Unit, Vec } from '../engine/types'
import { canMerge, EVO_INFO, EVO_LEVEL, MAX_LEVEL, swordDamage, unitDps, unitRange } from '../engine/units'

export const HUD_H = 48
export const PANEL_H = 150
export const W = BOARD_W
export const H = HUD_H + BOARD_H + PANEL_H
export const PANEL_Y = HUD_H + BOARD_H
export const FONT = 'Fredoka, -apple-system, sans-serif'

export interface Rect { x: number; y: number; w: number; h: number }
export interface DragState { unitId: number; x: number; y: number; moved: boolean }
export interface ViewState {
  drag: DragState | null
  selected: number | null
  toast: { text: string; t: number } | null
  muted: boolean
  unitSkin: string
  snakeSkin: string
}

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
export const waveButtonRect = (): Rect => ({ x: 218, y: 6, w: 112, h: 36 })
export const muteRect = (): Rect => ({ x: W - 48, y: 6, w: 40, h: 36 })

export function slotAt(x: number, y: number, slots: Vec[]): number | null {
  const by = y - HUD_H
  for (let i = 0; i < slots.length; i++) if (Math.hypot(slots[i].x - x, slots[i].y - by) <= SLOT_R + 10) return i
  return null
}

// ---------------------------------------------------------------- assets
type Color = 'blue' | 'yellow' | 'purple' | 'red'
const COLORS: Color[] = ['blue', 'yellow', 'purple', 'red']
const warriorSheets: Partial<Record<Color, Sheet>> = {}
const warrior = (c: Color): Sheet => (warriorSheets[c] ??= sheet(assetUrl(`troops/warrior_${c}.png`), 192, 192))
const A = {
  flat: sheet(assetUrl('terrain/flat.png'), 64, 64),
  water: sheet(assetUrl('terrain/water.png'), 64, 64),
  foam: sheet(assetUrl('terrain/foam.png'), 192, 192),
  shadow: sheet(assetUrl('terrain/shadows.png'), 192, 192),
  castle: sheet(assetUrl('buildings/castle_blue.png'), 320, 256),
  deco: [1, 2, 6, 7, 10, 11, 14, 15].map((n) => sheet(assetUrl(`deco/deco_${String(n).padStart(2, '0')}.png`), 64, 64)),
  carved: sheet(assetUrl('ui/Carved_9Slides.png'), 64, 64),
  btnBlue: sheet(assetUrl('ui/Button_Blue_3Slides.png'), 64, 64),
  btnRed: sheet(assetUrl('ui/Button_Red_3Slides.png'), 64, 64),
  ribbon: sheet(assetUrl('ui/Ribbon_Blue_3Slides.png'), 64, 64),
  iconSwords: sheet(assetUrl('ui/Regular_01.png'), 64, 64),
  explosion: sheet(assetUrl('effects/explosions.png'), 192, 192),
}
export function preloadSnakeAssets(): void { for (const c of COLORS) warrior(c) }

// ---------------------------------------------------------------- animation
type AnimName = 'idle' | 'attackR' | 'attackD' | 'attackU'
const ANIMS: Record<AnimName, { row: number; n: number }> = { idle: { row: 0, n: 6 }, attackR: { row: 2, n: 6 }, attackD: { row: 4, n: 6 }, attackU: { row: 6, n: 6 } }
interface UnitAnim { name: AnimName; t: number; dur: number; flip: boolean }
const anims = new Map<number, UnitAnim>()
const seenShots = new WeakSet<Shot>()

function colorFor(u: Unit, skin: string): Color {
  if (skin === 'units:cute') return 'yellow'
  if (skin === 'units:villains') return 'purple'
  if (skin === 'units:gold') return 'red'
  if (u.evo === 'risky') return 'red'
  if (u.evo === 'safe') return 'purple'
  return u.level >= 3 ? 'yellow' : 'blue'
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', stroke = true, strokeColor = 'rgba(0,0,0,0.55)') {
  ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'
  if (stroke) { ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y) }
  ctx.fillStyle = color; ctx.fillText(str, x, y)
}

/** A small pixel-style sword pointing along +x (tip at +len/2). */
function drawSword(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number, glow: string, alpha = 1) {
  ctx.save()
  ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha
  const h = len * 0.5
  ctx.shadowColor = glow; ctx.shadowBlur = 8
  ctx.fillStyle = '#dfe7f2'; ctx.beginPath(); ctx.moveTo(h, 0); ctx.lineTo(h - 5, -3); ctx.lineTo(-h * 0.35, -3); ctx.lineTo(-h * 0.35, 3); ctx.lineTo(h - 5, 3); ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#8f9bb3'; ctx.fillRect(-h * 0.35, -1, h + 5 - h * 0.35 - 5, 2)
  ctx.fillStyle = '#c98a12'; ctx.fillRect(-h * 0.42, -5, 4, 10)
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-h * 0.42 - 7, -2, 7, 4)
  ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(-h * 0.42 - 8, 0, 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawUnit(ctx: CanvasRenderingContext2D, s: GameState, u: Unit, x: number, y: number, size: number, time: number, skin: string, alpha = 1) {
  const sh = warrior(colorFor(u, skin))
  let an = anims.get(u.id)
  if (an && time - an.t > an.dur) { anims.delete(u.id); an = undefined }
  const spec = an ? ANIMS[an.name] : ANIMS.idle
  const frame = an ? Math.min(spec.n - 1, Math.floor(((time - an.t) / an.dur) * spec.n)) : Math.floor(time * 8 + u.id) % spec.n
  drawImage(ctx, A.shadow, x, y + size * 0.34, size * 0.9, size * 0.5, 0.9 * alpha)
  drawFrame(ctx, sh, frame, spec.row, x, y, size, size, an?.flip ?? false, alpha)
  // orbiting swords (the ones currently in flight are drawn by drawShots)
  const flying = new Set(s.fx.shots.filter((sh2) => sh2.unitId === u.id).map((sh2) => sh2.sword))
  const glow = u.evo === 'risky' ? '#ff6b6b' : u.evo === 'safe' ? '#c9a8ff' : u.level >= 3 ? '#ffe08a' : '#9fd4ff'
  const orbit = 26 + u.level * 2
  for (let k = 0; k < u.swords.length; k++) {
    if (flying.has(k)) continue
    const ph = u.swords[k].phase
    const sx = x + Math.cos(ph) * orbit, sy = y + 6 + Math.sin(ph) * orbit * 0.55
    drawSword(ctx, sx, sy, ph + Math.PI / 2, 22, glow, alpha)
  }
}

function drawFlask(ctx: CanvasRenderingContext2D, f: Flask, c: Vec, time: number) {
  const wob = Math.sin(time * 5 + f.id) * 2
  const ratio = f.hp / f.maxHp
  const y = c.y - 6
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 18, 18, 7, 0, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.translate(c.x, y); ctx.rotate(wob * 0.02)
  // body
  ctx.fillStyle = 'rgba(200,235,255,0.55)'; ctx.strokeStyle = '#6fa8d6'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-6, -8); ctx.bezierCurveTo(-20, -2, -20, 20, 0, 22); ctx.bezierCurveTo(20, 20, 20, -2, 6, -8); ctx.lineTo(6, -22); ctx.closePath(); ctx.fill(); ctx.stroke()
  // liquid (glowing blue, level = hp)
  ctx.save(); ctx.clip()
  const top = 22 - 30 * ratio
  const g = ctx.createLinearGradient(0, top, 0, 22); g.addColorStop(0, '#7fd4ff'); g.addColorStop(1, '#2f78c2')
  ctx.fillStyle = g; ctx.fillRect(-20, top, 40, 30)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(0, top + 1, 14, 3, 0, 0, Math.PI * 2); ctx.fill()
  for (let i = 0; i < 3; i++) { const bx = -8 + i * 8, by = 18 - ((time * 30 + i * 13 + f.id * 7) % 26); if (by > top) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill() } }
  ctx.restore()
  // cork + shine
  ctx.fillStyle = '#a8703a'; ctx.fillRect(-7, -27, 14, 7)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-8, 2, 3, 9, 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // hp pips
  for (let i = 0; i < f.maxHp; i++) {
    ctx.fillStyle = i < f.hp ? '#7fd4ff' : 'rgba(0,0,0,0.35)'
    ctx.beginPath(); ctx.arc(c.x - (f.maxHp - 1) * 4 + i * 8, c.y + 30, 3, 0, Math.PI * 2); ctx.fill()
  }
  // sword glyph hint
  text(ctx, '⚔', c.x + 20, y - 22 + wob, 12, '#fff')
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
  const grass = tilePattern(g, A.flat, 1, 1, 1)
  g.fillStyle = grass ?? pal.bg1
  g.beginPath(); g.roundRect(0, -20, BOARD_W, BOARD_H + 20 - 6, 18); g.fill()
  g.fillStyle = pal.bg2; g.globalAlpha = lvl.id === 1 ? 0 : 0.35; g.fillRect(0, 0, BOARD_W, BOARD_H); g.globalAlpha = 1
  // cliff edge along the bottom
  g.fillStyle = 'rgba(60,40,20,0.55)'; g.fillRect(0, BOARD_H - 8, BOARD_W, 8)
  const P = lvl.path
  const road = () => { g.beginPath(); g.moveTo(P.pts[0].x, P.pts[0].y); for (const p of P.pts) g.lineTo(p.x, p.y); g.stroke() }
  const link = () => { g.beginPath(); g.moveTo(lvl.gate.x, lvl.gate.y); g.lineTo(lvl.spawn.x, lvl.spawn.y); g.stroke() }
  g.lineCap = 'round'; g.lineJoin = 'round'
  g.strokeStyle = 'rgba(70,45,20,0.55)'; g.lineWidth = PATH_WIDTH + 8; road(); link()
  const sand = tilePattern(g, A.flat, 6, 1, 1)
  g.strokeStyle = sand ?? pal.road; g.lineWidth = PATH_WIDTH; road(); link()
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.setLineDash([6, 10]); road(); g.setLineDash([])
  for (const s of lvl.slots) {
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(s.x, s.y + 14, SLOT_R - 2, SLOT_R * 0.45, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.arc(s.x, s.y + 4, SLOT_R - 4, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
  }
  let seed = 3 + lvl.id
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (const sp of [{ x: 16, y: 16 }, { x: 16, y: BOARD_H - 22 }, { x: BOARD_W - 16, y: BOARD_H - 22 }, { x: BOARD_W / 2, y: BOARD_H - 18 }]) {
    const d = A.deco[Math.floor(r() * A.deco.length)]
    if (d.ready) g.drawImage(d.img, sp.x - 14, sp.y - 14, 28, 28)
  }
  fieldCache.set(lvl.id, c)
  return c
}

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
  for (let i = 0; i <= 7; i++) { const a = (i / 7) * Math.PI * 2, wob = 1 + 0.08 * Math.sin(seed + i * 2.3); const px = x + Math.cos(a) * r * wob, py = y + Math.sin(a) * r * wob * 0.92; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) }
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
    const top = seg.slow > 0 ? '#e6f4ff' : seg.head ? skin.head[0] : skin.body[0]
    const bottom = seg.slow > 0 ? '#4f8fd6' : seg.head ? (s.boss.kind === 'king' ? '#b0642a' : s.boss.kind !== 'none' ? '#7a3f8f' : skin.head[1]) : skin.bodyDark(hpRatio)
    boulder(ctx, p.x, p.y, r, top, bottom, skin.outline, skin.crack, seg.id)
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.55 * flash})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill() }
    if (seg.head) {
      const a = p.angle, ex = Math.cos(a), ey = Math.sin(a), nx = -ey, ny = ex
      ctx.fillStyle = skin.outline
      for (const side of [-1, 1]) {
        const bx = p.x - ex * r * 0.5 + nx * r * 0.7 * side, by = p.y - ey * r * 0.5 + ny * r * 0.7 * side
        ctx.beginPath(); ctx.moveTo(bx - nx * 4 * side, by - ny * 4 * side); ctx.lineTo(bx - ex * 12 + nx * 6 * side, by - ey * 12 + ny * 6 * side); ctx.lineTo(bx + nx * 4 * side, by + ny * 4 * side); ctx.fill()
      }
      ctx.fillStyle = 'rgba(40,20,30,0.85)'; ctx.beginPath(); ctx.ellipse(p.x + ex * r * 0.45, p.y + ey * r * 0.45, r * 0.55, r * 0.32, a, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'
      for (let k = -1; k <= 1; k++) { const tx = p.x + ex * r * 0.35 + nx * k * r * 0.28, ty = p.y + ey * r * 0.35 + ny * k * r * 0.28; ctx.beginPath(); ctx.moveTo(tx - nx * 3, ty - ny * 3); ctx.lineTo(tx + ex * 7, ty + ey * 7); ctx.lineTo(tx + nx * 3, ty + ny * 3); ctx.fill() }
      for (const side of [-1, 1]) {
        const cx = p.x + ex * r * 0.05 + nx * r * 0.42 * side, cy = p.y + ey * r * 0.05 + ny * r * 0.42 * side
        const eg = ctx.createRadialGradient(cx, cy, 1, cx, cy, 6); eg.addColorStop(0, '#fff6a8'); eg.addColorStop(0.5, '#ff5a2a'); eg.addColorStop(1, 'rgba(255,60,20,0)')
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()
      }
      if (s.boss.shield > 0) { ctx.strokeStyle = 'rgba(120,180,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke() }
      if (s.boss.dashT > 0) { ctx.strokeStyle = 'rgba(255,200,80,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2); ctx.stroke() }
      const bob = Math.sin(time * 6) * 1.5
      const info = BOSS_INFO[s.boss.kind]
      if (info.name) text(ctx, info.name, p.x, p.y - r - 28 + bob, 12, '#ffd54a')
      text(ctx, String(Math.ceil(seg.hp)), p.x, p.y - r - 13 + bob, 15, '#fff')
    } else text(ctx, String(Math.ceil(seg.hp)), p.x, p.y + 1, 12, '#fff')
  }
}

// ---------------------------------------------------------------- shots
function drawShots(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const sh of s.fx.shots) {
    const u = s.units.find((x) => x.id === sh.unitId)
    if (!seenShots.has(sh)) {
      seenShots.add(sh)
      if (u) {
        const dx = sh.to.x - sh.from.x, dy = sh.to.y - sh.from.y
        const name: AnimName = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'attackU' : 'attackD') : 'attackR'
        anims.set(u.id, { name, t: time, dur: 0.36, flip: name === 'attackR' && dx < 0 })
      }
    }
    const glow = u?.evo === 'risky' ? '#ff6b6b' : u?.evo === 'safe' ? '#c9a8ff' : (u?.level ?? 1) >= 3 ? '#ffe08a' : '#9fd4ff'
    const k = sh.t / sh.dur // 0..1: out 0..0.45, strike 0.45..0.6, back 0.6..1
    const out = k < 0.45 ? k / 0.45 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
    const e = out < 1 ? 1 - Math.pow(1 - out, 2) : 1
    const x = sh.from.x + (sh.to.x - sh.from.x) * e, y = sh.from.y + (sh.to.y - sh.from.y) * e - Math.sin(e * Math.PI) * 14
    const ang = Math.atan2(sh.to.y - sh.from.y, sh.to.x - sh.from.x) + (k < 0.6 ? 0 : Math.PI)
    // trail
    ctx.strokeStyle = glow; ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 14, y - Math.sin(ang) * 14); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha = 1
    drawSword(ctx, x, y, ang + (k >= 0.45 && k < 0.6 ? Math.sin((k - 0.45) / 0.15 * Math.PI) * 1.2 : 0), 24, glow)
    if (k >= 0.45 && k < 0.62) { // slash crescent at impact
      const q = (k - 0.45) / 0.17
      ctx.save(); ctx.translate(sh.to.x, sh.to.y); ctx.rotate(ang)
      ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 5 - q * 3; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(-6, 0, 16 + q * 12, -1.2, 1.2); ctx.stroke()
      ctx.strokeStyle = glow; ctx.globalAlpha = 0.8 - q * 0.8; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(-6, 0, 22 + q * 14, -1.0, 1.0); ctx.stroke(); ctx.globalAlpha = 1
      ctx.restore()
    }
  }
  for (const p of s.fx.parts) { ctx.globalAlpha = Math.min(1, p.t / 0.3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- panel & hud
function drawPanel(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, PANEL_Y, W, PANEL_H)
  drawNineSlice(ctx, A.carved, 4, PANEL_Y + 4, W - 8, PANEL_H - 8, 18)
  const sel = view.selected !== null ? s.units.find((u) => u.id === view.selected) : undefined
  const y0 = PANEL_Y + 24
  if (sel) {
    const evo = sel.evo !== 'none' ? EVO_INFO[sel.evo] : null
    drawUnit(ctx, s, sel, 44, y0 + 30, 70, time, view.unitSkin)
    text(ctx, evo ? `${evo.name} · ${sel.level} мечей` : `Мечник · ${sel.level} ${sel.level === 1 ? 'меч' : sel.level < 5 ? 'меча' : 'мечей'}`, 92, y0 - 2, 14, '#3a2a12', 'left', false)
    text(ctx, `⚔ ${swordDamage(sel)} за удар · ${unitDps(sel)} в секунду · радиус ${unitRange(sel)}`, 92, y0 + 18, 12, '#6b5636', 'left', false)
    const next = sel.evo === 'none' && sel.level < MAX_LEVEL ? `Слей с таким же → ${sel.level + 1} ${sel.level + 1 >= EVO_LEVEL ? 'мечей и эволюция' : 'меча'}` : sel.evo === 'none' ? 'Готов к эволюции' : evo!.desc
    text(ctx, next, 92, y0 + 38, 12, '#1f5fbf', 'left', false)
    const near = s.units.filter((u) => u.id !== sel.id && canMerge(u, sel)).length
    text(ctx, near ? `На поле ${near} подход${near === 1 ? 'ит' : 'ят'} для слияния` : 'Пары для слияния пока нет', 92, y0 + 58, 12, near ? '#2a7a3a' : '#8a7a5a', 'left', false)
    text(ctx, 'Тяни бойца на такого же · тап по колбе — удар', W / 2, PANEL_Y + PANEL_H - 22, 11, '#8a7a5a', 'center', false)
    return
  }
  // codex: sword ladder + evolution paths + next wave
  const kind = bossForWave(s.wave, maxWave(s) === Infinity)
  const boss = BOSS_INFO[kind]
  text(ctx, boss.name ? `Волна ${s.wave}: ${boss.name} — ${boss.desc}` : `Волна ${s.wave}${maxWave(s) === Infinity ? '' : ` из ${maxWave(s)}`}`, W / 2, y0 - 4, 13, '#3a2a12', 'center', false)
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const x = 34 + (l - 1) * 58
    const have = s.units.filter((u) => u.level === l && u.evo === 'none').length
    for (let k = 0; k < l; k++) drawSword(ctx, x - (l - 1) * 5 + k * 10, y0 + 24, -Math.PI / 2, 18, l >= 3 ? '#ffe08a' : '#9fd4ff', have ? 1 : 0.35)
    text(ctx, `ур.${l}${have ? ` ×${have}` : ''}`, x, y0 + 46, 11, have ? '#1f5fbf' : '#8a7a5a', 'center', false)
  }
  text(ctx, `Колбы падают каждые ${Math.max(2, Math.round((2 + s.wave) / s.flaskMul))} убийства — разбивай их, выходят мечники`, W / 2, y0 + 70, 11, '#6b5636', 'center', false)
  text(ctx, `5 мечей → эволюция: ${EVO_INFO.safe.name} (×2) или ${EVO_INFO.risky.name} (×3.5, риск)`, W / 2, y0 + 88, 11, '#6b5636', 'center', false)
}

function miniFlask(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save(); ctx.translate(x, y)
  ctx.fillStyle = '#7fd4ff'; ctx.strokeStyle = '#2f5f8f'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-3, -3); ctx.bezierCurveTo(-9, 0, -9, 9, 0, 10); ctx.bezierCurveTo(9, 9, 9, 0, 3, -3); ctx.lineTo(3, -9); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#a8703a'; ctx.fillRect(-4, -12, 8, 4)
  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, 0, W, HUD_H)
  drawNineSlice(ctx, A.carved, 4, 2, W - 8, HUD_H - 4, 14)
  text(ctx, `❤️ ${s.lives}`, 14, HUD_H / 2, 16, '#3a2a12', 'left', false)
  miniFlask(ctx, 82, HUD_H / 2)
  text(ctx, `${s.flasks.length}`, 94, HUD_H / 2, 15, '#3a2a12', 'left', false)
  const mw = maxWave(s)
  text(ctx, mw === Infinity ? `Волна ${s.wave}` : `Волна ${Math.min(s.wave, mw)}/${mw}`, 120, HUD_H / 2, 13, '#5a4a2a', 'left', false)
  if (s.phase === 'ready') {
    const r = waveButtonRect()
    drawThreeSlice(ctx, A.btnBlue, r.x, r.y, r.w, r.h, 16)
    text(ctx, `▶ Волна ${s.wave}`, r.x + r.w / 2, r.y + r.h / 2 - 1, 14, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
  } else text(ctx, `${s.score} очк.`, 208, HUD_H / 2, 13, '#5a4a2a', 'left', false)
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
  // water only around the sides and bottom; the island is flush with the HUD
  const water = tilePattern(ctx, A.water, 0, 0, 1)
  ctx.fillStyle = water ?? '#3f8fbf'; ctx.fillRect(-10, 0, W + 20, BOARD_H + 20)
  if (A.foam.ready) {
    const fr = Math.floor(time * 8) % 8
    for (let x = 20; x < W; x += 60) drawFrame(ctx, A.foam, (fr + 3) % 8, 0, x + 30, BOARD_H - 4, 90, 90, false, 0.9)
    for (let y = 40; y < BOARD_H; y += 60) { drawFrame(ctx, A.foam, (fr + 5) % 8, 0, 2, y, 90, 90, false, 0.9); drawFrame(ctx, A.foam, (fr + 1) % 8, 0, W - 2, y + 30, 90, 90, false, 0.9) }
  }
  const field = fieldLayer(lvl)
  if (field) ctx.drawImage(field, 0, 0); else { ctx.fillStyle = lvl.palette.bg1; ctx.fillRect(0, 0, W, BOARD_H) }

  const drag = view.drag
  const dragUnit = drag ? s.units.find((u) => u.id === drag.unitId) : undefined
  if (dragUnit) {
    for (let i = 0; i < lvl.slots.length; i++) {
      const occ = unitAt(s, i)
      let color: string | null = null
      if (!occ && !s.flasks.some((f) => f.slot === i)) color = 'rgba(120,255,160,0.4)'
      else if (occ && canMerge(dragUnit, occ)) color = 'rgba(255,215,80,0.6)'
      if (!color) continue
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(lvl.slots[i].x, lvl.slots[i].y + 6, SLOT_R, SLOT_R * 0.7, 0, 0, Math.PI * 2); ctx.fill()
    }
  }
  const focus = dragUnit ?? (view.selected !== null ? s.units.find((u) => u.id === view.selected) : undefined)
  const hoverSlot = drag ? slotAt(drag.x, drag.y, lvl.slots) : null
  if (focus) {
    const c = hoverSlot !== null && dragUnit ? lvl.slots[hoverSlot] : lvl.slots[focus.slot]
    ctx.fillStyle = 'rgba(159,212,255,0.12)'; ctx.strokeStyle = 'rgba(159,212,255,0.55)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, unitRange(focus), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  for (const f of s.flasks) drawFlask(ctx, f, lvl.slots[f.slot], time)
  const sorted = [...s.units].sort((a, b) => lvl.slots[a.slot].y - lvl.slots[b.slot].y)
  for (const u of sorted) {
    const c = lvl.slots[u.slot]
    const isDragged = dragUnit?.id === u.id
    drawUnit(ctx, s, u, c.x, c.y - 6, 78, time, view.unitSkin, isDragged ? 0.3 : 1)
    if (!isDragged) {
      ctx.fillStyle = u.evo === 'risky' ? '#ff4d6d' : u.evo === 'safe' ? '#8d5bff' : u.level >= 3 ? '#e0a200' : '#2f5fbf'
      ctx.beginPath(); ctx.arc(c.x + 20, c.y + 18, 10, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      text(ctx, String(u.level), c.x + 20, c.y + 19, 12, '#fff', 'center', false)
    }
  }
  drawSnake(ctx, s, lvl, time, SNAKE_SKINS[view.snakeSkin] ?? SNAKE_SKINS['snake:stone'])
  drawShots(ctx, s, time)
  drawImage(ctx, A.castle, lvl.spawn.x + 6, lvl.spawn.y + 12, 92, 74)
  for (const p of s.fx.popups) { ctx.globalAlpha = Math.min(1, p.t / 0.3); text(ctx, p.text, p.x, p.y, 14, p.color); ctx.globalAlpha = 1 }
  if (s.units.length <= 1 && s.flasks.length > 0 && s.phase === 'ready' && !drag && s.wave === 1) {
    const f = lvl.slots[s.flasks[0].slot]
    text(ctx, 'Тапай по колбе или жди удара мечом', f.x, f.y - 56, 13, '#fff')
  }
  ctx.restore()
  drawPanel(ctx, s, view, time)
  if (dragUnit) drawUnit(ctx, s, dragUnit, drag!.x, drag!.y - 34, 84, time, view.unitSkin, 0.9)
  if (view.toast) { ctx.globalAlpha = Math.min(1, view.toast.t); text(ctx, view.toast.text, W / 2, HUD_H + BOARD_H - 30, 16, '#ffd54a'); ctx.globalAlpha = 1 }
}
