import { MAX_WAVE, sellValue, unitAt } from '../engine/game'
import { BOARD_H, BOARD_W, GATE, PATH, PATH_WIDTH, SLOTS, SLOT_R, SPAWN } from '../engine/layout'
import { pointAt } from '../engine/path'
import { segmentD, segmentPos } from '../engine/snake'
import type { GameState, Unit, UnitType, Vec } from '../engine/types'
import { canMerge, UNIT_DEFS, unitDamage, unitRange, unitTier } from '../engine/units'
import type { Sprites } from './sprites'

export const HUD_H = 48
export const SHOP_H = 150
export const W = BOARD_W
export const H = HUD_H + BOARD_H + SHOP_H
export const SHOP_Y = HUD_H + BOARD_H
export const FONT = 'Fredoka, -apple-system, sans-serif'

export interface Rect { x: number; y: number; w: number; h: number }
export interface DragState {
  kind: 'shop' | 'unit'
  shopIdx: number
  unitId: number
  type: UnitType
  x: number
  y: number
  moved: boolean
}
export interface ViewState { drag: DragState | null; selected: number | null; toast: { text: string; t: number } | null }

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
export const shopCardRect = (i: number): Rect => ({ x: 10 + i * 94, y: SHOP_Y + 14, w: 86, h: 122 })
export const waveButtonRect = (): Rect => ({ x: W - 122, y: 7, w: 114, h: 34 })
export const sellZoneRect = (): Rect => ({ x: 10, y: SHOP_Y + 14, w: W - 20, h: 122 })

/** Slot index under a point given in canvas coords, or null. */
export function slotAt(x: number, y: number): number | null {
  const by = y - HUD_H
  for (let i = 0; i < SLOTS.length; i++) {
    const s = SLOTS[i]
    if (Math.hypot(s.x - x, s.y - by) <= SLOT_R + 10) return i
  }
  return null
}

let fieldCache: HTMLCanvasElement | null = null
function fieldLayer(): HTMLCanvasElement {
  if (fieldCache) return fieldCache
  const c = document.createElement('canvas')
  c.width = BOARD_W
  c.height = BOARD_H
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, BOARD_H)
  grad.addColorStop(0, '#3f9a4d')
  grad.addColorStop(1, '#2f7a3d')
  g.fillStyle = grad
  g.fillRect(0, 0, BOARD_W, BOARD_H)
  // grass tufts
  g.strokeStyle = 'rgba(255,255,255,0.10)'
  g.lineWidth = 2
  let seed = 7
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (let i = 0; i < 160; i++) {
    const x = r() * BOARD_W, y = r() * BOARD_H
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 7); g.moveTo(x, y); g.lineTo(x + 3, y - 6); g.stroke()
  }
  // road
  g.lineCap = 'round'; g.lineJoin = 'round'
  const road = () => { g.beginPath(); g.moveTo(PATH.pts[0].x, PATH.pts[0].y); for (const p of PATH.pts) g.lineTo(p.x, p.y); g.stroke() }
  const link = () => { g.beginPath(); g.moveTo(GATE.x, GATE.y); g.lineTo(SPAWN.x, SPAWN.y); g.stroke() }
  g.strokeStyle = '#8a6b3e'; g.lineWidth = PATH_WIDTH + 8; road(); link()
  g.strokeStyle = '#d9b877'; g.lineWidth = PATH_WIDTH; road(); link()
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([6, 10]); road(); g.setLineDash([])
  // spawn portal
  g.fillStyle = '#2b1e3f'; g.beginPath(); g.arc(SPAWN.x, SPAWN.y, 22, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#a56cff'; g.lineWidth = 4; g.beginPath(); g.arc(SPAWN.x, SPAWN.y, 16, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = '#d9b3ff'; g.lineWidth = 2; g.beginPath(); g.arc(SPAWN.x, SPAWN.y, 9, 0, Math.PI * 1.5); g.stroke()
  // gate: a portcullis across the road, snake enters it going up
  g.fillStyle = '#1f7a3a'; g.fillRect(GATE.x - 26, GATE.y - 16, 52, 30)
  g.fillStyle = '#39c26a'; g.fillRect(GATE.x - 22, GATE.y - 12, 44, 22)
  g.fillStyle = '#1f7a3a'
  for (let i = 0; i < 5; i++) g.fillRect(GATE.x - 20 + i * 10, GATE.y - 12, 3, 22)
  g.fillStyle = '#ffd54a'; g.font = `700 12px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('БАЗА', GATE.x, GATE.y - 24)
  // slots
  for (const s of SLOTS) {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(s.x, s.y + 2, SLOT_R, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(s.x, s.y, SLOT_R, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.setLineDash([4, 5]); g.beginPath(); g.arc(s.x, s.y, SLOT_R - 3, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
  }
  fieldCache = c
  return c
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', stroke = true) {
  ctx.font = `700 ${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (stroke) { ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y) }
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, radius)
}

