import { pointAt } from '../../snake-td/engine/path'
import { ENEMY_DEFS, MAX_WAVE } from '../engine/enemies'
import { availableMerges, sellValue, towerAt } from '../engine/game'
import { BASE, BOARD_H, BOARD_W, PATH, ROAD_WIDTH, SPAWN, TILE, TILES } from '../engine/layout'
import { mergeOutcome, recipesOf, TOWER_DEFS, towerDamage, towerRange } from '../engine/towers'
import type { GameState, TowerType } from '../engine/types'
import type { Sprites } from './sprites'

export const HUD_H = 48
export const PANEL_H = 150
export const W = BOARD_W
export const H = HUD_H + BOARD_H + PANEL_H
export const PANEL_Y = HUD_H + BOARD_H
export const FONT = 'Fredoka, -apple-system, sans-serif'

export interface Rect { x: number; y: number; w: number; h: number }
export interface DragState { towerId: number; type: TowerType; x: number; y: number; moved: boolean }
export interface ViewState {
  drag: DragState | null
  selected: number | null
  toast: { text: string; t: number } | null
  muted: boolean
}

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
export const waveButtonRect = (): Rect => ({ x: 222, y: 7, w: 106, h: 34 })
export const muteRect = (): Rect => ({ x: W - 50, y: 7, w: 42, h: 34 })
export const sellZoneRect = (): Rect => ({ x: 10, y: PANEL_Y + 14, w: W - 20, h: 122 })
/** Three option buttons over a tile while choosing; laid out in the panel. */
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

