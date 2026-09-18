import { assetUrl, drawFrame, drawImage, drawNineSlice, drawThreeSlice, sheet, tilePattern, type Sheet } from '../../../lib/atlas'
import { pointAt } from '../../snake-td/engine/path'
import { MAX_WAVE } from '../engine/enemies'
import { availableMerges, sellValue, towerAt } from '../engine/game'
import { BASE, BOARD_H, BOARD_W, PATH, ROAD_WIDTH, SPAWN, TILE, TILES } from '../engine/layout'
import { mergeOutcome, recipesOf, TOWER_DEFS, towerDamage, towerRange } from '../engine/towers'
import type { Enemy, EnemyKind, GameState, Shot, TowerType } from '../engine/types'

export const HUD_H = 48
export const PANEL_H = 150
export const W = BOARD_W
export const H = HUD_H + BOARD_H + PANEL_H
export const PANEL_Y = HUD_H + BOARD_H
export const FONT = 'Fredoka, -apple-system, sans-serif'

export interface Rect { x: number; y: number; w: number; h: number }
export interface DragState { towerId: number; type: TowerType; x: number; y: number; moved: boolean }
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
type Mount = 'none' | 'wood' | 'stone'
const LOOK: Record<TowerType, { f: Family; c: Color; mount: Mount }> = {
  fire: { f: 'torch', c: 'red', mount: 'none' }, ice: { f: 'archer', c: 'blue', mount: 'none' }, robot: { f: 'pawn', c: 'purple', mount: 'none' },
  storm: { f: 'archer', c: 'purple', mount: 'none' }, nature: { f: 'warrior', c: 'yellow', mount: 'none' },
  firebot: { f: 'pawn', c: 'red', mount: 'wood' }, firestorm: { f: 'torch', c: 'purple', mount: 'wood' }, blizzard: { f: 'archer', c: 'blue', mount: 'wood' },
  cryobot: { f: 'pawn', c: 'blue', mount: 'wood' }, tesla: { f: 'archer', c: 'purple', mount: 'wood' }, wildfire: { f: 'warrior', c: 'red', mount: 'wood' },
  mechagod: { f: 'warrior', c: 'red', mount: 'stone' }, glacius: { f: 'archer', c: 'blue', mount: 'stone' }, titan: { f: 'warrior', c: 'yellow', mount: 'stone' },
}
const ENEMY_LOOK: Record<EnemyKind, { f: Family; c: Color; scale: number }> = {
  skeleton: { f: 'torch', c: 'blue', scale: 1 }, wolf: { f: 'torch', c: 'yellow', scale: 0.9 }, brute: { f: 'tnt', c: 'red', scale: 1.2 }, boss: { f: 'tnt', c: 'purple', scale: 1.7 },
}
const A = {
  arrow: sheet(assetUrl('troops/arrow.png'), 64, 64),
  dynamite: sheet(assetUrl('goblins/dynamite.png'), 64, 64),
  fire: sheet(assetUrl('effects/fire.png'), 128, 128),
  explosion: sheet(assetUrl('effects/explosions.png'), 192, 192),
  dead: sheet(assetUrl('troops/dead.png'), 128, 128),
  flat: sheet(assetUrl('terrain/flat.png'), 64, 64),
  elevation: sheet(assetUrl('terrain/elevation.png'), 64, 64),
  water: sheet(assetUrl('terrain/water.png'), 64, 64),
  foam: sheet(assetUrl('terrain/foam.png'), 192, 192),
  shadow: sheet(assetUrl('terrain/shadows.png'), 192, 192),
  castle: sheet(assetUrl('buildings/castle_blue.png'), 320, 256),
  lair: sheet(assetUrl('buildings/goblin_house.png'), 128, 192),
  woodTower: sheet(assetUrl('buildings/wood_tower_red.png'), 128, 256),
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

// ---------------------------------------------------------------- field
let field: HTMLCanvasElement | null = null
function fieldLayer(): HTMLCanvasElement | null {
  if (field) return field
  if (!A.flat.ready || !A.elevation.ready) return null
  const c = document.createElement('canvas'); c.width = BOARD_W; c.height = BOARD_H
  const g = c.getContext('2d')!
  const grass = tilePattern(g, A.flat, 1, 1, 1)
  g.fillStyle = grass ?? '#4aa85a'; g.beginPath(); g.roundRect(0, 0, BOARD_W, BOARD_H, 18); g.fill()
  // road
  g.lineCap = 'round'; g.lineJoin = 'round'
  const road = () => { g.beginPath(); g.moveTo(PATH.pts[0].x, PATH.pts[0].y); for (const p of PATH.pts) g.lineTo(p.x, p.y); g.stroke() }
  g.strokeStyle = 'rgba(70,45,20,0.55)'; g.lineWidth = ROAD_WIDTH + 8; road()
  const sand = tilePattern(g, A.flat, 6, 1, 1)
  g.strokeStyle = sand ?? '#e2c98f'; g.lineWidth = ROAD_WIDTH; road()
  // raised stone platforms for tiles: cliff top pattern + front face
  const top = tilePattern(g, A.elevation, 1, 1, 1)
  for (const t of TILES) {
    const x = t.x - TILE / 2, y = t.y - TILE / 2
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.roundRect(x + 2, y + 10, TILE, TILE, 8); g.fill()
    // front face (wall)
    g.drawImage(A.elevation.img, 64, 3 * 64, 64, 64, x, y + TILE - 14, TILE, 20)
    g.fillStyle = top ?? '#7ccf5c'; g.beginPath(); g.roundRect(x, y, TILE, TILE - 6, 8); g.fill()
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.stroke()
  }
  // trees in the empty bottom area
  let seed = 11
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (let i = 0; i < 5; i++) {
    const x = 40 + r() * (BOARD_W - 80), y = 400 + r() * 50
    g.drawImage(A.tree.img, 0, 0, 192, 192, x - 40, y - 60, 80, 80)
  }
  field = c
  return c
}

function drawTroop(ctx: CanvasRenderingContext2D, f: Family, c: Color, id: number, x: number, y: number, size: number, time: number, moving: boolean, alpha = 1) {
  const sh = troop(f, c)
  let an = anims.get(id)
  if (an && time - an.t > an.dur) { anims.delete(id); an = undefined }
  const spec = (an && ANIMS[f][an.name]) ?? (moving ? ANIMS[f].walk : ANIMS[f].idle) ?? ANIMS[f].idle!
  const frame = an ? Math.min(spec.n - 1, Math.floor(((time - an.t) / an.dur) * spec.n)) : Math.floor(time * (moving ? 10 : 8) + id) % spec.n
  drawFrame(ctx, sh, frame, spec.row, x, y, size, size, an?.flip ?? false, alpha)
}

function drawTowers(ctx: CanvasRenderingContext2D, s: GameState, view: ViewState, time: number) {
  const drag = view.drag
  for (const t of [...s.towers].sort((a, b) => TILES[a.tile].y - TILES[b.tile].y)) {
    const c = TILES[t.tile]
    const look = LOOK[t.type]
    const isDragged = drag?.towerId === t.id
    const alpha = isDragged ? 0.3 : 1
    let uy = c.y - 8
    if (look.mount === 'wood') { drawImage(ctx, A.woodTower, c.x, c.y - 10, 40, 80, alpha); uy = c.y - 40 }
    else if (look.mount === 'stone') { drawImage(ctx, A.stoneTower, c.x, c.y - 14, 46, 92, alpha); uy = c.y - 50 }
    else drawImage(ctx, A.shadow, c.x, c.y + 12, 52, 30, 0.8 * alpha)
    drawTroop(ctx, look.f, look.c, t.id, c.x, uy, look.mount === 'none' ? 72 : 60, time, false, alpha)
    if (!isDragged) {
      const tier = TOWER_DEFS[t.type].tier
      ctx.fillStyle = tier === 3 ? '#ffd54a' : tier === 2 ? '#c56bff' : '#2f5fbf'
      ctx.beginPath(); ctx.arc(c.x + 22, c.y + 16, 10, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      text(ctx, String(t.level), c.x + 22, c.y + 17, 12, tier === 3 ? '#3a2a00' : '#fff', 'center', false)
    }
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const e of s.enemies) {
    if (e.d < 0) continue
    const p = pointAt(PATH, e.d)
    const look = ENEMY_LOOK[e.kind]
    const size = 60 * look.scale
    const flash = Math.max(0, e.hitT) / 0.12
    drawImage(ctx, A.shadow, p.x, p.y + size * 0.3, size * 0.8, size * 0.4, 0.8)
    if (e.burn > 0) drawFrame(ctx, A.fire, Math.floor(time * 12 + e.id) % 7, 0, p.x, p.y - size * 0.2, size * 0.9, size * 0.9, false, 0.9)
    const moving = e.root <= 0
    const flip = Math.cos(p.angle) < 0
    const sh = troop(look.f, look.c)
    const spec = moving ? ANIMS[look.f].walk! : ANIMS[look.f].idle!
    const frame = Math.floor(time * (e.kind === 'wolf' ? 14 : 9) + e.id) % spec.n
    drawFrame(ctx, sh, frame, spec.row, p.x, p.y - size * 0.25, size, size, flip)
    if (flash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${0.5 * flash})`; ctx.beginPath(); ctx.arc(p.x, p.y - size * 0.25, size * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over' }
    if (e.slow > 0 || e.root > 0) { ctx.strokeStyle = e.root > 0 ? 'rgba(90,200,110,0.9)' : 'rgba(150,210,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y + size * 0.28, size * 0.36, size * 0.16, 0, 0, Math.PI * 2); ctx.stroke() }
    const w = size * 0.7, hp = Math.max(0, e.hp) / e.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - w / 2, p.y - size * 0.62, w, 4)
    ctx.fillStyle = hp > 0.5 ? '#5be07a' : hp > 0.25 ? '#ffd54a' : '#ff5a5a'; ctx.fillRect(p.x - w / 2, p.y - size * 0.62, w * hp, 4)
    if (e.kind === 'boss') text(ctx, String(Math.ceil(e.hp)), p.x, p.y - size * 0.72, 13, '#fff')
  }
}

function drawShots(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  for (const sh of s.fx.shots) {
    if (!seenShots.has(sh)) {
      seenShots.add(sh)
      const t = s.towers.find((x) => x.id === sh.towerId)
      if (t) {
        const f = LOOK[t.type].f
        const spec = attackAnim(f, sh.tx - sh.x, sh.ty - sh.y)
        const n = ANIMS[f][spec.name]?.n ?? 6
        anims.set(t.id, { name: spec.name, t: time, dur: Math.min(0.5, Math.max(0.28, n / 16)), flip: spec.flip })
      }
    }
    const def = TOWER_DEFS[sh.type]
    const ang = Math.atan2(sh.ty - sh.y, sh.tx - sh.x)
    const k = Math.min(1, sh.t / 0.22)
    const fx = sh.x + (sh.tx - sh.x) * k, fy = sh.y + (sh.ty - sh.y) * k - Math.sin(k * Math.PI) * 16
    switch (def.effect) {
      case 'none': case 'slow': // arrows (ice = blue tint ring on hit)
        if (sh.t < 0.22) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang + Math.PI / 4); if (A.arrow.ready) ctx.drawImage(A.arrow.img, 0, 0, 64, 64, -16, -16, 32, 32); ctx.restore() }
        else if (sh.t < 0.45 && def.effect === 'slow') { const q = (sh.t - 0.22) / 0.23; ctx.strokeStyle = `rgba(180,230,255,${1 - q})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sh.tx, sh.ty, 6 + q * 18, 0, Math.PI * 2); ctx.stroke() }
        break
      case 'burn':
        if (sh.type === 'firebot') { if (sh.t < 0.22) { ctx.fillStyle = '#ff7a2f'; ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill() } }
        if (sh.t >= 0.15 && sh.t < 0.7) drawFrame(ctx, A.fire, Math.floor(((sh.t - 0.15) / 0.55) * 7), 0, sh.tx, sh.ty - 14, 50, 50, false, 1 - sh.t / 0.8)
        break
      case 'aoe':
        if (sh.t < 0.35) drawFrame(ctx, A.dynamite, Math.floor(sh.t * 20) % 6, 0, sh.x + (sh.tx - sh.x) * (sh.t / 0.35), sh.y + (sh.ty - sh.y) * (sh.t / 0.35) - Math.sin((sh.t / 0.35) * Math.PI) * 40, 26, 26)
        else if (sh.t < 0.8) drawFrame(ctx, A.explosion, Math.min(8, Math.floor(((sh.t - 0.35) / 0.45) * 9)), 0, sh.tx, sh.ty - 12, def.tier === 3 ? 130 : 96, def.tier === 3 ? 130 : 96)
        break
      case 'chain':
        if (sh.t < 0.25) {
          ctx.globalAlpha = 1 - sh.t / 0.25
          ctx.strokeStyle = def.color; ctx.lineWidth = 3; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(sh.x, sh.y)
          const dx = sh.tx - sh.x, dy = sh.ty - sh.y, L = Math.hypot(dx, dy) || 1
          for (let i = 1; i <= 6; i++) { const kk = i / 6, j = i === 6 ? 0 : (i % 2 ? 7 : -7); ctx.lineTo(sh.x + dx * kk - (dy / L) * j, sh.y + dy * kk + (dx / L) * j) }
          ctx.stroke(); ctx.globalAlpha = 1
        }
        break
      case 'root':
        if (sh.t > 0.1 && sh.t < 0.5) {
          const q = (sh.t - 0.1) / 0.4
          ctx.save(); ctx.translate(sh.tx, sh.ty); ctx.rotate(ang)
          ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 5 - q * 3; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.arc(-6, 0, 16 + q * 10, -1.2, 1.2); ctx.stroke(); ctx.restore()
          ctx.strokeStyle = `rgba(90,200,110,${1 - q})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sh.tx, sh.ty + 6, 12 + q * 14, 6 + q * 6, 0, 0, Math.PI * 2); ctx.stroke()
        }
        break
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
    s.choice.options.forEach((type, i) => {
      const r = choiceRect(i)
      const def = TOWER_DEFS[type], look = LOOK[type]
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; roundRect(ctx, r, 12); ctx.fill()
      ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.stroke()
      drawTroop(ctx, look.f, look.c, -1 - i, r.x + r.w / 2, r.y + 34, 70, time, false)
      text(ctx, `${def.emoji} ${def.name}`, r.x + r.w / 2, r.y + 68, 12, '#3a2a12', 'center', false)
      drawThreeSlice(ctx, s.gold >= s.placeCost ? A.btnBlue : A.btnOff, r.x + 8, r.y + 76, r.w - 16, 18, 8)
      text(ctx, `${s.placeCost}`, r.x + r.w / 2 - 5, r.y + 85, 11, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
      drawFrame(ctx, A.gold, 0, 0, r.x + r.w / 2 + 12, r.y + 85, 16, 16)
    })
    const rr = choiceRerollRect()
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(ctx, rr, 12); ctx.fill()
    drawFrame(ctx, A.iconSwords, 0, 0, rr.x + rr.w / 2, rr.y + 34, 36, 36)
    drawThreeSlice(ctx, s.gold >= s.rerollCost ? A.btnBlue : A.btnOff, rr.x + 8, rr.y + 76, rr.w - 16, 18, 8)
    text(ctx, `${s.rerollCost}`, rr.x + rr.w / 2 - 5, rr.y + 85, 11, '#fff', 'center', true, 'rgba(0,0,0,0.35)')
    drawFrame(ctx, A.gold, 0, 0, rr.x + rr.w / 2 + 12, rr.y + 85, 16, 16)
    text(ctx, 'Выбери стихию · тап мимо — отмена', W / 2, PANEL_Y + 130, 12, '#6b5636', 'center', false)
    return
  }
  const merges = availableMerges(s)
  const sel = view.selected !== null ? s.towers.find((t) => t.id === view.selected) : undefined
  let y = PANEL_Y + 24
  if (sel) {
    const def = TOWER_DEFS[sel.type], look = LOOK[sel.type]
    drawTroop(ctx, look.f, look.c, -9, 38, y + 22, 64, time, false)
    text(ctx, `${def.emoji} ${def.name} ур.${sel.level}  ⚔${towerDamage(sel)}  ⏱${def.rate}/с`, 70, y, 13, '#3a2a12', 'left', false)
    text(ctx, def.desc, 70, y + 18, 12, '#6b5636', 'left', false)
    y += 44
    const recs = recipesOf(sel.type)
    if (recs.length) {
      text(ctx, 'Рецепты:', 16, y, 12, '#6b5636', 'left', false)
      recs.slice(0, 3).forEach((rc, i) => {
        const has = s.towers.some((t) => t.type === rc.with && t.id !== sel.id)
        text(ctx, `${TOWER_DEFS[rc.with].emoji} ${TOWER_DEFS[rc.with].name} → ${TOWER_DEFS[rc.result].emoji} ${TOWER_DEFS[rc.result].name}`, 16, y + 18 + i * 17, 12, has ? '#1f5fbf' : '#8a7a5a', 'left', false)
      })
    }
    return
  }
  text(ctx, 'Тап по плитке — башня · башню на башню — слияние', W / 2, y, 12, '#6b5636', 'center', false)
  if (merges.length) {
    text(ctx, 'Можно слить сейчас:', 16, y + 24, 13, '#1f5fbf', 'left', false)
    merges.slice(0, 4).forEach((m, i) => {
      const res = m.result === 'level' ? `${TOWER_DEFS[m.a.type].emoji} ур.${m.a.level + 1}` : `${TOWER_DEFS[m.result].emoji} ${TOWER_DEFS[m.result].name}`
      text(ctx, `${TOWER_DEFS[m.a.type].emoji} ${TOWER_DEFS[m.a.type].name} + ${TOWER_DEFS[m.b.type].emoji} ${TOWER_DEFS[m.b.type].name} → ${res}`, 16, y + 44 + i * 17, 12, '#3a2a12', 'left', false)
    })
  } else {
    text(ctx, '🔥+⚙️ Файрбот · 🔥+🌪️ Огнешторм · ❄️+🌪️ Буран', W / 2, y + 28, 12, '#6b5636', 'center', false)
    text(ctx, '❄️+⚙️ Криобот · 🌪️+⚙️ Тесла · 🌿+🔥 Пал', W / 2, y + 46, 12, '#6b5636', 'center', false)
    text(ctx, 'Файрбот+🌪️ Мехабог · Буран+⚙️ Глациус · Тесла+🌿 Титан', W / 2, y + 64, 12, '#6b5636', 'center', false)
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
  ctx.fillStyle = water ?? '#3f8fbf'; ctx.fillRect(-10, -10, W + 20, BOARD_H + 20)
  if (A.foam.ready) {
    const fr = Math.floor(time * 8) % 8
    for (let x = 20; x < W; x += 60) { drawFrame(ctx, A.foam, fr, 0, x, 2, 90, 90, false, 0.9); drawFrame(ctx, A.foam, (fr + 3) % 8, 0, x + 30, BOARD_H - 2, 90, 90, false, 0.9) }
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
      else if (occ.id !== dragTower.id) { const o = mergeOutcome(dragTower, occ); if (o) color = o.kind === 'recipe' ? 'rgba(255,120,255,0.55)' : 'rgba(255,215,80,0.5)' }
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
    ctx.fillStyle = `${TOWER_DEFS[focus.type].color}22`; ctx.strokeStyle = `${TOWER_DEFS[focus.type].color}88`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(c.x, c.y, towerRange(focus), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // lair at the portal, castle at the base
  drawImage(ctx, A.lair, SPAWN.x, SPAWN.y + 22, 54, 80)
  drawTowers(ctx, s, view, time)
  drawEnemies(ctx, s, time)
  drawShots(ctx, s, time)
  drawImage(ctx, A.castle, BASE.x + 12, BASE.y - 6, 100, 80)
  for (const p of s.fx.popups) { ctx.globalAlpha = Math.min(1, p.t / 0.3); text(ctx, p.text, p.x, p.y, 13, p.color); ctx.globalAlpha = 1 }
  if (s.towers.length === 0 && s.phase === 'ready' && !s.choice) {
    text(ctx, 'Тапни плиту и выбери стихию', W / 2, BOARD_H - 100, 15, '#fff')
    text(ctx, 'Разные стихии сливаются в новых бойцов', W / 2, BOARD_H - 78, 13, '#eaf5ff')
  }
  ctx.restore()
  drawPanel(ctx, s, view, time)
  if (dragTower) { const look = LOOK[dragTower.type]; drawTroop(ctx, look.f, look.c, dragTower.id, drag!.x, drag!.y - 34, 80, time, false, 0.9) }
  if (view.toast) { ctx.globalAlpha = Math.min(1, view.toast.t); text(ctx, view.toast.text, W / 2, HUD_H + BOARD_H - 30, 16, '#ffd54a'); ctx.globalAlpha = 1 }
}
export type { Enemy }
