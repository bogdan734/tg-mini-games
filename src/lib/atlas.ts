/** Sprite-sheet helpers for canvas games (Tiny Swords style sheets: fixed-size frames in a grid). */

export interface Sheet { img: HTMLImageElement; fw: number; fh: number; cols: number; rows: number; ready: boolean }

const cache = new Map<string, Sheet>()

/** Load (once) a sheet at `url` with frames of `fw`x`fh`. Draw calls are no-ops until the image is ready. */
export function sheet(url: string, fw: number, fh: number): Sheet {
  const hit = cache.get(url)
  if (hit) return hit
  const img = new Image()
  const s: Sheet = { img, fw, fh, cols: 1, rows: 1, ready: false }
  img.onload = () => { s.cols = Math.max(1, Math.floor(img.naturalWidth / fw)); s.rows = Math.max(1, Math.floor(img.naturalHeight / fh)); s.ready = true }
  img.src = url
  cache.set(url, s)
  return s
}

export const assetUrl = (rel: string): string => `${import.meta.env.BASE_URL}games/assets/ts/${rel}`

/** Draw frame (col,row) centered at (x,y) scaled to `w`x`h`; `flip` mirrors horizontally. */
export function drawFrame(ctx: CanvasRenderingContext2D, s: Sheet, col: number, row: number, x: number, y: number, w: number, h: number, flip = false, alpha = 1): void {
  if (!s.ready) return
  const c = ((col % s.cols) + s.cols) % s.cols, r = Math.min(row, s.rows - 1)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  if (flip) ctx.scale(-1, 1)
  ctx.drawImage(s.img, c * s.fw, r * s.fh, s.fw, s.fh, -w / 2, -h / 2, w, h)
  ctx.restore()
}

/** Draw the whole image (single sprite) centered at (x,y). */
export function drawImage(ctx: CanvasRenderingContext2D, s: Sheet, x: number, y: number, w: number, h: number, alpha = 1): void {
  if (!s.ready) return
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h); ctx.restore()
}

/** A CanvasPattern from one tile of a sheet (cached per canvas context). */
const patterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>()
export function tilePattern(ctx: CanvasRenderingContext2D, s: Sheet, col: number, row: number, scale = 1): CanvasPattern | null {
  if (!s.ready) return null
  let m = patterns.get(ctx)
  if (!m) { m = new Map(); patterns.set(ctx, m) }
  const key = `${s.img.src}:${col}:${row}:${scale}`
  const hit = m.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = Math.round(s.fw * scale); c.height = Math.round(s.fh * scale)
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(s.img, col * s.fw, row * s.fh, s.fw, s.fh, 0, 0, c.width, c.height)
  const p = ctx.createPattern(c, 'repeat')
  if (p) m.set(key, p)
  return p
}

/** Nine-slice panel from a 3x3 grid sheet (e.g. Carved_9Slides 192x192 → 64px cells). */
export function drawNineSlice(ctx: CanvasRenderingContext2D, s: Sheet, x: number, y: number, w: number, h: number, edge = 20): void {
  if (!s.ready) return
  const cw = s.img.naturalWidth / 3, ch = s.img.naturalHeight / 3
  const e = edge
  const img = s.img
  const parts: [number, number, number, number, number, number, number, number][] = [
    [0, 0, cw, ch, x, y, e, e], [cw, 0, cw, ch, x + e, y, w - 2 * e, e], [2 * cw, 0, cw, ch, x + w - e, y, e, e],
    [0, ch, cw, ch, x, y + e, e, h - 2 * e], [cw, ch, cw, ch, x + e, y + e, w - 2 * e, h - 2 * e], [2 * cw, ch, cw, ch, x + w - e, y + e, e, h - 2 * e],
    [0, 2 * ch, cw, ch, x, y + h - e, e, e], [cw, 2 * ch, cw, ch, x + e, y + h - e, w - 2 * e, e], [2 * cw, 2 * ch, cw, ch, x + w - e, y + h - e, e, e],
  ]
  for (const p of parts) ctx.drawImage(img, ...p)
}

/** Three-slice horizontal (e.g. Button_Blue_3Slides 192x64 → 64px cells). */
export function drawThreeSlice(ctx: CanvasRenderingContext2D, s: Sheet, x: number, y: number, w: number, h: number, edge = 20): void {
  if (!s.ready) return
  const cw = s.img.naturalWidth / 3, ch = s.img.naturalHeight
  const e = edge
  ctx.drawImage(s.img, 0, 0, cw, ch, x, y, e, h)
  ctx.drawImage(s.img, cw, 0, cw, ch, x + e, y, w - 2 * e, h)
  ctx.drawImage(s.img, 2 * cw, 0, cw, ch, x + w - e, y, e, h)
}