let field: HTMLCanvasElement | null = null
function fieldLayer(): HTMLCanvasElement {
  if (field) return field
  const c = document.createElement('canvas')
  c.width = BOARD_W
  c.height = BOARD_H
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, BOARD_H)
  grad.addColorStop(0, '#4aa85a')
  grad.addColorStop(1, '#357f43')
  g.fillStyle = grad
  g.fillRect(0, 0, BOARD_W, BOARD_H)
  let seed = 11
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2
  for (let i = 0; i < 140; i++) { const x = r() * BOARD_W, y = r() * BOARD_H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 7); g.moveTo(x, y); g.lineTo(x + 3, y - 6); g.stroke() }
  // trees in the empty bottom area
  for (let i = 0; i < 9; i++) {
    const x = 20 + r() * (BOARD_W - 40), y = 392 + r() * 60, rad = 14 + r() * 8
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(x + 3, y + rad, rad, rad * 0.4, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#5a3b1e'; g.fillRect(x - 3, y, 6, rad)
    g.fillStyle = i % 2 ? '#2f8f3f' : '#3aa54c'; g.beginPath(); g.arc(x, y - 2, rad, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.4, rad * 0.4, 0, Math.PI * 2); g.fill()
  }
  // road
  g.lineCap = 'round'; g.lineJoin = 'round'
  const road = () => { g.beginPath(); g.moveTo(PATH.pts[0].x, PATH.pts[0].y); for (const p of PATH.pts) g.lineTo(p.x, p.y); g.stroke() }
  g.strokeStyle = '#8a6b3e'; g.lineWidth = ROAD_WIDTH + 8; road()
  g.strokeStyle = '#e2c98f'; g.lineWidth = ROAD_WIDTH; road()
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([6, 10]); road(); g.setLineDash([])
  // tiles: raised grass blocks
  for (const t of TILES) {
    const x = t.x - TILE / 2, y = t.y - TILE / 2
    g.fillStyle = '#2d6d38'; g.beginPath(); g.roundRect(x, y + 6, TILE, TILE, 10); g.fill()
    g.fillStyle = '#7ccf5c'; g.beginPath(); g.roundRect(x, y, TILE, TILE, 10); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.roundRect(x + 4, y + 4, TILE - 8, 10, 5); g.fill()
  }
  // portal
  g.fillStyle = '#2b1e3f'; g.beginPath(); g.arc(SPAWN.x, SPAWN.y + 10, 22, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#a56cff'; g.lineWidth = 4; g.beginPath(); g.arc(SPAWN.x, SPAWN.y + 10, 16, 0, Math.PI * 2); g.stroke()
  // base
  g.fillStyle = '#4d5b7a'; g.fillRect(BASE.x - 24, BASE.y - 30, 48, 52)
  g.fillStyle = '#6b7ca0'; g.fillRect(BASE.x - 20, BASE.y - 26, 40, 44)
  g.fillStyle = '#4d5b7a'; for (let i = 0; i < 3; i++) g.fillRect(BASE.x - 22 + i * 16, BASE.y - 38, 10, 10)
  g.fillStyle = '#ff4d6d'; g.beginPath(); g.moveTo(BASE.x - 2, BASE.y - 46); g.lineTo(BASE.x + 16, BASE.y - 41); g.lineTo(BASE.x - 2, BASE.y - 36); g.fill()
  g.fillStyle = '#ffd54a'; g.font = `700 12px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('БАЗА', BASE.x, BASE.y + 34)
  field = c
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
const roundRect = (ctx: CanvasRenderingContext2D, r: Rect, radius: number) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius) }

function drawTowerSprite(ctx: CanvasRenderingContext2D, sprites: Sprites, type: TowerType, x: number, y: number, size: number, alpha = 1) {
  const img = sprites[type]
  ctx.globalAlpha = alpha
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
  else { ctx.fillStyle = TOWER_DEFS[type].color; ctx.beginPath(); ctx.arc(x, y, size / 2.4, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const e of s.enemies) {
    if (e.d < 0) continue
    const def = ENEMY_DEFS[e.kind]
    const p = pointAt(PATH, e.d)
    const flash = Math.max(0, e.hitT) / 0.12
    const r = def.r * (1 + 0.15 * flash)
    const bob = e.kind === 'wolf' ? Math.abs(Math.sin(time * 14 + e.id)) * 3 : Math.sin(time * 6 + e.id) * 1.5
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.8, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill()
    const y = p.y - bob
    const grad = ctx.createRadialGradient(p.x - r * 0.3, y - r * 0.3, r * 0.2, p.x, y, r)
    if (e.burn > 0) { grad.addColorStop(0, '#ffd27a'); grad.addColorStop(1, '#c2410c') }
    else if (e.slow > 0 || e.root > 0) { grad.addColorStop(0, '#dff4ff'); grad.addColorStop(1, e.root > 0 ? '#4c9a5c' : '#4f8fd6') }
    else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, def.color) }
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#2b2f3f'; ctx.lineWidth = 2; ctx.stroke()
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.6 * flash})`; ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.fill() }
    // face
    const a = p.angle, ex = Math.cos(a), ey = Math.sin(a), nx = -ey, ny = ex
    for (const side of [-1, 1]) {
      const cx = p.x + ex * r * 0.3 + nx * r * 0.4 * side, cy = y + ey * r * 0.3 + ny * r * 0.4 * side
      ctx.fillStyle = e.kind === 'boss' ? '#ff3b3b' : '#1c1f2b'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2); ctx.fill()
    }
    if (e.kind === 'boss') { ctx.fillStyle = '#fff'; for (const side of [-1, 1]) { const bx = p.x + ex * r * 0.7 + nx * r * 0.3 * side, by = y + ey * r * 0.7 + ny * r * 0.3 * side; ctx.beginPath(); ctx.moveTo(bx - nx * 3 * side, by - ny * 3 * side); ctx.lineTo(bx + ex * 7, by + ey * 7); ctx.lineTo(bx + nx * 3 * side, by + ny * 3 * side); ctx.fill() } }
    // hp bar
    const w = r * 2, hp = Math.max(0, e.hp) / e.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - w / 2, y - r - 8, w, 4)
    ctx.fillStyle = hp > 0.5 ? '#5be07a' : hp > 0.25 ? '#ffd54a' : '#ff5a5a'; ctx.fillRect(p.x - w / 2, y - r - 8, w * hp, 4)
    if (e.kind === 'boss') text(ctx, String(Math.ceil(e.hp)), p.x, y - r - 18, 13, '#fff')
  }
}