function drawUnitSprite(ctx: CanvasRenderingContext2D, sprites: Sprites, u: Unit, x: number, y: number, size: number, alpha = 1) {
  const img = sprites[`${u.type}_${unitTier(u)}`]
  ctx.globalAlpha = alpha
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
  else { ctx.fillStyle = UNIT_DEFS[u.type].color; ctx.beginPath(); ctx.arc(x, y, size / 2.4, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
}

function drawLevelBadge(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number) {
  ctx.fillStyle = u.evo === 'risky' ? '#ff4d6d' : u.evo === 'safe' ? '#5b8cff' : '#222a3a'
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, String(u.level), x, y + 1, 13, '#fff', 'center', false)
}

function drawSnake(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (let i = s.snake.length - 1; i >= 0; i--) {
    const seg = s.snake[i]
    if (segmentD(s, i) < -5) continue
    const p = pointAt(PATH, segmentPos(s, i))
    const r = seg.head ? 21 : 14
    const hpRatio = Math.max(0, seg.hp) / seg.maxHp
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(p.x + 2, p.y + 4, r, 0, Math.PI * 2); ctx.fill()
    const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.2, p.x, p.y, r)
    if (seg.poison > 0) { grad.addColorStop(0, '#b6f2c9'); grad.addColorStop(1, '#3d9a5c') }
    else if (seg.slow > 0) { grad.addColorStop(0, '#dbeeff'); grad.addColorStop(1, '#5aa0e0') }
    else if (seg.head) { grad.addColorStop(0, '#c9d2e3'); grad.addColorStop(1, '#6b7590') }
    else { grad.addColorStop(0, '#d8dfeb'); grad.addColorStop(1, `hsl(220, 20%, ${40 + hpRatio * 25}%)`) }
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#3a4258'; ctx.lineWidth = 2.5; ctx.stroke()
    if (seg.head) {
      // eyes and fangs facing along the path
      const a = p.angle
      const ex = Math.cos(a), ey = Math.sin(a)
      const nx = -ey, ny = ex
      for (const side of [-1, 1]) {
        const cx = p.x + ex * 6 + nx * 8 * side, cy = p.y + ey * 6 + ny * 8 * side
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(cx + ex * 1.5, cy + ey * 1.5, 2.6, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#fff'
      for (const side of [-1, 1]) {
        const bx = p.x + ex * 14 + nx * 6 * side, by = p.y + ey * 14 + ny * 6 * side
        ctx.beginPath(); ctx.moveTo(bx - nx * 3 * side, by - ny * 3 * side); ctx.lineTo(bx + ex * 8, by + ey * 8); ctx.lineTo(bx + nx * 3 * side, by + ny * 3 * side); ctx.fill()
      }
      const bob = Math.sin(time * 6) * 1.5
      text(ctx, String(Math.ceil(seg.hp)), p.x, p.y - r - 12 + bob, 15, '#fff')
    } else {
      text(ctx, String(Math.ceil(seg.hp)), p.x, p.y + 1, 13, '#fff')
    }
  }
}

function drawShop(ctx: CanvasRenderingContext2D, s: GameState, sprites: Sprites, view: ViewState) {
  ctx.fillStyle = '#1b1e2b'
  ctx.fillRect(0, SHOP_Y, W, SHOP_H)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, SHOP_Y, W, 2)
  if (view.drag?.kind === 'unit') {
    const u = s.units.find((x) => x.id === view.drag!.unitId)
    const r = sellZoneRect()
    ctx.fillStyle = 'rgba(255,80,80,0.15)'; roundRect(ctx, r, 16); ctx.fill()
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([])
    text(ctx, `Продать за ${u ? sellValue(u) : 0} 💰`, W / 2, r.y + r.h / 2, 20, '#ffb3b3')
    return
  }
  for (let i = 0; i < 3; i++) {
    const r = shopCardRect(i)
    const type = s.shop[i]
    ctx.fillStyle = '#262b3d'; roundRect(ctx, r, 14); ctx.fill()
    if (!type) { text(ctx, 'куплено', r.x + r.w / 2, r.y + r.h / 2, 14, '#6d7390'); continue }
    const def = UNIT_DEFS[type]
    const affordable = s.gold >= def.price
    ctx.strokeStyle = affordable ? def.color : '#3a3f55'; ctx.lineWidth = 2; ctx.stroke()
    const dragging = view.drag?.kind === 'shop' && view.drag.shopIdx === i
    const ghost: Unit = { id: -1, type, level: 1, evo: 'none', slot: -1, cooldown: 0 }
    drawUnitSprite(ctx, sprites, ghost, r.x + r.w / 2, r.y + 44, 62, dragging ? 0.3 : affordable ? 1 : 0.45)
    text(ctx, def.name, r.x + r.w / 2, r.y + 86, 14, '#fff', 'center', false)
    text(ctx, `${def.price} 💰`, r.x + r.w / 2, r.y + 106, 14, affordable ? '#ffd54a' : '#7a7f99', 'center', false)
  }
  const rr = shopCardRect(3)
  ctx.fillStyle = '#262b3d'; roundRect(ctx, rr, 14); ctx.fill()
  ctx.strokeStyle = s.gold >= s.rerollCost ? '#8d7bff' : '#3a3f55'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, '🔄', rr.x + rr.w / 2, rr.y + 44, 30, '#fff', 'center', false)
  text(ctx, 'Обновить', rr.x + rr.w / 2, rr.y + 86, 13, '#fff', 'center', false)
  text(ctx, `${s.rerollCost} 💰`, rr.x + rr.w / 2, rr.y + 106, 14, s.gold >= s.rerollCost ? '#ffd54a' : '#7a7f99', 'center', false)
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = '#1b1e2b'
  ctx.fillRect(0, 0, W, HUD_H)
  text(ctx, `❤️ ${s.lives}`, 14, HUD_H / 2, 18, '#fff', 'left', false)
  text(ctx, `💰 ${s.gold}`, 96, HUD_H / 2, 18, '#ffd54a', 'left', false)
  text(ctx, `Волна ${Math.min(s.wave, MAX_WAVE)}/${MAX_WAVE}`, 186, HUD_H / 2, 15, '#aab0cc', 'left', false)
  if (s.phase === 'ready') {
    const r = waveButtonRect()
    ctx.fillStyle = '#39c26a'; roundRect(ctx, r, 12); ctx.fill()
    text(ctx, `▶ Волна ${s.wave}`, r.x + r.w / 2, r.y + r.h / 2 + 1, 16, '#0b2b14', 'center', false)
  }
}

