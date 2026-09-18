import { useCallback, useEffect, useRef, useState } from 'react'
import { apiEnabled, equippedNow, getMe, onProfile, ownedMapLevel, submitScore, type ScoreResult } from '../../lib/api'
import { getValue, setValue } from '../../lib/storage'
import { haptic, shareText } from '../../lib/telegram'
import type { GameProps } from '../types'
import {
  buyAndPlace, chooseEvolution, createGame, EVENTS, maxWave, moveOrMerge, reroll,
  resolveEvent, sellUnit, startWave, tick, unitAt,
} from './engine/game'
import { getLevel, LEVELS, unlockAfterWin } from './engine/levels'
import type { GameState, Phase } from './engine/types'
import { canMerge, EVO_MUL, UNIT_DEFS } from './engine/units'
import {
  drawGame, H, inRect, muteRect, sellZoneRect, shopCardRect, slotAt, type ViewState, W, waveButtonRect,
} from './render/draw'
import { Sfx } from './render/sfx'
import { loadSprites, type Sprites } from './render/sprites'
import './snake-td.css'

const K_UNLOCKED = 'std:unlocked'
const K_BEST = (level: number) => `std:best:${level}`
const K_MUTED = 'std:muted'

const readMuted = (): boolean => { try { return localStorage.getItem(K_MUTED) === '1' } catch { return false } }

