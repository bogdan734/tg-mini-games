import { useCallback, useEffect, useRef, useState } from 'react'
import { apiEnabled, submitScore, type ScoreResult } from '../../lib/api'
import { haptic, shareText } from '../../lib/telegram'
import { Sfx } from '../snake-td/render/sfx'
import '../snake-td/snake-td.css'
import type { GameProps } from '../types'
import { MAX_WAVE } from './engine/enemies'
import {
  closeChoice, createGame, moveOrMerge, openChoice, pickChoice, rerollChoice, sellTower, startWave, tick, towerAt,
} from './engine/game'
import type { GameState, Phase } from './engine/types'
import {
  choiceCloseRect, choiceRect, choiceRerollRect, drawGame, H, inRect, muteRect, sellZoneRect, tileAt, type ViewState, W, waveButtonRect,
} from './render/draw'
import { loadTowerSprites, type Sprites } from './render/sprites'

const K_MUTED = 'std:muted'
const readMuted = (): boolean => { try { return localStorage.getItem(K_MUTED) === '1' } catch { return false } }

export default function MergeDefense({ onScore }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createGame())
  const viewRef = useRef<ViewState>({ drag: null, selected: null, toast: null, muted: readMuted() })
  const spritesRef = useRef<Sprites>({})
  const sfxRef = useRef<Sfx>(new Sfx())
  const scaleRef = useRef(1)
  const phaseRef = useRef<Phase>('ready')
  const reportedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [online, setOnline] = useState<ScoreResult | null>(null)

  const toast = (text: string) => { viewRef.current.toast = { text, t: 1.4 } }

  useEffect(() => {
    sfxRef.current.muted = viewRef.current.muted
    loadTowerSprites().then((sp) => { spritesRef.current = sp })
    document.fonts?.load('700 16px Fredoka').catch(() => {})
  }, [])

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

  const restart = useCallback(() => {
    stateRef.current = createGame()
    viewRef.current = { ...viewRef.current, drag: null, selected: null, toast: null }
    reportedRef.current = false
    phaseRef.current = 'ready'
    setPhase('ready')
    setOnline(null)
  }, [])

  const finish = useCallback((s: GameState) => {
    if (reportedRef.current) return
    reportedRef.current = true
    haptic(s.phase === 'won' ? 'success' : 'error')
    onScore(s.score)
    if (apiEnabled()) void submitScore('merge-td', 1, s.score, s.wave, s.phase === 'won', { killed: s.killed, merges: s.merges, evolutions: s.evolutions }).then(setOnline)
  }, [onScore])
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    const STEP = 1 / 60
    let acc = 0, raf = 0, last = performance.now()
    const drain = (s: GameState) => {
      for (const n of s.fx.sounds) { sfxRef.current.play(n); if (n === 'pass') haptic('error'); else if (n === 'killHead') haptic('success') }
      s.fx.sounds.length = 0
    }
    const syncPhase = (s: GameState) => {
      if (s.phase === phaseRef.current) return
      phaseRef.current = s.phase
      setPhase(s.phase)
      if (s.phase === 'over' || s.phase === 'won') finishRef.current(s)
    }
    const loop = (now: number) => {
      acc += Math.min(0.25, (now - last) / 1000)
      last = now
      const s = stateRef.current, v = viewRef.current
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
      ;(window as unknown as { __mtd: unknown }).__mtd = {
        get state() { return stateRef.current },
        get view() { return viewRef.current },
        step(sec: number) { const s = stateRef.current; for (let t = 0; t < sec; t += STEP) tick(s, STEP); s.fx.sounds.length = 0; syncPhase(s); drawGame(ctx, s, spritesRef.current, viewRef.current, performance.now() / 1000) },
        api: { startWave, openChoice, pickChoice, rerollChoice, moveOrMerge, sellTower, towerAt, reset: restart, sync: () => syncPhase(stateRef.current) },
      }
    }
    return () => cancelAnimationFrame(raf)
  }, [restart])

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
      return
    }
    if (s.phase !== 'ready' && s.phase !== 'wave') return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (s.phase === 'ready' && inRect(waveButtonRect(), x, y)) { startWave(s); haptic('medium'); return }
    if (s.choice) {
      for (let i = 0; i < 3; i++) {
        if (inRect(choiceRect(i), x, y)) {
          const t = pickChoice(s, i)
          if (t) { haptic('light'); v.selected = t.id } else { toast('Не хватает золота'); haptic('error'); sfxRef.current.play('error') }
          return
        }
      }
      if (inRect(choiceRerollRect(), x, y)) { if (!rerollChoice(s)) { toast('Не хватает золота'); haptic('error') } return }
      if (inRect(choiceCloseRect(), x, y) || y >= choiceRect(0).y) { closeChoice(s); return }
    }
    const tile = tileAt(x, y)
    if (tile === null) { if (s.choice) closeChoice(s); v.selected = null; return }
    const t = towerAt(s, tile)
    if (t) { v.drag = { towerId: t.id, type: t.type, x, y, moved: false }; v.selected = t.id; closeChoice(s); return }
    if (!openChoice(s, tile)) { toast(`Нужно ${s.placeCost} 💰`); haptic('error'); sfxRef.current.play('error') }
    else { haptic('light'); v.selected = null }
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
    if (!d || !d.moved) return
    const { x, y } = toCanvas(e)
    const tile = tileAt(x, y)
    if (tile !== null) {
      const res = moveOrMerge(s, d.towerId, tile)
      if (res === 'merged') { haptic('success'); const t = towerAt(s, tile); toast(t ? `Слияние: ${t.type === d.type ? 'уровень ' + t.level : 'новое существо!'}` : 'Слияние!'); v.selected = t?.id ?? null }
      else if (res === 'blocked') { toast('Эти башни не сливаются'); haptic('error'); sfxRef.current.play('error') }
      return
    }
    if (inRect(sellZoneRect(), x, y) && sellTower(s, d.towerId)) { toast('Продано'); haptic('medium'); v.selected = null }
  }, [])

  const s = stateRef.current
  const share = () => shareText(`🏰 Merge Defense: я ${s.phase === 'won' ? 'отбил все волны' : `дошёл до волны ${s.wave}`} и набрал ${s.score} очков. Побьёшь?`)

  return (
    <div className="std-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="std-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      {(phase === 'over' || phase === 'won') && (
        <div className="std-modal">
          <h2>{phase === 'won' ? '🏆 Победа!' : '💀 База пала'}</h2>
          <p className="subtitle">
            {phase === 'won' ? `Все ${MAX_WAVE} волн отбиты` : `Дошёл до волны ${s.wave}`}
            <br />Убито врагов: {s.killed} · Слияний: {s.merges} · Очки: {s.score}
            {online?.rank && <><br />🏆 Место в рейтинге: #{online.rank}{online.coinsEarned > 0 && ` · +${online.coinsEarned} 🪙`}</>}
            {online && online.questsCompleted.length > 0 && <><br />📋 Задание выполнено — забери награду в профиле</>}
          </p>
          <button className="btn-primary" onClick={restart}>Ещё раз</button>
          <button className="back-btn" onClick={share}>📤 Вызвать друга</button>
        </div>
      )}
    </div>
  )
}