export function drawGame(ctx: CanvasRenderingContext2D, s: GameState, sprites: Sprites, view: ViewState, time: number) {
  ctx.clearRect(0, 0, W, H)
  drawHud(ctx, s)
  ctx.save()
  ctx.translate(0, HUD_H)
  ctx.drawImage(fieldLayer(), 0, 0)

  const drag = view.drag
  const dragUnit = drag?.kind === 'unit' ? s.units.find((u) => u.id === drag.unitId) : undefined
  // slot highlights while dragging
  if (drag) {
    for (let i = 0; i < SLOTS.length; i++) {
      const occ = unitAt(s, i)
      let color: string | null = null
      if (!occ) color = drag.kind === 'shop' && s.gold < UNIT_DEFS[drag.type].price ? null : 'rgba(120,255,160,0.35)'
      else if (dragUnit && canMerge(dragUnit, occ)) color = 'rgba(255,215,80,0.5)'
      if (!color) continue
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(SLOTS[i].x, SLOTS[i].y, SLOT_R, 0, Math.PI * 2); ctx.fill()
    }
  }
  // range for selected / dragged unit (dragged: previewed at the slot under the finger)
  const focus = dragUnit ?? (view.selected !== null ? s.units.find((u) => u.id === view.selected) : undefined)
  const hoverSlot = drag ? slotAt(drag.x, drag.y) : null
  if (drag && hoverSlot !== null) {
    const ghost: Unit = dragUnit ?? { id: -1, type: drag.type, level: 1, evo: 'none', slot: hoverSlot, cooldown: 0 }
    const c = SLOTS[hoverSlot]
    ctx.fillStyle = `${UNIT_DEFS[ghost.type].color}22`; ctx.strokeStyle = `${UNIT_DEFS[ghost.type].color}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, unitRange(ghost), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  } else if (focus) {
    const c = SLOTS[focus.slot]
    ctx.fillStyle = `${UNIT_DEFS[focus.type].color}22`; ctx.strokeStyle = `${UNIT_DEFS[focus.type].color}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, unitRange(focus), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // units
  for (const u of s.units) {
    const c = SLOTS[u.slot]
    const isDragged = dragUnit?.id === u.id
    const bob = Math.sin(time * 4 + u.id) * 1.5
    drawUnitSprite(ctx, sprites, u, c.x, c.y - 4 + bob, 58, isDragged ? 0.3 : 1)
    if (!isDragged) drawLevelBadge(ctx, u, c.x + 18, c.y + 16)
  }
  // beams
  for (const b of s.fx.beams) {
    ctx.globalAlpha = Math.min(1, b.t / 0.15)
    ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(b.from.x, b.from.y); ctx.lineTo(b.to.x, b.to.y); ctx.stroke()
    ctx.globalAlpha = 1
  }
  drawSnake(ctx, s, time)
  for (const p of s.fx.popups) {
    ctx.globalAlpha = Math.min(1, p.t / 0.3)
    text(ctx, p.text, p.x, p.y, 14, p.color)
    ctx.globalAlpha = 1
  }
  if (focus && !drag) {
    const def = UNIT_DEFS[focus.type]
    const c: Vec = SLOTS[focus.slot]
    const label = `${def.name} ур.${focus.level}  ⚔${unitDamage(focus)}  ${def.desc}`
    ctx.font = `700 12px ${FONT}`
    const tw = ctx.measureText(label).width + 16
    const bx = Math.min(Math.max(c.x - tw / 2, 6), W - tw - 6), by = c.y - 52
    ctx.fillStyle = 'rgba(15,17,28,0.9)'; roundRect(ctx, { x: bx, y: by, w: tw, h: 24 }, 8); ctx.fill()
    text(ctx, label, bx + tw / 2, by + 12, 12, '#fff', 'center', false)
  }
  if (s.units.length === 0 && s.phase === 'ready' && !drag) {
    text(ctx, 'Тяни бойца из магазина на слот ↓', W / 2, BOARD_H / 2, 16, '#eaf5ff')
    text(ctx, 'Два одинаковых — слияние ⬆ уровня', W / 2, BOARD_H / 2 + 26, 13, '#cfe3ff')
  }
  ctx.restore()

  drawShop(ctx, s, sprites, view)

  if (drag) {
    const ghost: Unit = dragUnit ?? { id: -1, type: drag.type, level: 1, evo: 'none', slot: -1, cooldown: 0 }
    drawUnitSprite(ctx, sprites, ghost, drag.x, drag.y - 30, 66, 0.9)
  }
  if (view.toast) {
    ctx.globalAlpha = Math.min(1, view.toast.t)
    text(ctx, view.toast.text, W / 2, HUD_H + BOARD_H - 30, 16, '#ffd54a')
    ctx.globalAlpha = 1
  }
}