export default function SnakeDefense({ onScore }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createGame(1))
  const viewRef = useRef<ViewState>({ drag: null, selected: null, toast: null, muted: readMuted(), snakeSkin: equippedNow().snake })
  const spritesRef = useRef<Sprites>({})
  const sfxRef = useRef<Sfx>(new Sfx())
  const scaleRef = useRef(1)
  const phaseRef = useRef<Phase>('menu')
  const reportedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('menu')
  const [unlocked, setUnlocked] = useState(1)
  const [best, setBest] = useState<Record<number, number>>({})
  const [online, setOnline] = useState<ScoreResult | null>(null)
  const [, bump] = useState(0)

  const toast = (text: string) => { viewRef.current.toast = { text, t: 1.4 } }

  useEffect(() => {
    stateRef.current.phase = 'menu'
    sfxRef.current.muted = viewRef.current.muted
    document.fonts?.load('700 16px Fredoka').catch(() => {})
    // cosmetics + shop-unlocked maps follow the profile
    const applyProfile = () => {
      const eq = equippedNow()
      viewRef.current.snakeSkin = eq.snake
      loadSprites(eq.units.replace(/^units:/, '')).then((sp) => { spritesRef.current = sp })
      setUnlocked((u) => Math.max(u, ownedMapLevel()))
    }
    applyProfile()
    const off = onProfile(applyProfile)
    void getMe()
    let alive = true
    Promise.all([getValue(K_UNLOCKED), ...LEVELS.map((l) => getValue(K_BEST(l.id)))]).then(([u, ...b]) => {
      if (!alive) return
      setUnlocked(Math.max(1, Number(u ?? 1)))
      setBest(Object.fromEntries(LEVELS.map((l, i) => [l.id, Number(b[i] ?? 0)])))
    })
    return () => { alive = false; off() }
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

  const startLevel = useCallback((level: number) => {
    stateRef.current = createGame(level)
    viewRef.current = { ...viewRef.current, drag: null, selected: null, toast: null }
    reportedRef.current = false
    phaseRef.current = 'ready'
    setPhase('ready')
  }, [])

  const toMenu = useCallback(() => {
    stateRef.current = createGame(stateRef.current.level)
    stateRef.current.phase = 'menu'
    phaseRef.current = 'menu'
    setPhase('menu')
  }, [])

  const finish = useCallback((s: GameState) => {
    if (reportedRef.current) return
    reportedRef.current = true
    haptic(s.phase === 'won' ? 'success' : 'error')
    onScore(s.score)
    setOnline(null)
    if (apiEnabled()) void submitScore('snake-td', s.level, s.score, s.wave, s.phase === 'won').then(setOnline)
    const prev = best[s.level] ?? 0
    if (s.score > prev) {
      setBest((b) => ({ ...b, [s.level]: s.score }))
      void setValue(K_BEST(s.level), String(s.score))
    }
    if (s.phase === 'won') {
      const next = unlockAfterWin(s.level, unlocked)
      if (next !== unlocked) { setUnlocked(next); void setValue(K_UNLOCKED, String(next)) }
    }
  }, [onScore, best, unlocked])
  const finishRef = useRef(finish)
  finishRef.current = finish

  // game loop
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const STEP = 1 / 60
    let acc = 0
    let raf = 0
    let last = performance.now()
    const drain = (s: GameState) => {
      for (const n of s.fx.sounds) {
        sfxRef.current.play(n)
        if (n === 'pass') haptic('error')
        else if (n === 'killHead') haptic('success')
      }
      s.fx.sounds.length = 0
    }
    const syncPhase = (s: GameState) => {
      if (s.phase === phaseRef.current) return
      phaseRef.current = s.phase
      setPhase(s.phase)
      if (s.phase === 'evolution' || s.phase === 'event') haptic('medium')
      if (s.phase === 'over' || s.phase === 'won') finishRef.current(s)
    }
    const loop = (now: number) => {
      acc += Math.min(0.25, (now - last) / 1000)
      last = now
      const s = stateRef.current
      const v = viewRef.current
      while (acc >= STEP) {
        tick(s, STEP)
        if (v.toast) { v.toast.t -= STEP; if (v.toast.t <= 0) v.toast = null }
        acc -= STEP
      }
      drain(s)
      syncPhase(s)
      drawGame(ctx, s, spritesRef.current, v, now / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __std: unknown }).__std = {
        get state() { return stateRef.current },
        get view() { return viewRef.current },
        step(sec: number) {
          const s = stateRef.current
          for (let t = 0; t < sec; t += STEP) tick(s, STEP)
          s.fx.sounds.length = 0
          syncPhase(s)
          drawGame(ctx, s, spritesRef.current, viewRef.current, performance.now() / 1000)
        },
        api: { startWave, resolveEvent, chooseEvolution, buyAndPlace, moveOrMerge, reroll, unitAt, canMerge, sync: () => syncPhase(stateRef.current), reset: startLevel },
      }
    }
    return () => cancelAnimationFrame(raf)
  }, [startLevel])

  const toCanvas = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scaleRef.current, y: (e.clientY - r.top) / scaleRef.current }
  }

  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current, v = viewRef.current
    sfxRef.current.unlock()
    const { x, y } = toCanvas(e)
    if (inRect(muteRect(), x, y)) {
      v.muted = !v.muted
      sfxRef.current.muted = v.muted
      try { localStorage.setItem(K_MUTED, v.muted ? '1' : '0') } catch { /* ignore */ }
      if (!v.muted) sfxRef.current.play('click')
      return
    }
    if (s.phase !== 'ready' && s.phase !== 'wave') return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (s.phase === 'ready' && inRect(waveButtonRect(), x, y)) { startWave(s); haptic('medium'); return }
    for (let i = 0; i < 3; i++) {
      if (inRect(shopCardRect(i), x, y) && s.shop[i]) {
        const type = s.shop[i]!
        if (s.gold < UNIT_DEFS[type].price) { toast('Не хватает золота'); haptic('error'); sfxRef.current.play('error'); return }
        v.drag = { kind: 'shop', shopIdx: i, unitId: -1, type, x, y, moved: false }
        v.selected = null
        return
      }
    }
    if (inRect(shopCardRect(3), x, y)) {
      if (reroll(s)) haptic('light'); else { toast('Не хватает золота'); haptic('error'); sfxRef.current.play('error') }
      return
    }
    const slot = slotAt(x, y, getLevel(s.level).slots)
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
    const slot = slotAt(x, y, getLevel(s.level).slots)
    if (d.kind === 'shop') {
      if (slot === null) { if (d.moved) toast('Отпусти на свободный слот'); return }
      if (buyAndPlace(s, d.shopIdx, slot)) haptic('light')
      else { toast(unitAt(s, slot) ? 'Слот занят' : 'Не хватает золота'); haptic('error'); sfxRef.current.play('error') }
      return
    }
    if (!d.moved) return
    if (slot !== null) {
      const res = moveOrMerge(s, d.unitId, slot)
      if (res === 'merged') { haptic('success'); toast('Слияние!'); v.selected = unitAt(s, slot)?.id ?? null }
      else if (res === 'blocked') { toast('Нельзя объединить'); haptic('error'); sfxRef.current.play('error') }
      return
    }
    if (inRect(sellZoneRect(), x, y)) {
      const u = s.units.find((z) => z.id === d.unitId)
      if (u && sellUnit(s, d.unitId)) { toast('Продано'); haptic('medium'); v.selected = null }
    }
  }, [])

  const s = stateRef.current
  const lvl = getLevel(s.level)
  const evoUnit = s.units.find((u) => u.id === s.pendingEvo)
  const ev = s.pendingEvent ? EVENTS[s.pendingEvent] : null
  const nextLevel = LEVELS.find((l) => l.id === s.level + 1)
  const share = () => {
    const what = s.phase === 'won' ? `прошёл «${lvl.name}» полностью` : `дошёл до волны ${s.wave} на «${lvl.name}»`
    shareText(`🐍 Snake Defense: я ${what} и набрал ${s.score} очков. Побьёшь?`)
  }

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
      {phase === 'menu' && (
        <div className="std-modal std-menu">
          <h2>🐍 Snake Defense</h2>
          <p className="subtitle">Выбери карту</p>
          <div className="std-levels">
            {LEVELS.map((l) => {
              const locked = l.id > unlocked
              return (
                <button key={l.id} className="std-level" disabled={locked} onClick={() => { sfxRef.current.unlock(); sfxRef.current.play('click'); startLevel(l.id) }}>
                  <span className="std-level-icon">{locked ? '🔒' : l.icon}</span>
                  <span className="std-level-body">
                    <b>{l.name}</b>
                    <small>{locked ? `Пройди «${LEVELS[l.id - 2]?.name}»` : l.desc}</small>
                    {!locked && (best[l.id] ?? 0) > 0 && <em>Рекорд: {best[l.id]}</em>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
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
            {phase === 'won' ? `«${lvl.name}»: все ${maxWave(s)} волн отбиты` : `«${lvl.name}»: дошёл до волны ${s.wave}`}
            <br />Убито сегментов: {s.killed} · Очки: {s.score}
            {(best[s.level] ?? 0) < s.score && <><br />🎉 Новый рекорд карты</>}
            {online?.rank && <><br />🏆 Место в рейтинге: #{online.rank}{online.coinsEarned > 0 && ` · +${online.coinsEarned} 🪙`}</>}
            {online && online.granted.length > 0 && <><br />🎁 Ивентовая награда получена — смотри в магазине</>}
          </p>
          {phase === 'won' && nextLevel && <button className="btn-primary" onClick={() => startLevel(nextLevel.id)}>{nextLevel.icon} Дальше: {nextLevel.name}</button>}
          <button className="btn-primary" onClick={() => startLevel(s.level)}>Ещё раз</button>
          <div className="std-row">
            <button className="back-btn" onClick={share}>📤 Вызвать друга</button>
            <button className="back-btn" onClick={toMenu}>К картам</button>
          </div>
        </div>
      )}
    </div>
  )
}
