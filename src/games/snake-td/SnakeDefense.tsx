import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/telegram'
import type { GameProps } from '../types'
import {
  buyAndPlace, chooseEvolution, createGame, EVENTS, MAX_WAVE, moveOrMerge, reroll,
  resolveEvent, sellUnit, startWave, tick, unitAt,
} from './engine/game'
import type { GameState, Phase } from './engine/types'
import { canMerge, EVO_MUL, UNIT_DEFS } from './engine/units'
import {
  drawGame, H, inRect, sellZoneRect, shopCardRect, slotAt, type ViewState, W, waveButtonRect,
} from './render/draw'
import { loadSprites, type Sprites } from './render/sprites'
import './snake-td.css'

export default function SnakeDefense({ onScore }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createGame())
  const viewRef = useRef<ViewState>({ drag: null, selected: null, toast: null })
  const spritesRef = useRef<Sprites>({})
  const scaleRef = useRef(1)
  const phaseRef = useRef<Phase>('ready')
  const reportedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [, bump] = useState(0)

  const toast = (text: string) => { viewRef.current.toast = { text, t: 1.4 } }

  useEffect(() => {
    loadSprites().then((sp) => { spritesRef.current = sp })
    // canvas text does not trigger webfont loading by itself
    document.fonts?.load('700 16px Fredoka').catch(() => {})
  }, [])

  // canvas sizing
  useEffect(() => {
    const wrap = wrapRef.current!, canvas = canvasRef.current!
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const scale = Math.min(wrap.clientWidth / W, wrap.clientHeight / H)
      scaleRef.current = scale
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W * scale}px`
      canvas.style.height = `${H * scale}px`
      canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // game loop
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    let raf = 0
    let last = performance.now()
    const STEP = 1 / 60
    let acc = 0
    const syncPhase = (s: GameState) => {
      if (s.phase === phaseRef.current) return
      phaseRef.current = s.phase
      setPhase(s.phase)
      if (s.phase === 'evolution' || s.phase === 'event') haptic('medium')
      if ((s.phase === 'over' || s.phase === 'won') && !reportedRef.current) {
        reportedRef.current = true
        haptic(s.phase === 'won' ? 'success' : 'error')
        onScore(s.score)
      }
    }
    const loop = (now: number) => {
      // fixed-step simulation; catches up after throttled frames (background tab, webview)
      acc += Math.min(0.25, (now - last) / 1000)
      last = now
      const s = stateRef.current
      const v = viewRef.current
      while (acc >= STEP) {
        tick(s, STEP)
        if (v.toast) { v.toast.t -= STEP; if (v.toast.t <= 0) v.toast = null }
        acc -= STEP
      }
      syncPhase(s)
      drawGame(ctx, s, spritesRef.current, v, now / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    if (import.meta.env.DEV) {
      // deterministic driver for automated tests: window.__std.step(seconds)
      ;(window as unknown as { __std: unknown }).__std = {
        get state() { return stateRef.current },
        get view() { return viewRef.current },
        step(sec: number) {
          const s = stateRef.current
          for (let t = 0; t < sec; t += STEP) tick(s, STEP)
          syncPhase(s)
          drawGame(ctx, s, spritesRef.current, viewRef.current, performance.now() / 1000)
        },
        api: { startWave, resolveEvent, chooseEvolution, buyAndPlace, moveOrMerge, reroll, unitAt, canMerge, sync: () => syncPhase(stateRef.current) },
      }
    }
    return () => cancelAnimationFrame(raf)
  }, [onScore])

  const toCanvas = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scaleRef.current, y: (e.clientY - r.top) / scaleRef.current }
  }

  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current, v = viewRef.current
    if (s.phase !== 'ready' && s.phase !== 'wave') return
    const { x, y } = toCanvas(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (s.phase === 'ready' && inRect(waveButtonRect(), x, y)) { startWave(s); haptic('medium'); return }
    for (let i = 0; i < 3; i++) {
      if (inRect(shopCardRect(i), x, y) && s.shop[i]) {
        const type = s.shop[i]!
        if (s.gold < UNIT_DEFS[type].price) { toast('Не хватает золота'); haptic('error'); return }
        v.drag = { kind: 'shop', shopIdx: i, unitId: -1, type, x, y, moved: false }
        v.selected = null
        return
      }
    }
    if (inRect(shopCardRect(3), x, y)) {
      if (reroll(s)) haptic('light'); else { toast('Не хватает золота'); haptic('error') }
      return
    }
    const slot = slotAt(x, y)
    const u = slot !== null ? unitAt(s, slot) : undefined
    if (u) { v.drag = { kind: 'unit', shopIdx: -1, unitId: u.id, type: u.type, x, y, moved: false }; v.selected = u.id; return }
    v.selected = null
  }, [])

  const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = viewRef.current.drag
    if (!d) return
    const { x, y } = toCanvas(e)
    if (Math.hypot(x - d.x, y - d.y) > 4) d.moved = true
    d.x = x; d.y = y
  }, [])

  const onUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current, v = viewRef.current
    const d = v.drag
    v.drag = null
    if (!d) return
    const { x, y } = toCanvas(e)
    const slot = slotAt(x, y)
    if (d.kind === 'shop') {
      if (slot === null) { if (d.moved) toast('Отпусти на свободный слот'); return }
      if (buyAndPlace(s, d.shopIdx, slot)) haptic('light')
      else { toast(unitAt(s, slot) ? 'Слот занят' : 'Не хватает золота'); haptic('error') }
      return
    }
    if (!d.moved) return // tap = select only
    if (slot !== null) {
      const res = moveOrMerge(s, d.unitId, slot)
      if (res === 'merged') { haptic('success'); toast('Слияние!'); v.selected = unitAt(s, slot)?.id ?? null }
      else if (res === 'blocked') { toast('Нельзя объединить'); haptic('error') }
      return
    }
    if (inRect(sellZoneRect(), x, y)) {
      const u = s.units.find((z) => z.id === d.unitId)
      if (u && sellUnit(s, d.unitId)) { toast('Продано'); haptic('medium'); v.selected = null }
    }
  }, [])

  const restart = () => {
    stateRef.current = createGame()
    viewRef.current = { drag: null, selected: null, toast: null }
    reportedRef.current = false
    phaseRef.current = 'ready'
    setPhase('ready')
  }

  const s = stateRef.current
  const evoUnit = s.units.find((u) => u.id === s.pendingEvo)
  const ev = s.pendingEvent ? EVENTS[s.pendingEvent] : null

  return (
    <div className="std-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="std-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      {phase === 'evolution' && evoUnit && (
        <div className="std-modal">
          <h2>Эволюция!</h2>
          <p className="subtitle">{UNIT_DEFS[evoUnit.type].name} достиг 3 уровня. Выбери путь:</p>
          <div className="std-cards">
            <button className="std-card safe" onClick={() => { chooseEvolution(s, 'safe'); bump((n) => n + 1) }}>
              <b>Надёжная</b>
              <span>Урон ×{EVO_MUL.safe}</span>
              <small>100% успех</small>
            </button>
            <button className="std-card risky" onClick={() => {
              const ok = chooseEvolution(s, 'risky')
              toast(ok ? 'Успех! Урон ×3' : 'Провал… уровень −1')
              haptic(ok ? 'success' : 'error')
              bump((n) => n + 1)
            }}>
              <b>Рискованная</b>
              <span>Урон ×{EVO_MUL.risky}</span>
              <small>50% успех, провал = −1 уровень</small>
            </button>
          </div>
        </div>
      )}
      {phase === 'event' && ev && (
        <div className="std-modal">
          <div className="std-event-icon">{ev.icon}</div>
          <h2>{ev.title}</h2>
          <p className="subtitle">{ev.desc}</p>
          <button className="btn-primary" onClick={() => { resolveEvent(s); bump((n) => n + 1) }}>Дальше</button>
        </div>
      )}
      {(phase === 'over' || phase === 'won') && (
        <div className="std-modal">
          <h2>{phase === 'won' ? '🏆 Победа!' : '💀 Змея прорвалась'}</h2>
          <p className="subtitle">
            {phase === 'won' ? `Все ${MAX_WAVE} волн отбиты` : `Дошёл до волны ${s.wave}`}
            <br />Убито сегментов: {s.killed} · Очки: {s.score}
          </p>
          <button className="btn-primary" onClick={restart}>Ещё раз</button>
        </div>
      )}
    </div>
  )
}