function drawShots(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const sh of s.fx.shots) {
    const k = Math.min(1, sh.t / 0.12)
    const x = sh.x + (sh.tx - sh.x) * k, y = sh.y + (sh.ty - sh.y) * k
    const def = TOWER_DEFS[sh.type]
    ctx.globalAlpha = 0.9
    if (def.effect === 'chain') {
      ctx.strokeStyle = def.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y)
      const dx = sh.tx - sh.x, dy = sh.ty - sh.y, L = Math.hypot(dx, dy) || 1
      for (let i = 1; i <= 5; i++) { const kk = i / 5, j = i === 5 ? 0 : (i % 2 ? 6 : -6); ctx.lineTo(sh.x + dx * kk - (dy / L) * j, sh.y + dy * kk + (dx / L) * j) }
      ctx.stroke()
    } else {
      ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(x, y, def.tier === 3 ? 7 : def.tier === 2 ? 5 : 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.6, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  for (const p of s.fx.parts) { ctx.globalAlpha = Math.min(1, p.t / 0.3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
}

function drawPanel(ctx: CanvasRenderingContext2D, s: GameState, sprites: Sprites, view: ViewState) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, PANEL_Y, W, PANEL_H)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, PANEL_Y, W, 2)
  if (view.drag) {
    const t = s.towers.find((x) => x.id === view.drag!.towerId)
    const r = sellZoneRect()
    ctx.fillStyle = 'rgba(255,80,80,0.15)'; roundRect(ctx, r, 16); ctx.fill()
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([])
    text(ctx, `Продать за ${t ? sellValue(t) : 0} 💰`, W / 2, r.y + r.h / 2, 20, '#ffb3b3')
    return
  }
  if (s.choice) {
    s.choice.options.forEach((type, i) => {
      const r = choiceRect(i)
      const def = TOWER_DEFS[type]
      ctx.fillStyle = '#262b3d'; roundRect(ctx, r, 14); ctx.fill()
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke()
      drawTowerSprite(ctx, sprites, type, r.x + r.w / 2, r.y + 36, 54)
      text(ctx, def.name, r.x + r.w / 2, r.y + 74, 13, '#fff', 'center', false)
      text(ctx, `${s.placeCost} 💰`, r.x + r.w / 2, r.y + 88, 12, s.gold >= s.placeCost ? '#ffd54a' : '#7a7f99', 'center', false)
    })
    const rr = choiceRerollRect()
    ctx.fillStyle = '#262b3d'; roundRect(ctx, rr, 14); ctx.fill()
    ctx.strokeStyle = s.gold >= s.rerollCost ? '#8d7bff' : '#3a3f55'; ctx.lineWidth = 2; ctx.stroke()
    text(ctx, '🔄', rr.x + rr.w / 2, rr.y + 36, 26, '#fff', 'center', false)
    text(ctx, `${s.rerollCost} 💰`, rr.x + rr.w / 2, rr.y + 78, 12, '#ffd54a', 'center', false)
    text(ctx, 'Выбери стихию для плитки · тап мимо — отмена', W / 2, PANEL_Y + 130, 12, '#aab0cc', 'center', false)
    return
  }
  // idle panel: merge hints / recipe book
  const merges = availableMerges(s)
  const sel = view.selected !== null ? s.towers.find((t) => t.id === view.selected) : undefined
  let y = PANEL_Y + 22
  if (sel) {
    const def = TOWER_DEFS[sel.type]
    drawTowerSprite(ctx, sprites, sel.type, 34, y + 18, 50)
    text(ctx, `${def.name} ур.${sel.level}  ⚔${towerDamage(sel)}  ⏱${def.rate}/с`, 64, y, 14, '#fff', 'left', false)
    text(ctx, def.desc, 64, y + 20, 12, '#aab0cc', 'left', false)
    y += 48
    const recs = recipesOf(sel.type)
    if (recs.length) {
      text(ctx, 'Рецепты:', 14, y, 12, '#aab0cc', 'left', false)
      recs.slice(0, 3).forEach((rc, i) => {
        const has = s.towers.some((t) => t.type === rc.with && t.id !== sel.id)
        text(ctx, `${TOWER_DEFS[rc.with].emoji} ${TOWER_DEFS[rc.with].name} → ${TOWER_DEFS[rc.result].emoji} ${TOWER_DEFS[rc.result].name}`, 14, y + 18 + i * 18, 12, has ? '#ffd54a' : '#7a7f99', 'left', false)
      })
    }
    return
  }
  text(ctx, 'Тапни плитку — поставить башню · тяни башню на башню — слияние', W / 2, y, 12, '#aab0cc', 'center', false)
  if (merges.length) {
    text(ctx, 'Можно слить сейчас:', 14, y + 26, 13, '#ffd54a', 'left', false)
    merges.slice(0, 4).forEach((m, i) => {
      const res = m.result === 'level' ? `${TOWER_DEFS[m.a.type].emoji} ур.${m.a.level + 1}` : `${TOWER_DEFS[m.result].emoji} ${TOWER_DEFS[m.result].name}`
      text(ctx, `${TOWER_DEFS[m.a.type].emoji} ${TOWER_DEFS[m.a.type].name} + ${TOWER_DEFS[m.b.type].emoji} ${TOWER_DEFS[m.b.type].name} → ${res}`, 14, y + 46 + i * 18, 12, '#fff', 'left', false)
    })
  } else {
    text(ctx, '🔥+⚙️ Файрбот · 🔥+🌪️ Огнешторм · ❄️+🌪️ Буран', W / 2, y + 30, 12, '#8e93ad', 'center', false)
    text(ctx, '❄️+⚙️ Криобот · 🌪️+⚙️ Тесла · 🌿+🔥 Пал', W / 2, y + 48, 12, '#8e93ad', 'center', false)
    text(ctx, 'Файрбот+🌪️ Мехабог · Буран+⚙️ Глациус · Тесла+🌿 Титан', W / 2, y + 66, 12, '#8e93ad', 'center', false)
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState) {
  ctx.fillStyle = '#1b1e2b'; ctx.fillRect(0, 0, W, HUD_H)
  text(ctx, `❤️ ${s.lives}`, 12, HUD_H / 2, 17, '#fff', 'left', false)
  text(ctx, `💰 ${s.gold}`, 82, HUD_H / 2, 17, '#ffd54a', 'left', false)
  text(ctx, `Волна ${Math.min(s.wave, MAX_WAVE)}/${MAX_WAVE}`, 158, HUD_H / 2, 14, '#aab0cc', 'left', false)
  if (s.phase === 'ready') {
    const r = waveButtonRect()
    ctx.fillStyle = '#39c26a'; roundRect(ctx, r, 12); ctx.fill()
    text(ctx, `▶ Волна ${s.wave}`, r.x + r.w / 2, r.y + r.h / 2 + 1, 15, '#0b2b14', 'center', false)
  }
  const m = muteRect()
  ctx.fillStyle = '#262b3d'; roundRect(ctx, m, 10); ctx.fill()
  text(ctx, view.muted ? '🔇' : '🔊', m.x + m.w / 2, m.y + m.h / 2 + 1, 18, '#fff', 'center', false)
}

export function drawGame(ctx: CanvasRenderingContext2D, s: GameState, sprites: Sprites, view: ViewState, time: number) {
  ctx.clearRect(0, 0, W, H)
  drawHud(ctx, s, view)
  ctx.save()
  const shake = s.fx.shake > 0 ? (s.fx.shake / 0.3) * 4 : 0
  ctx.translate(shake ? (Math.random() - 0.5) * shake * 2 : 0, HUD_H + (shake ? (Math.random() - 0.5) * shake * 2 : 0))
  ctx.drawImage(fieldLayer(), 0, 0)
  const drag = view.drag
  const dragTower = drag ? s.towers.find((t) => t.id === drag.towerId) : undefined
  if (dragTower) {
    for (let i = 0; i < TILES.length; i++) {
      const occ = towerAt(s, i)
      let color: string | null = null
      if (!occ) color = 'rgba(255,255,255,0.25)'
      else if (occ.id !== dragTower.id) { const o = mergeOutcome(dragTower, occ); if (o) color = o.kind === 'recipe' ? 'rgba(255,120,255,0.55)' : 'rgba(255,215,80,0.5)' }
      if (!color) continue
      const t = TILES[i]
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(t.x - TILE / 2, t.y - TILE / 2, TILE, TILE, 10); ctx.fill()
    }
  }
  if (s.choice) {
    const t = TILES[s.choice.tile]
    ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.roundRect(t.x - TILE / 2 - 2, t.y - TILE / 2 - 2, TILE + 4, TILE + 4, 12); ctx.stroke(); ctx.setLineDash([])
  }
  const focus = dragTower ?? (view.selected !== null ? s.towers.find((t) => t.id === view.selected) : undefined)
  const hover = drag ? tileAt(drag.x, drag.y) : null
  if (focus) {
    const c = hover !== null && dragTower ? TILES[hover] : TILES[focus.tile]
    ctx.fillStyle = `${TOWER_DEFS[focus.type].color}22`; ctx.strokeStyle = `${TOWER_DEFS[focus.type].color}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, towerRange(focus), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  for (const t of s.towers) {
    const c = TILES[t.tile]
    const isDragged = dragTower?.id === t.id
    const recoil = t.cooldown > 0 ? Math.max(0, 1 - (1 / TOWER_DEFS[t.type].rate - t.cooldown) / 0.1) * 3 : 0
    const size = 44 + TOWER_DEFS[t.type].tier * 4
    drawTowerSprite(ctx, sprites, t.type, c.x, c.y - 6 + recoil, size, isDragged ? 0.3 : 1)
    if (!isDragged) {
      ctx.fillStyle = TOWER_DEFS[t.type].tier === 3 ? '#ffd54a' : TOWER_DEFS[t.type].tier === 2 ? '#c56bff' : '#222a3a'
      ctx.beginPath(); ctx.arc(c.x + 20, c.y + 18, 10, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      text(ctx, String(t.level), c.x + 20, c.y + 19, 12, TOWER_DEFS[t.type].tier === 3 ? '#3a2a00' : '#fff', 'center', false)
    }
  }
  drawShots(ctx, s)
  drawEnemies(ctx, s, time)
  for (const p of s.fx.popups) { ctx.globalAlpha = Math.min(1, p.t / 0.3); text(ctx, p.text, p.x, p.y, 13, p.color); ctx.globalAlpha = 1 }
  if (s.towers.length === 0 && s.phase === 'ready' && !s.choice) {
    text(ctx, 'Тапни зелёную плитку и выбери стихию', W / 2, BOARD_H - 90, 15, '#eaf5ff')
    text(ctx, 'Разные стихии сливаются в новых существ', W / 2, BOARD_H - 68, 13, '#cfe3ff')
  }
  ctx.restore()
  drawPanel(ctx, s, sprites, view)
  if (dragTower) drawTowerSprite(ctx, sprites, dragTower.type, drag!.x, drag!.y - 30, 60, 0.9)
  if (view.toast) { ctx.globalAlpha = Math.min(1, view.toast.t); text(ctx, view.toast.text, W / 2, HUD_H + BOARD_H - 30, 16, '#ffd54a'); ctx.globalAlpha = 1 }
}
